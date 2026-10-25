// StudioPage.js — controller for #studio (studioPage.html).
//
// Data comes from src/data/studio/content.json, which Helm's Studio tab writes. That
// file is DATA, not markup: every value is placed with textContent / setAttribute, and
// every link and thumbnail URL must be https on an exact, per-platform host set, so a bad
// row can at worst be dropped — never rendered as script, and never blank the page.
//
// Privacy: no third-party frame or image is requested until the visitor asks for it. The
// live players sit behind click-to-load facades, and video thumbnails stay local
// placeholders until "Show thumbnails" is pressed.
//
// The router AWAITS init(), so init() must never wait on the network: a slow
// content.json used to hold the router for the whole fetch, and a click on another page
// during that wait was silently dropped. init() renders the skeleton and returns; the
// data loads in the background with a timeout and is ignored if the page was left.
class StudioPage {
    constructor() {
        this.root = null;
        this.data = StudioPage.normalise({});
        this.data.loaded = false;
        this.topic = 'all';
        this.showThumbs = false;
        this._handlers = [];
        this._aborted = false;
        this._ctrl = null;
        this._timer = null;
    }

    static get DATA_URL() { return 'src/data/studio/content.json'; }
    static get FETCH_TIMEOUT_MS() { return 5000; }
    static get TWITCH_CHANNEL() { return 'hoot_works_entertainment'; }
    static get YT_CHANNEL_ID() { return 'UC0hmWKIk87Ml9mZmmBATL6A'; }
    static get TOPICS() {
        return {
            'uu-devlog': 'UU devlog',
            'ai-helm-owls': 'AI · Helm · Owls',
            'gaming-modding': 'Gaming & modding',
            'drone-hardware': 'Drone & hardware'
        };
    }
    static get PLATFORMS() {
        return {
            youtube: 'YouTube', twitch: 'Twitch', discord: 'Discord',
            tiktok: 'TikTok', instagram: 'Instagram', odysee: 'Odysee', site: 'MrCargon'
        };
    }
    // EXACT hosts per platform (no suffix matching). A link must be on its own platform's
    // hosts: a "tiktok" row cannot point at youtube.com.
    static get PLATFORM_HOSTS() {
        return {
            youtube: ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'],
            twitch: ['www.twitch.tv', 'twitch.tv', 'clips.twitch.tv'],
            discord: ['discord.gg', 'discord.com', 'www.discord.com'],
            tiktok: ['www.tiktok.com', 'tiktok.com'],
            instagram: ['www.instagram.com', 'instagram.com'],
            odysee: ['odysee.com'],
            site: ['mrcargon.github.io']
        };
    }
    // Hosts a thumbnail may load from — must match img-src in index.html's CSP.
    static get IMG_HOSTS() { return ['i.ytimg.com', 'static-cdn.jtvnw.net']; }
    // Path-based redirectors on otherwise-allowed hosts (youtube.com/redirect?q=...).
    static get REDIRECT_PATH() { return /^\/(?:redirect|away|link|links|out|l|exit|leave)(?:\/|$)/i; }

    init() {
        this.root = document.getElementById('studio-section');
        if (!this.root) { console.warn('[Studio] section missing'); return false; }
        this._bindStatic();
        this.renderAll();          // skeleton: built-in channels, empty states
        this._load();              // deliberately NOT awaited — see header comment
        return true;
    }

    async _load() {
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        this._ctrl = ctrl;
        if (ctrl) this._timer = setTimeout(() => ctrl.abort(), StudioPage.FETCH_TIMEOUT_MS);
        let raw = null;
        try {
            const res = await fetch(StudioPage.DATA_URL, { cache: 'no-cache', signal: ctrl ? ctrl.signal : undefined });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            raw = await res.json();
        } catch (e) {
            if (!this._aborted) console.warn('[Studio] content.json unavailable:', e && (e.name === 'AbortError' ? 'timed out' : e.message));
        } finally {
            clearTimeout(this._timer);
            this._timer = null;
            this._ctrl = null;
        }
        // The visitor may have left (or come back to a NEW instance) while we waited.
        if (this._aborted || !this.root || !this.root.isConnected) return false;
        if (raw) this.data = StudioPage.normalise(raw);
        else this.data.loadFailed = true;
        this.renderAll();
        return true;
    }

    renderAll() {
        this.renderItems();
        this.renderChannels();
        this.renderSchedule();
    }

    cleanup() {
        this._aborted = true;
        if (this._ctrl) { try { this._ctrl.abort(); } catch (e) { /* already done */ } }
        clearTimeout(this._timer);
        for (const [el, type, fn] of this._handlers) el.removeEventListener(type, fn);
        this._handlers = [];
        // Removing the iframes stops playback and their network use immediately.
        if (this.root) this.root.querySelectorAll('.studio-embed').forEach((n) => n.remove());
        this.root = null;
    }

    _on(el, type, fn) {
        if (!el) return;
        el.addEventListener(type, fn);
        this._handlers.push([el, type, fn]);
    }

    _bindStatic() {
        const r = this.root;
        this._on(r, 'click', (ev) => {
            const t = ev.target.closest('button');
            if (!t || !r.contains(t)) return;
            if (t.dataset.load) { this.loadLive(t.dataset.load); return; }
            if (t.dataset.topic) { this.setTopic(t.dataset.topic); return; }
            if (t.id === 'studio-thumbs-toggle') { this.setThumbs(!this.showThumbs); return; }
            if (t.dataset.jump) {
                const target = document.getElementById(t.dataset.jump);
                if (target) {
                    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
                    target.focus({ preventScroll: true });
                }
            }
        });
    }

    // ---------- data ----------

    /** https only, exact host from `hosts`, no userinfo, no port, no redirector path. */
    static safeUrl(u, hosts) {
        if (typeof u !== 'string' || !u || !Array.isArray(hosts)) return '';
        let url;
        try { url = new URL(u); } catch (e) { return ''; }
        if (url.protocol !== 'https:') return '';
        if (url.username || url.password || url.port) return '';
        if (!hosts.includes(url.hostname.toLowerCase())) return '';
        if (StudioPage.REDIRECT_PATH.test(url.pathname)) return '';
        return url.href;
    }

    /** Text field: strings only, bidi overrides/isolates and zero-width chars removed. */
    static str(v, max) {
        if (typeof v !== 'string') return '';
        return v.replace(/[​-‏‪-‮⁦-⁩﻿]/g, '').trim().slice(0, max || 200);
    }

    /** A real calendar date (rejects 2026-13-99, 2026-02-30). */
    static date(v) {
        if (typeof v !== 'string') return '';
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
        if (!m) return '';
        const y = +m[1], mo = +m[2], d = +m[3];
        const t = new Date(Date.UTC(y, mo - 1, d));
        return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? m[0] : '';
    }

    /** 24 h HH:MM, 00:00-23:59. */
    static time(v) {
        if (typeof v !== 'string') return '';
        const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
        return m ? m[1].padStart(2, '0') + ':' + m[2] : '';
    }

    /** Map rows one at a time: a row that throws is dropped, never the whole list. */
    static rows(list, limit, fn) {
        if (!Array.isArray(list)) return [];
        const out = [];
        for (const row of list.slice(0, limit)) {
            try {
                const v = row && typeof row === 'object' && !Array.isArray(row) ? fn(row) : null;
                if (v) out.push(v);
            } catch (e) { /* bad row: skip it */ }
        }
        return out;
    }

    static item(it) {
        const platform = StudioPage.str(it.platform, 20).toLowerCase();
        const hosts = StudioPage.PLATFORM_HOSTS[platform];
        if (!hosts) return null;
        const id = StudioPage.str(it.id, 64);
        const ytId = platform === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
        let url = StudioPage.safeUrl(it.url, hosts);
        if (!url && ytId) url = 'https://www.youtube.com/watch?v=' + ytId;
        if (!url) return null;
        let thumb = StudioPage.safeUrl(it.thumb, StudioPage.IMG_HOSTS);
        if (!thumb && ytId) thumb = 'https://i.ytimg.com/vi/' + ytId + '/hqdefault.jpg';
        const kind = ['video', 'short', 'post'].includes(it.kind) ? it.kind : 'video';
        return {
            platform, id, url, thumb, kind,
            title: StudioPage.str(it.title, 160) || 'Untitled',
            topic: typeof it.topic === 'string' && StudioPage.TOPICS[it.topic] ? it.topic : '',
            date: StudioPage.date(it.date)
        };
    }

    static channel(c) {
        const platform = StudioPage.str(c.platform, 20).toLowerCase();
        const hosts = StudioPage.PLATFORM_HOSTS[platform];
        if (!hosts) return null;
        return {
            platform,
            label: StudioPage.str(c.label, 60) || StudioPage.PLATFORMS[platform],
            handle: StudioPage.str(c.handle, 80),
            url: StudioPage.safeUrl(c.url, hosts),
            channelId: typeof c.channelId === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(c.channelId) ? c.channelId : ''
        };
    }

    static slot(s) {
        const v = {
            day: StudioPage.str(s.day, 20),
            time: StudioPage.time(s.time),
            tz: StudioPage.str(s.tz, 40),
            title: StudioPage.str(s.title, 120),
            platform: StudioPage.str(s.platform, 20).toLowerCase()
        };
        return v.day || v.title ? v : null;
    }

    // Shown before content.json arrives, and kept if it never does.
    static get DEFAULT_CHANNELS() {
        return [
            { platform: 'youtube', label: 'YouTube', handle: '@hoot_works_entertainment', url: 'https://www.youtube.com/@hoot_works_entertainment' },
            { platform: 'twitch', label: 'Twitch', handle: 'hoot_works_entertainment', url: 'https://www.twitch.tv/hoot_works_entertainment' },
            { platform: 'discord', label: 'Discord', handle: 'Hoot Works', url: 'https://discord.gg/UaWrbXkfTK' }
        ];
    }

    static normalise(raw) {
        const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        const items = StudioPage.rows(d.items, 300, StudioPage.item)
            .sort((a, b) => b.date.localeCompare(a.date));
        let channels = StudioPage.rows(d.channels, 40, StudioPage.channel);
        if (!channels.length) channels = StudioPage.rows(StudioPage.DEFAULT_CHANNELS, 10, StudioPage.channel);
        const schedule = StudioPage.rows(d.schedule, 30, StudioPage.slot);
        return { updated: StudioPage.date(d.updated) || StudioPage.str(d.updated, 40), items, channels, schedule, loaded: true, loadFailed: false };
    }

    // ---------- live ----------

    _parents() {
        const set = new Set(['mrcargon.github.io', 'localhost']);
        if (location.hostname) set.add(location.hostname);
        return Array.from(set).map((p) => 'parent=' + encodeURIComponent(p)).join('&');
    }

    _ytChannelId() {
        const yt = this.data.channels.find((c) => c.platform === 'youtube' && c.channelId);
        return yt ? yt.channelId : StudioPage.YT_CHANNEL_ID;
    }

    _frame(src, title, cls) {
        const f = document.createElement('iframe');
        f.src = src;
        f.title = title;
        f.className = cls;
        f.loading = 'lazy';
        f.referrerPolicy = 'strict-origin-when-cross-origin';
        // Cross-origin already, so this mainly removes top-navigation from the frame.
        f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation');
        // allow="fullscreen" covers it; a separate allowfullscreen only triggers a console warning.
        f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
        return f;
    }

    loadLive(which) {
        if (!this.root) return;
        const box = this.root.querySelector('.studio-facade[data-live="' + which + '"]');
        if (!box || box.classList.contains('is-loaded')) return;
        const wrap = document.createElement('div');
        wrap.className = 'studio-embed';
        let label;
        if (which === 'twitch') {
            const ch = StudioPage.TWITCH_CHANNEL;
            const p = this._parents();
            wrap.appendChild(this._frame('https://player.twitch.tv/?channel=' + ch + '&' + p + '&muted=true',
                'Twitch live player: ' + ch, 'studio-frame-player'));
            wrap.appendChild(this._frame('https://www.twitch.tv/embed/' + ch + '/chat?' + p + '&darkpopout',
                'Twitch chat: ' + ch, 'studio-frame-chat'));
            label = 'Twitch player and chat loaded.';
        } else if (which === 'youtube') {
            wrap.appendChild(this._frame('https://www.youtube-nocookie.com/embed/live_stream?channel=' +
                encodeURIComponent(this._ytChannelId()), 'YouTube live player', 'studio-frame-player'));
            label = 'YouTube live player loaded.';
        } else {
            return;
        }
        // Keep a way out under every player: YouTube's live embed says "unavailable" when
        // the channel is offline, and Twitch shows an offline card.
        const out = box.querySelector('.studio-link');
        if (out) {
            const fallback = out.cloneNode(true);
            fallback.classList.add('studio-embed-link');
            wrap.appendChild(fallback);
        }
        const body = box.querySelector('.studio-facade-body');
        if (body) body.hidden = true;
        box.classList.add('is-loaded');
        box.appendChild(wrap);
        const first = wrap.querySelector('iframe');
        if (first) first.focus();
        const status = this.root.querySelector('#studio-live-status');
        if (status) status.textContent = label;
    }

    // ---------- videos ----------

    setTopic(topic) {
        if (!this.root || (topic !== 'all' && !StudioPage.TOPICS[topic])) return;
        this.topic = topic;
        this.root.querySelectorAll('.studio-chip[data-topic]').forEach((b) => {
            b.setAttribute('aria-pressed', String(b.dataset.topic === topic));
        });
        this.renderItems();
    }

    setThumbs(on) {
        if (!this.root) return;
        this.showThumbs = !!on;
        const b = this.root.querySelector('#studio-thumbs-toggle');
        if (b) {
            b.setAttribute('aria-pressed', String(this.showThumbs));
            b.textContent = this.showThumbs ? 'Hide thumbnails' : 'Show thumbnails';
        }
        this.renderItems();
    }

    _card(it) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'studio-card';
        a.href = it.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        if (it.thumb && this.showThumbs) {
            const img = document.createElement('img');
            img.className = 'studio-thumb';
            img.src = it.thumb;
            img.alt = '';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            img.addEventListener('error', () => img.remove(), { once: true });
            a.appendChild(img);
        } else {
            // Local placeholder: no request leaves the site until thumbnails are asked for.
            const ph = document.createElement('span');
            ph.className = 'studio-thumb studio-thumb-ph studio-ph-' + it.platform;
            ph.setAttribute('aria-hidden', 'true');
            ph.textContent = StudioPage.PLATFORMS[it.platform] || '';
            a.appendChild(ph);
        }
        const body = document.createElement('span');
        body.className = 'studio-card-body';
        const t = document.createElement('span');
        t.className = 'studio-card-title';
        t.dir = 'auto';
        t.textContent = it.title;
        const meta = document.createElement('span');
        meta.className = 'studio-card-meta';
        const parts = [StudioPage.PLATFORMS[it.platform] || it.platform];
        if (StudioPage.TOPICS[it.topic]) parts.push(StudioPage.TOPICS[it.topic]);
        if (it.date) parts.push(it.date);
        meta.textContent = parts.join(' · ');
        const sr = document.createElement('span');
        sr.className = 'visually-hidden';
        sr.textContent = ' (opens in a new tab)';
        body.append(t, meta, sr);
        a.appendChild(body);
        li.appendChild(a);
        return li;
    }

    renderItems() {
        if (!this.root) return;
        const shown = this.data.items.filter((it) => this.topic === 'all' || it.topic === this.topic);
        let total = 0;
        this.root.querySelectorAll('.studio-group').forEach((g) => {
            const list = g.querySelector('ul');
            list.replaceChildren();
            const mine = shown.filter((it) => it.kind === g.dataset.kind);
            mine.forEach((it) => list.appendChild(this._card(it)));
            g.hidden = mine.length === 0;
            total += mine.length;
        });
        const toggle = this.root.querySelector('#studio-thumbs-toggle');
        if (toggle) toggle.hidden = !this.data.items.some((it) => it.thumb);
        const pending = !this.data.loaded && !this.data.loadFailed;
        const empty = this.root.querySelector('#studio-empty');
        if (empty) empty.hidden = total > 0 || pending;
        const count = this.root.querySelector('#studio-count');
        if (count) {
            const what = this.topic === 'all' ? 'all topics' : StudioPage.TOPICS[this.topic];
            if (pending) count.textContent = 'Loading…';
            else if (this.data.loadFailed) count.textContent = 'Videos could not be loaded right now.';
            else count.textContent = total === 1 ? '1 item in ' + what : total + ' items in ' + what;
        }
    }

    // ---------- community + schedule ----------

    renderChannels() {
        const ul = this.root && this.root.querySelector('#studio-channels');
        if (!ul) return;
        ul.replaceChildren();
        this.data.channels.forEach((c) => {
            const li = document.createElement('li');
            const el = document.createElement(c.url ? 'a' : 'span');
            el.className = 'studio-channel' + (c.url ? '' : ' is-soon');
            if (c.url) { el.href = c.url; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
            const name = document.createElement('span');
            name.className = 'studio-channel-name';
            name.dir = 'auto';
            name.textContent = c.label;
            const handle = document.createElement('span');
            handle.className = 'studio-channel-handle';
            handle.dir = 'auto';
            if (c.url) {
                const u = new URL(c.url);
                handle.textContent = c.handle || (u.hostname + u.pathname).replace(/\/$/, '');
            } else {
                handle.textContent = 'coming soon';
            }
            el.append(name, handle);
            if (c.url) {
                const sr = document.createElement('span');
                sr.className = 'visually-hidden';
                sr.textContent = ' (opens in a new tab)';
                el.appendChild(sr);
            }
            li.appendChild(el);
            ul.appendChild(li);
        });
    }

    renderSchedule() {
        if (!this.root) return;
        const ul = this.root.querySelector('#studio-schedule-list');
        const empty = this.root.querySelector('#studio-schedule-empty');
        if (!ul) return;
        ul.replaceChildren();
        this.data.schedule.forEach((s) => {
            const li = document.createElement('li');
            li.className = 'studio-slot';
            const when = document.createElement('span');
            when.className = 'studio-slot-when';
            when.textContent = [s.day, s.time].filter(Boolean).join(' ');
            const what = document.createElement('span');
            what.className = 'studio-slot-what';
            what.dir = 'auto';
            what.textContent = s.title || 'Stream';
            const where = document.createElement('span');
            where.className = 'studio-slot-where';
            where.textContent = [StudioPage.PLATFORMS[s.platform] || s.platform, s.tz].filter(Boolean).join(' · ');
            li.append(when, what, where);
            ul.appendChild(li);
        });
        if (empty) empty.hidden = this.data.schedule.length > 0;
        const up = this.root.querySelector('#studio-updated');
        if (up) up.textContent = this.data.updated ? 'Updated ' + this.data.updated : '';
    }
}

if (typeof window !== 'undefined') window.StudioPage = StudioPage;
