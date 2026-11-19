# -*- coding: utf-8 -*-
"""Rebuild src/data/satellites-snapshot.json from CelesTrak's public GP data.

Why: Satellites.js drops element sets older than MAX_AGE_LEO_MS (14 days) for low
orbits and MAX_AGE_HIGH_MS (60 days) for GPS/GEO. Every host but the live one
(mrcargon.github.io) draws only this bundled snapshot, so the Stations and
Weather groups vanish there two weeks after the snapshot's fetch date.
Rebuild at least every two weeks, then run `python deploy/stamp.py --write`.

Politeness: CelesTrak blocks an IP that downloads the same data more than once
per 2 hours. This script makes exactly one request per group (three in all,
the same GROUP= URLs the live layer uses), no retries, no loops. Do not run it
twice within 2 hours.

Format (what Satellites.js and the tests read): compact JSON, no trailing
newline, {"source", "fetched", "groups": {<group id>: [OMM records]}}, each
record trimmed to the OMM fields below, in the order Satellites.GROUPS lists.

Usage:
    python deploy/build_sat_snapshot.py          fetch and write the snapshot
    python deploy/build_sat_snapshot.py --dry    fetch and report, write nothing

Needs no API key. Stdlib only.
"""

import datetime
import json
import os
import sys
import urllib.request

API_URL = 'https://celestrak.org/NORAD/elements/gp.php'
GROUPS = ['gps-ops', 'weather', 'stations']   # = Satellites.GROUPS ids, same order
FIELDS = ['OBJECT_NAME', 'OBJECT_ID', 'EPOCH', 'CLASSIFICATION_TYPE', 'MEAN_MOTION',
          'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE', 'ARG_OF_PERICENTER',
          'MEAN_ANOMALY', 'EPHEMERIS_TYPE', 'NORAD_CAT_ID', 'ELEMENT_SET_NO',
          'REV_AT_EPOCH', 'BSTAR', 'MEAN_MOTION_DOT', 'MEAN_MOTION_DDOT']
MAX_OBJECTS = 300   # = Satellites.MAX_OBJECTS; the layer drops anything past it
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data',
                   'satellites-snapshot.json')


def fetch_group(group_id):
    """One GET for one group; raises on any HTTP or JSON problem (no retry)."""
    url = API_URL + '?GROUP=' + group_id + '&FORMAT=json'
    req = urllib.request.Request(url, headers={'User-Agent': 'portfolio-snapshot-build/1'})
    with urllib.request.urlopen(req, timeout=30) as res:
        body = res.read().decode('utf-8')
    data = json.loads(body)   # CelesTrak answers a block or bad group with plain text
    if not isinstance(data, list) or not data:
        raise ValueError(group_id + ': expected a non-empty JSON list')
    out = []
    for rec in data:
        missing = [f for f in FIELDS if f not in rec]
        if missing:
            raise ValueError(group_id + ': record lacks ' + ', '.join(missing))
        out.append({f: rec[f] for f in FIELDS})
    return out


def main(argv):
    dry = '--dry' in argv
    groups = {}
    for gid in GROUPS:
        groups[gid] = fetch_group(gid)
    total = sum(len(v) for v in groups.values())
    if total > MAX_OBJECTS:
        print('warning: %d objects > MAX_OBJECTS %d; the layer drops the rest' % (total, MAX_OBJECTS))
    snap = {
        'source': 'CelesTrak GP data (celestrak.org), one GROUP= request per group',
        'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'groups': groups,
    }
    text = json.dumps(snap, separators=(',', ':'), ensure_ascii=False)
    for gid in GROUPS:
        epochs = sorted(r['EPOCH'] for r in groups[gid])
        print('%-9s %3d objects, epochs %s .. %s' % (gid, len(groups[gid]), epochs[0][:10], epochs[-1][:10]))
    print('%d objects, %d bytes%s' % (total, len(text.encode('utf-8')), ' (dry run, not written)' if dry else ''))
    if not dry:
        with open(OUT, 'w', encoding='utf-8', newline='') as fh:
            fh.write(text)
        print('wrote ' + os.path.normpath(OUT))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
