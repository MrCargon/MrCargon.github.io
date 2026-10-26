# -*- coding: utf-8 -*-
"""Derive the service-worker cache name from the content it caches.

Why this exists, in sw.js's own words:

    "ALWAYS bump this when shipping asset changes, or nobody sees them."

A manual step with a shouty comment above it is a step that gets missed, and
the failure is invisible: the deploy succeeds, the CDN serves the new file,
and returning visitors keep seeing the old site because the service worker
answered from cache before the network was ever consulted. Not even
Ctrl+Shift+R reliably beats it.

This is the static-site half of blue-green. On a server, the pointer decides
which build answers. Here the *cache name* does - it is the only thing that
tells a returning browser "throw away what you have". So it must not be a
number somebody remembers to type. Derive it from the bytes:

    CACHE_NAME = mrcargon-hub-<hash of every deployed asset>

Change any asset and the name changes. Change nothing and it does not, so a
no-op deploy does not needlessly evict every visitor's cache. Forgetting is no
longer possible, because nobody is being asked to remember.

Note this does NOT replace a CDN and does not need one. mrcargon.github.io is
already served through Fastly by GitHub Pages - verified by the response
headers (`via: 1.1 varnish`, `x-served-by: cache-pao-...`). The edge was never
the problem; the client-side cache was.

Usage:
    python deploy/stamp.py            report what the name should be
    python deploy/stamp.py --write    stamp it into sw.js
    python deploy/stamp.py --check    exit 1 if sw.js is out of date (for CI)
"""

import hashlib
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SW = os.path.join(ROOT, "sw.js")

# What the browser can actually fetch and cache. Anything not served is not a
# reason to evict a visitor's cache.
EXT = (".html", ".css", ".js", ".json", ".webmanifest", ".svg")
SKIP_DIRS = {".git", "node_modules", ".github", "deploy", ".vscode"}
PATTERN = re.compile(r"const CACHE_NAME = '([^']+)';")
PREFIX = "mrcargon-hub-"


def assets():
    out = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in sorted(files):
            if f.lower().endswith(EXT):
                out.append(os.path.join(base, f))
    return sorted(out)


def fingerprint():
    """One hash over every deployed byte, path included so a rename counts."""
    h = hashlib.sha256()
    files = assets()
    for p in files:
        rel = os.path.relpath(p, ROOT).replace("\\", "/")
        h.update(rel.encode("utf-8"))
        with open(p, "rb") as fh:
            body = fh.read()
        # Line endings are not content: a Windows checkout (core.autocrlf=true)
        # has CRLF on disk, GitHub and any Linux/CI clone have LF, and Helm's
        # publish clone writes LF. Hash CRLF as LF so every copy of the same
        # commit agrees - otherwise each side restamps and sw.js conflicts.
        body = body.replace(b"\r\n", b"\n")
        # sw.js contains the hash itself, so hashing it whole would never
        # settle. Hash it with the cache-name line removed.
        if rel == "sw.js":
            body = PATTERN.sub(b"const CACHE_NAME = '';".decode(), body.decode(
                "utf-8", "replace")).encode("utf-8")
        h.update(hashlib.sha256(body).digest())
    return PREFIX + h.hexdigest()[:12], len(files)


def current():
    # newline="" keeps sw.js's own line endings in `s`. The old read translated CRLF to
    # LF and --write then saved LF, so on a Windows (autocrlf) checkout the write itself
    # changed sw.js's bytes, and with them the hash: one --write never settled.
    s = io.open(SW, encoding="utf-8", newline="").read()
    m = PATTERN.search(s)
    return (m.group(1) if m else None), s


def main():
    want, n = fingerprint()
    have, src = current()
    if have is None:
        print("could not find CACHE_NAME in sw.js")
        return 2

    print("assets hashed : %d" % n)
    print("current       : %s" % have)
    print("content says  : %s" % want)

    if have == want:
        print("\nup to date - no visitor cache needs evicting")
        return 0

    if "--check" in sys.argv:
        print("\nOUT OF DATE. Returning visitors would keep the old site.")
        print("Run: python deploy/stamp.py --write")
        return 1

    if "--write" in sys.argv:
        # newline="" = no translation: the file keeps its existing newline style and
        # only the CACHE_NAME line changes.
        io.open(SW, "w", encoding="utf-8", newline="").write(
            PATTERN.sub("const CACHE_NAME = '%s';" % want, src, count=1))
        print("\nstamped. Every old cache is deleted by the activate handler,")
        print("and skipWaiting + clients.claim mean it takes effect on the")
        print("next page load rather than the one after.")
        return 0

    print("\nassets changed. Run with --write to stamp it.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
