import { test, expect } from '@playwright/test';
import fs from 'fs';

/**
 * UI AUDIT — enumerate every interactive element on every page and prove it does something.
 *
 * Not a feature test. Feature tests check the controls someone remembered to write a test
 * for; this walks the DOM, finds everything a person can click or drag, drives it, and
 * reports the ones that change nothing. That is the only way to catch a control that was
 * added to the markup and never wired — the failure mode this site has had repeatedly
 * (#particles with no route, #keyboard-hints toggled from three places and existing
 * nowhere, showKeyboardHints never called, handlePopState an empty stub).
 *
 * "Does something" means: a mutation to the DOM, the URL, the title, localStorage, a form
 * field, or the state of any live simulation, within a short window of the interaction.
 *
 * TWO THINGS THIS HARNESS GOT WRONG FIRST, both of which made live controls look dead:
 *
 *   1. It addressed controls by index into querySelectorAll. That list is rebuilt on every
 *      lookup and this UI mutates constantly, so indices went stale mid-sweep and it ended
 *      up clicking undefined — then reported main-page scene buttons as broken on the
 *      Projects page, where they do not exist at all. Elements are stamped now.
 *   2. It judged text inputs and external links by page mutation. Typing into a field
 *      changes that field and nothing else, and an external link leaves the site entirely.
 *      Both were reported dead. Field values are now part of the snapshot, and outbound
 *      links are checked by href instead.
 *
 * Writes scratch/ui-audit.md.
 */

test.use({ viewport: { width: 1280, height: 900 } });
test.describe.configure({ timeout: 300000 });

const PAGES = ['#main', '#projects', '#about', '#contact', '#launcher', '#life', '#particles'];
const SEL = 'button, a[href], input, select, [role="button"], [role="tab"], summary, textarea';

async function instrument(page) {
    await page.evaluate(() => {
        if (window.__auditObserver) window.__auditObserver.disconnect();
        window.__audit = { mutations: 0 };
        const obs = new MutationObserver((recs) => { window.__audit.mutations += recs.length; });
        obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
        window.__auditObserver = obs;
    });
}

async function openEverything(page) {
    await page.evaluate(() => {
        document.querySelectorAll('details').forEach((d) => { d.open = true; });
        document.querySelectorAll('.side-popup .popup-tab').forEach((t) => t.click());
    });
    await page.waitForTimeout(700);
}

async function snapshot(page) {
    return page.evaluate(() => {
        const se = window.spaceEnvironment;
        const pm = window.pageManager || (window.app && window.app.pageManager);
        const lp = pm && pm._lifePage;
        let ls = '';
        try { ls = JSON.stringify(Object.entries(localStorage).sort()); } catch (e) { ls = 'blocked'; }
        // Field values matter: typing into an input legitimately changes nothing but its
        // own value, and without this every text field reads as dead.
        let fields = '';
        document.querySelectorAll('input, textarea, select').forEach((el) => {
            fields += (el.id || el.name || '') + '=' + (el.type === 'checkbox' ? el.checked : el.value) + ';';
        });
        return {
            fields,
            mutations: window.__audit ? window.__audit.mutations : 0,
            url: location.hash,
            title: document.title,
            storage: ls,
            scene: se ? se.sceneMode : null,
            planet: se ? se.selectedPlanet : null,
            explore: se ? !!se.exploreMode : null,
            lifeMode: lp ? lp.mode : null,
            lifePaused: lp ? !!lp.paused : null,
            zoom: lp && lp.view ? lp.view.zoom : null,
            text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 4000)
        };
    });
}

function changed(a, b) {
    const diff = [];
    for (const k of Object.keys(a)) {
        if (k === 'mutations') { if (b[k] > a[k]) diff.push('dom'); continue; }
        if (a[k] !== b[k]) diff.push(k);
    }
    return diff;
}

/** Every operable element, stamped so it can be addressed after the DOM changes. */
async function controls(page) {
    return page.evaluate((sel) => {
        const out = [];
        document.querySelectorAll(sel).forEach((el, i) => {
            el.setAttribute('data-audit', 'a' + i);
            const r = el.getBoundingClientRect();
            const st = getComputedStyle(el);
            // pointer-events:none means the page has DISABLED it on purpose. The planet
            // selector's scroll arrows do exactly that when there is nothing left to
            // scroll — they dim and stop accepting clicks — and counting them as dead
            // controls reports correct behaviour as a defect.
            const visible = r.width > 0 && r.height > 0
                && st.visibility !== 'hidden' && st.display !== 'none'
                && st.pointerEvents !== 'none' && Number(st.opacity) > 0.05;
            const label = (el.getAttribute('aria-label') || el.title
                || (el.textContent || '').trim().slice(0, 40) || el.id || el.name || el.tagName);
            out.push({
                key: 'a' + i, id: el.id || null, ariaLabel: el.getAttribute('aria-label') || null,
                tag: el.tagName.toLowerCase(),
                type: el.type || null, href: el.getAttribute('href') || null,
                label: label.replace(/\s+/g, ' '), visible, disabled: !!el.disabled
            });
        });
        return out;
    }, SEL);
}

async function operate(page, c) {
    const kind = c.tag === 'input' ? (c.type || 'text') : c.tag;
    return page.evaluate(([key, kind, id, aria]) => {
        // Prefer the STAMP, then a stable identity. The interaction-matrix cells are
        // rebuilt wholesale by _drawMatrix on every edit, so a stamp placed before the
        // sweep is gone by the time its neighbour is reached — 25 live controls were
        // reported dead for that reason. Their aria-labels ("Coral towards Mint") survive
        // the rebuild, so fall back to those.
        const el = document.querySelector('[data-audit="' + key + '"]')
            || (id ? document.getElementById(id) : null)
            || (aria ? document.querySelector('[aria-label="' + aria.replace(/"/g, '\\"') + '"]') : null);
        if (!el) throw new Error('control vanished from the DOM');
        const fire = (n) => el.dispatchEvent(new Event(n, { bubbles: true }));
        if (kind === 'range' || kind === 'number') {
            const min = Number(el.min || 0), max = Number(el.max || 100), cur = Number(el.value);
            // Move to the far end from where it sits, so any effect is unmissable.
            el.value = String(Math.abs(cur - min) > Math.abs(cur - max) ? min : max);
            fire('input'); fire('change'); return;
        }
        if (kind === 'checkbox' || kind === 'radio') { el.checked = !el.checked; fire('change'); return; }
        if (kind === 'color') {
            el.value = el.value === '#ff0000' ? '#00ff88' : '#ff0000';
            fire('input'); fire('change'); return;
        }
        if (kind === 'select') {
            if (el.options.length < 2) return;
            el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
            fire('change'); return;
        }
        if (kind === 'textarea' || kind === 'text' || kind === 'email' || kind === 'search') {
            el.value = 'audit'; fire('input'); return;
        }
        // Buttons, links, tabs, summaries. Dispatched on the element itself so an
        // overlapping panel cannot eat the click and make a live control look dead.
        el.click();
    }, [c.key, kind, c.id, c.ariaLabel]);
}

test('every interactive control on every page does something', async ({ page }) => {
    fs.mkdirSync('scratch', { recursive: true });
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + e.message.slice(0, 200)));

    const report = [];
    const dead = [];
    const removed = [];
    const externals = [];
    let tested = 0;

    for (const route of PAGES) {
        await page.goto('/' + route);
        await page.waitForTimeout(route === '#main' ? 6000 : 3500);
        await openEverything(page);
        await instrument(page);

        const list = (await controls(page)).filter((c) => c.visible && !c.disabled);
        report.push(`\n## ${route} — ${list.length} operable elements\n`);

        for (const c of list) {
            // Navigating away invalidates the rest of the sweep, so internal links are
            // recorded and covered by the dedicated link test below.
            if (c.tag === 'a' && c.href && c.href.startsWith('#') && c.href !== route) {
                report.push(`- \`${c.id || c.label}\` — internal link to ${c.href}`);
                continue;
            }
            // An external link leaves the site: it cannot mutate this page, and the
            // browser blocks or backgrounds the navigation under test, so measuring it
            // like a button labels every outbound link dead. Its href is what matters.
            if (c.tag === 'a' && c.href && !c.href.startsWith('#')) {
                externals.push({ route, label: c.label, href: c.href });
                report.push(`- \`${c.label}\` — external link → ${c.href.slice(0, 70)}`);
                continue;
            }

            const before = await snapshot(page);
            try {
                await operate(page, c);
            } catch (e) {
                const msg = String(e.message);
                // Gone because an EARLIER control removed it, not because it is broken.
                // The sweep drives the species slider to its extreme before it reaches the
                // interaction matrix, which legitimately shrinks the matrix from 6 species
                // to 2 — so "Sky towards Amber" stops existing. Reporting those as dead
                // controls blamed the site for the harness's own side effects.
                if (msg.includes('vanished from the DOM')) {
                    removed.push({ route, label: c.id || c.label });
                    report.push(`- \`${c.id || c.label}\` — removed by an earlier control (not tested)`);
                    continue;
                }
                report.push(`- **${c.id || c.label}** — THREW: ${msg.slice(0, 90)}`);
                dead.push({ route, c, why: 'threw: ' + msg.slice(0, 60) });
                continue;
            }
            await page.waitForTimeout(180);
            const after = await snapshot(page);
            const diff = changed(before, after);
            tested++;
            if (diff.length === 0) {
                report.push(`- **${c.id || c.label}** (${c.tag}${c.type ? '/' + c.type : ''}) — **NO EFFECT**`);
                dead.push({ route, c, why: 'inert' });
            } else {
                report.push(`- \`${c.id || c.label}\` — ${diff.join(', ')}`);
            }

            const hash = await page.evaluate(() => location.hash);
            if (hash !== route) {
                await page.goto('/' + route);
                await page.waitForTimeout(2500);
                await openEverything(page);
                await instrument(page);
                await controls(page);          // re-stamp after the re-render
            }
        }
    }

    const head = [
        '# UI audit', '',
        `Routes: ${PAGES.join(', ')}`,
        `Controls operated: **${tested}**`,
        `With no measurable effect: **${dead.length}**`,
        `External links recorded: **${externals.length}**`,
        `Removed mid-sweep by another control: **${removed.length}**`,
        `Console errors during the sweep: **${consoleErrors.length}**`, '',
        consoleErrors.length ? '## Console errors\n\n' + consoleErrors.slice(0, 20).map((e) => '- ' + e).join('\n') + '\n' : '',
        dead.length
            ? '## Inert controls\n\n' + dead.map((d) => `- ${d.route} \`${d.c.id || d.c.label}\` (${d.c.tag}) — ${d.why}`).join('\n') + '\n'
            : '## No inert controls found\n',
    ].join('\n');

    fs.writeFileSync('scratch/ui-audit.md', head + report.join('\n') + '\n');
    console.log(head);

    expect(tested, 'the sweep actually operated controls').toBeGreaterThan(60);
    expect(consoleErrors, 'no console errors while operating the whole UI').toEqual([]);
    expect(dead.map((d) => `${d.route} ${d.c.id || d.c.label} (${d.why})`), 'every visible control does something').toEqual([]);
});

test('every internal link points at a real route', async ({ page }) => {
    await page.goto('/#main');
    await page.waitForTimeout(5000);

    const bad = [];
    for (const route of PAGES) {
        await page.goto('/' + route);
        await page.waitForTimeout(2500);
        const links = await page.evaluate(() =>
            [...document.querySelectorAll('a[href^="#"]')]
                .map((a) => ({ href: a.getAttribute('href'), label: (a.textContent || '').trim().slice(0, 30) }))
                .filter((l) => l.href.length > 1));
        const routes = await page.evaluate(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            return pm ? Object.keys(pm.pages) : [];
        });
        // An in-page anchor is not a route. #bio-section on the About page is a "Skip to
        // bio" accessibility link pointing at an element, and demanding it be a route is
        // what this test asked for first. Only flag hashes that are neither.
        const anchors = await page.evaluate(() =>
            [...document.querySelectorAll('[id]')].map((e) => e.id));
        for (const l of links) {
            const target = l.href.slice(1);
            if (routes.includes(target) || anchors.includes(target)) continue;
            bad.push(`${route}: "${l.label}" → ${l.href} (neither a route nor an element on the page)`);
        }
    }
    expect(bad, 'no link points at a route that does not exist').toEqual([]);
});

test('the back button, hash edits and deep links all navigate', async ({ page }) => {
    // handlePopState was an empty stub, so none of these worked: the URL changed and the
    // page did not. Every one of them is something a visitor does without thinking.
    const state = () => page.evaluate(() => {
        const pm = window.pageManager || (window.app && window.app.pageManager);
        return { current: pm ? pm.currentPage : null, hash: location.hash };
    });

    await page.goto('/#main');
    await page.waitForTimeout(5000);
    await page.locator('header a[href="#projects"]').first().click();
    await page.waitForTimeout(2500);
    expect((await state()).current, 'clicking a nav link navigates').toBe('projects');

    await page.goBack();
    await page.waitForTimeout(2500);
    const back = await state();
    expect(back.current, 'BACK returns to the previous page, not just the previous URL').toBe('main');
    expect(back.hash).toBe('#main');

    await page.goForward();
    await page.waitForTimeout(2500);
    expect((await state()).current, 'FORWARD works too').toBe('projects');

    // An address-bar edit: same document, new hash.
    await page.goto('/#contact');
    await page.waitForTimeout(2500);
    expect((await state()).current, 'editing the hash navigates').toBe('contact');

    // A hash set from script, which is what an un-intercepted in-page link does.
    await page.evaluate(() => { location.hash = '#life'; });
    await page.waitForTimeout(3000);
    expect((await state()).current, 'a scripted hash change navigates').toBe('life');

    // An unknown route must land somewhere sensible rather than blanking the page.
    await page.evaluate(() => { location.hash = '#no-such-page'; });
    await page.waitForTimeout(2500);
    const unknown = await state();
    expect(['main', 'life'], 'an unknown hash falls back rather than blanking').toContain(unknown.current);
    const empty = await page.evaluate(() => document.getElementById('page-container').children.length === 0);
    expect(empty, 'the page is never left empty').toBe(false);
});

test('an in-page anchor does not navigate away', async ({ page }) => {
    // The regression the hashchange listener introduced: an unknown hash was treated as
    // an unknown ROUTE and fell back to the home page, so the About page's "Skip to bio"
    // link threw the visitor off the page they were reading.
    await page.goto('/#about');
    await page.waitForTimeout(3000);
    const current = () => page.evaluate(() => {
        const pm = window.pageManager || (window.app && window.app.pageManager);
        return pm ? pm.currentPage : null;
    });
    expect(await current()).toBe('about');

    await page.evaluate(() => { location.hash = '#bio-section'; });
    await page.waitForTimeout(1500);
    expect(await current(), 'a skip link must leave you on the page').toBe('about');

    // Junk hashes must not reset the page either.
    await page.evaluate(() => { location.hash = '#nonsense-xyz'; });
    await page.waitForTimeout(1500);
    expect(await current(), 'an unknown hash leaves the page alone').toBe('about');
});
