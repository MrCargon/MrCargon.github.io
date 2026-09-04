import { test, expect } from '@playwright/test';
import fs from 'fs';

/**
 * LAYOUT AUDIT — the half a click-through cannot see.
 *
 * A control can be perfectly wired and still be unusable: pushed off the side of the
 * screen, covered by a panel, or in a column that scrolls sideways. This site has had all
 * three (nav links reported as covered on iPhone SE; the Barista game trapped because a
 * z-index lifted its container; long panels with no internal scroll on short screens).
 *
 * Checked at every breakpoint, on every route:
 *
 *   1. The page never scrolls SIDEWAYS. Vertical scrolling is normal; horizontal is a
 *      layout bug every time.
 *   2. Every visible control is inside the viewport.
 *   3. Every visible control is actually HITTABLE — elementFromPoint at its centre
 *      returns it or something inside it. This is what catches a panel painting over a
 *      button, which looks fine in a screenshot and is dead to a finger.
 *   4. Nothing overflows its own scroll container horizontally.
 *
 * The Life page gets extra attention: it is the most control-dense page on the site and
 * the one being actively changed.
 */

const SIZES = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'phone landscape', width: 667, height: 375 },
    { name: 'tablet', width: 820, height: 1180 },
    { name: 'laptop', width: 1280, height: 800 },
    { name: 'wide', width: 1920, height: 1080 }
];

const ROUTES = ['#main', '#projects', '#about', '#contact', '#launcher', '#life', '#particles'];

test.describe.configure({ timeout: 300000 });

async function settle(page, route) {
    await page.goto('/' + route);
    await page.waitForTimeout(route === '#main' ? 5500 : 3200);
}

/**
 * Open every <details> so its controls are measured — but NOT the side popups.
 *
 * The first version clicked every .popup-tab, which opens the planet-info panel and the
 * camera-controls panel SIMULTANEOUSLY. On a 375px screen two overlapping panels
 * naturally cover the planet tabs behind them, and the audit dutifully reported 76
 * "covered controls" that were nothing of the sort: a panel covering the backdrop is
 * what a panel is for, and no user has both open at once. Panels get their own check.
 */
async function expand(page) {
    await page.evaluate(() => {
        document.querySelectorAll('details').forEach((d) => { d.open = true; });
    });
    await page.waitForTimeout(500);
}

async function measure(page) {
    return page.evaluate(() => {
        const vw = window.innerWidth, vh = window.innerHeight;
        const problems = [];

        // 1. Sideways scroll on the document.
        const de = document.documentElement;
        if (de.scrollWidth > vw + 1) {
            problems.push({ kind: 'page scrolls sideways', detail: `${de.scrollWidth}px of content in ${vw}px` });
        }

        // 4. Anything wider than its own scroll container.
        document.querySelectorAll('*').forEach((el) => {
            if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
                const st = getComputedStyle(el);
                // overflow-x auto/scroll means it is MEANT to scroll — that is the fix,
                // not the bug. Only unscrollable overflow is a problem.
                // overflow-x: VISIBLE is not a fault. The content paints outside the box
                // and every pixel is still on screen — ordinary inline overflow, and
                // extremely common. What matters is content that is CUT OFF (hidden/clip)
                // or that pushes the page sideways, and the page-level check above covers
                // the second. Flagging visible overflow reported rotated tab labels and
                // protruding panel handles as broken when both render perfectly.
                if (st.overflowX === 'hidden' || st.overflowX === 'clip') {
                    // Deliberately hidden subtrees are 1px by design and their content
                    // "overflowing" IS the hiding technique. The contact form's honeypot
                    // is the example: an aria-hidden div parked at left:-9999px with a
                    // 1px box, so a bot fills it and a person never sees it.
                    if (st.clip !== 'auto' || el.closest('.visually-hidden')) return;
                    if (el.closest('[aria-hidden="true"]')) return;
                    const rr = el.getBoundingClientRect();
                    if (rr.right < -1000 || rr.left > window.innerWidth + 1000) return;
                    // An absolutely-positioned child escaping its parent's box is what
                    // absolute positioning is FOR. The side popups' tab handles protrude
                    // from the panel edge deliberately. Ask whether the IN-FLOW content
                    // overflows, not whether anything does — the first version required
                    // EVERY child to be absolute, which the popup's static content panel
                    // defeated even though it fits perfectly.
                    const box = el.getBoundingClientRect();
                    let flowRight = 0;
                    for (let i = 0; i < el.children.length; i++) {
                        const cp = getComputedStyle(el.children[i]).position;
                        if (cp === 'absolute' || cp === 'fixed') continue;
                        flowRight = Math.max(flowRight, el.children[i].getBoundingClientRect().right - box.left);
                    }
                    if (el.children.length > 0 && flowRight <= el.clientWidth + 1) return;
                    const id = el.id || el.className || el.tagName;
                    if (String(id).length < 60) {
                        problems.push({ kind: 'content overflows its box', detail: `${id}: ${el.scrollWidth} in ${el.clientWidth}` });
                    }
                }
            }
        });

        // 2 and 3: controls off-screen or covered.
        const sel = 'button, a[href], input, select, [role="button"], [role="tab"], summary, textarea';
        const seen = new Set();
        document.querySelectorAll(sel).forEach((el) => {
            const r = el.getBoundingClientRect();
            const st = getComputedStyle(el);
            if (r.width < 2 || r.height < 2) return;
            if (st.visibility === 'hidden' || st.display === 'none') return;
            if (st.pointerEvents === 'none' || Number(st.opacity) < 0.1) return;
            // Deliberately parked off-canvas: the contact form's honeypot sits at
            // -9999px to catch bots, and skip links use the clip technique. Both are
            // correct implementations of established patterns, not layout faults.
            if (r.right < -1000 || st.clip !== 'auto' || el.closest('.visually-hidden')) return;
            const label = (el.getAttribute('aria-label') || el.id
                || (el.textContent || '').trim().slice(0, 30) || el.tagName).replace(/\s+/g, ' ');
            if (seen.has(label)) return;
            seen.add(label);

            // A horizontally scrollable ancestor makes "outside the viewport" mean
            // "scroll the strip", not "unreachable". The planet selector is exactly that,
            // and it has arrow buttons for the purpose — reporting its off-screen tabs as
            // faults blames the design for working.
            let hScroller = false;
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
                const ps = getComputedStyle(p);
                if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') { hScroller = true; break; }
            }
            if (!hScroller && (r.right < -1 || r.left > vw + 1)) {
                problems.push({ kind: 'control off-screen horizontally', detail: `${label} at x ${Math.round(r.left)}..${Math.round(r.right)} in ${vw}px` });
                return;
            }
            if (hScroller && (r.right < 0 || r.left > vw)) return;   // scrolled out of the strip
            // A control below the fold is fine — the page scrolls. Off the SIDE is not.
            const cx = Math.min(vw - 2, Math.max(2, r.left + r.width / 2));
            const cy = r.top + r.height / 2;
            if (cy < 0 || cy > vh) return;                 // out of view vertically: scroll to it, not a bug

            // CLIPPED BY A SCROLLING ANCESTOR is also "scroll to it", not "covered".
            // Without this the audit reported ~40 Life and Launcher controls as covered
            // by the footer. They were not: on a short viewport the page section is a
            // scroll box, controls below its visible edge keep a bounding rect that lands
            // in the footer's band, and elementFromPoint there naturally returns the
            // footer. Verified by hand at 375x667, where the same button reports itself.
            let clipped = false;
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
                const ps = getComputedStyle(p);
                if (ps.overflowY === 'auto' || ps.overflowY === 'scroll'
                    || ps.overflowX === 'auto' || ps.overflowX === 'scroll') {
                    const pr = p.getBoundingClientRect();
                    if (cy < pr.top || cy > pr.bottom || cx < pr.left || cx > pr.right) clipped = true;
                    break;
                }
            }
            if (clipped) return;
            const hit = document.elementFromPoint(cx, cy);
            if (!hit) return;
            if (hit !== el && !el.contains(hit) && !hit.contains(el)) {
                const by = (hit.id || hit.className || hit.tagName || '').toString().slice(0, 40);
                problems.push({ kind: 'control covered', detail: `${label} covered by ${by}` });
            }
        });
        return problems;
    });
}

test('no route has a layout fault at any breakpoint', async ({ page }) => {
    fs.mkdirSync('scratch', { recursive: true });
    const all = [];
    const lines = ['# Layout audit', ''];

    for (const size of SIZES) {
        await page.setViewportSize({ width: size.width, height: size.height });
        lines.push(`\n## ${size.name} — ${size.width}x${size.height}\n`);
        for (const route of ROUTES) {
            await settle(page, route);
            await expand(page);
            const problems = await measure(page);
            if (problems.length === 0) {
                lines.push(`- \`${route}\` — clean`);
            } else {
                for (const p of problems) {
                    lines.push(`- **${route}** — ${p.kind}: ${p.detail}`);
                    all.push({ size: size.name, route, ...p });
                }
            }
        }
    }

    const head = `Breakpoints: ${SIZES.length}, routes: ${ROUTES.length}, faults: **${all.length}**\n`;
    fs.writeFileSync('scratch/layout-audit.md', lines.slice(0, 2).join('\n') + '\n' + head + lines.slice(2).join('\n') + '\n');
    console.log(head + all.slice(0, 30).map((a) => `  ${a.size} ${a.route}: ${a.kind} — ${a.detail}`).join('\n'));

    expect(all.map((a) => `${a.size} ${a.route}: ${a.kind} — ${a.detail}`)).toEqual([]);
});

test('the Life page stays usable on a small screen', async ({ page }) => {
    // The most control-dense page on the site, at the smallest size it has to work on.
    await page.setViewportSize({ width: 375, height: 667 });
    await settle(page, '#life');
    await expand(page);

    const state = await page.evaluate(() => {
        const canvas = document.getElementById('life-canvas');
        const cr = canvas ? canvas.getBoundingClientRect() : null;
        const section = document.getElementById('life');
        return {
            canvas: cr ? { w: Math.round(cr.width), h: Math.round(cr.height), left: Math.round(cr.left) } : null,
            // The controls must be reachable: either the section scrolls, or everything fits.
            sectionScrolls: section ? section.scrollHeight > section.clientHeight : false,
            canScroll: section ? getComputedStyle(section).overflowY : null,
            docWidth: document.documentElement.scrollWidth,
            viewport: window.innerWidth
        };
    });

    expect(state.canvas, 'the simulation canvas exists').not.toBeNull();
    expect(state.canvas.w, 'the canvas fits the screen').toBeLessThanOrEqual(375);
    expect(state.canvas.w, 'and is not collapsed to nothing').toBeGreaterThan(200);
    expect(state.canvas.left, 'the canvas is not pushed off the left edge').toBeGreaterThanOrEqual(0);
    expect(state.docWidth, 'the page does not scroll sideways').toBeLessThanOrEqual(state.viewport + 1);
    // If the content is taller than the box, the box must be able to scroll or the
    // controls below the fold are unreachable — the exact fault fixed earlier on this site.
    if (state.sectionScrolls) {
        expect(['auto', 'scroll'], 'a too-tall panel must scroll').toContain(state.canScroll);
    }
});

test('every Life control is reachable at every breakpoint', async ({ page }) => {
    // Not "is it wired" — the UI audit covers that. This is "can a finger reach it".
    const missing = [];
    for (const size of SIZES) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await settle(page, '#life');
        await expand(page);
        const unreachable = await page.evaluate(() => {
            const out = [];
            const sel = '#life button, #life input, #life select, #life summary, #life a[href]';
            document.querySelectorAll(sel).forEach((el) => {
                const st = getComputedStyle(el);
                if (st.display === 'none' || st.visibility === 'hidden') return;
                if (el.closest('[hidden]')) return;
                const r = el.getBoundingClientRect();
                if (r.width < 2 || r.height < 2) return;
                // Horizontally out of the viewport cannot be scrolled to on a page that
                // only scrolls vertically.
                if (r.right < 0 || r.left > window.innerWidth) {
                    out.push((el.id || el.getAttribute('aria-label') || el.tagName) + ' off-screen');
                }
            });
            return out;
        });
        for (const u of unreachable) missing.push(`${size.name}: ${u}`);
    }
    expect(missing, 'no Life control is off the side of the screen').toEqual([]);
});
