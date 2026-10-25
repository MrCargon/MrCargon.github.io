// StudioPage.js — controller for #studio (studioPage.html).
//
// Data comes from src/data/studio/content.json, which Helm's Studio tab writes. That
// file is DATA, not markup: every value is placed with textContent / setAttribute, and
// every link and thumbnail URL must be https on an allow-listed host, so a bad row can at
// worst render as a dead card — never as script.
//
// Privacy: no third-party frame or image is requested until the visitor asks for it. The
// live players sit behind click-to-load facades; thumbnails exist only once real items do.
class StudioPage {
    constructor() {
        this.root = null;
        this.data = null;
        this.topic = 'all';
        this._handlers = [];
        this._aborted = false;
    }

    static get DATA_URL() { return 'src/data/studio/content.json'; }
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
            tiktok: 'TikTok', instagram: 'Instagram', odysee: 'Odysee'
        };
    }
    // Hosts a card or channel link may point at. Anything else is dropped.
    static get LINK_HOSTS() {
        return ['youtube.com', 'youtu.be', 'twitch.tv', 'discord.gg', 'discord.com',
            'tiktok.com', 'instagram.com', 'odysee.com', 'mrcargon.github.io'];
    }
    // Hosts a thumbnail may load from — must match img-src in index.html's CSP.
    static get IMG_HOSTS() { return ['i.ytimg.com', 'static-cdn.jtvnw.net']; }

    async init() {
        this.root = document.getElementById('studio-section');
        if (!this.root) { console.warn('[Studio] section missing'); return false; }
        this._bindStatic();
        try {
            const res = await fetch(StudioPage.DATA_URL, { cache: 'no-cache' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            this.data = StudioPage.normalise(await res.json());
        } catch (e) {
            console.warn('[Studio] content.json unavailable:', e && e.message);
            this.data = StudioPage.normalise({});
        }
        if (this._aborted) return false;
        this.renderItems();
        this.renderChannels();
        this.renderSchedule();
        return true;
    }

    cleanup() {
        this._aborted = true;
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

    static safeUrl(u, hosts) {
        if (typeof u !== 'string' || !u) return '';
        let url;
        try { url = new URL(u); } catch (e) { return ''; }
        if (url.protocol !== 'https:') return '';
        const h = url.hostname.toLowerCase();
        return hosts.some((ok) => h === ok || h.endsWith('.' + ok)) ? url.href : '';
    }

    static str(v, max) {
        return (typeof v === 'string' ? v : '').trim().slice(0, max || 200);
    }

    static normalise(raw) {
        const d = raw && typeof raw === 'object' ? raw : {};
        const kinds = ['video', 'short', 'post'];
        const items = (Array.isArray(d.items) ? d.items : []).slice(0, 300).map((it) => {
            if (!it || typeof it !== 'object') return null;
            const platform = StudioPage.str(it.platform, 20).toLowerCase();
            const id = StudioPage.str(it.id, 64);
            let url = StudioPage.safeUrl(it.url, StudioPage.LINK_HOSTS);
            const ytId = platform === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
            if (!url && ytId) url = 'https://www.youtube.com/watch?v=' + ytId;
            if (!url) return null;
            let thumb = StudioPage.safeUrl(it.thumb, StudioPage.IMG_HOSTS);
            if (!thumb && ytId) thumb = 'https://i.ytimg.com/vi/' + ytId + '/hqdefault.jpg';
            return {
                platform, id, url, thumb,
                title: StudioPage.str(it.title, 160) || 'Untitled',
                topic: StudioPage.str(it.topic, 40),
                date: /^\d{4}-\d{2}-\d{2}/.test(it.date || '') ? it.date.slice(0, 10) : '',
                kind: kinds.includes(it.kind) ? it.kind : 'video'
            };
        }).filter(Boolean).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const channels = (Array.isArray(d.channels) ? d.channels : []).slice(0, 40).map((c) => {
            if (!c || typeof c !== 'object') return null;
            const platform = StudioPage.str(c.platform, 20).toLowerCase();
            return {
                platform,
                label: StudioPage.str(c.label, 60) || StudioPage.PLATFORMS[platform] || platform,
                handle: StudioPage.str(c.handle, 80),
                url: StudioPage.safeUrl(c.url, StudioPage.LINK_HOSTS),
                channelId: /^UC[A-Za-z0-9_-]{22}$/.test(c.channelId || '') ? c.channelId : ''
            };
        }).filter((c) => c && c.platform);
        const schedule = (Array.isArray(d.schedule) ? d.schedule : []).slice(0, 30).map((s) => {
            if (!s || typeof s !== 'object') return null;
            return {
                day: StudioPage.str(s.day, 20),
                time: /^\d{1,2}:\d{2}$/.test(s.time || '') ? s.time : '',
                tz: StudioPage.str(s.tz, 40),
                title: StudioPage.str(s.title, 120),
                platform: StudioPage.str(s.platform, 20).toLowerCase()
            };
        }).filter((s) => s && (s.day || s.title));
        return { updated: StudioPage.str(d.updated, 40), items, channels, schedule };
    }

    // ---------- live ----------

    _parents() {
        const set = new Set(['mrcargon.github.io', 'localhost']);
        if (location.hostname) set.add(location.hostname);
        return Array.from(set).map((p) => 'parent=' + encodeURIComponent(p)).join('&');
    }

    _ytChannelId() {
        const yt = this.data && this.data.channels.find((c) => c.platform === 'youtube' && c.channelId);
        return yt ? yt.channelId : StudioPage.YT_CHANNEL_ID;
    }

    _frame(src, title, cls) {
        const f = document.createElement('iframe');
        f.src = src;
        f.title = title;
        f.className = cls;
        f.loading = 'lazy';
        f.referrerPolicy = 'strict-origin-when-cross-origin';
        f.setAttribute('allowfullscreen', '');
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
            label = 'YouTube live player loaded. If the channel is offline it shows the next or last stream.';
        } else {
            return;
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
        if (topic !== 'all' && !StudioPage.TOPICS[topic]) return;
        this.topic = topic;
        this.root.querySelectorAll('.studio-chip').forEach((b) => {
            b.setAttribute('aria-pressed', String(b.dataset.topic === topic));
        });
        this.renderItems();
    }

    _card(it) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'studio-card';
        a.href = it.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        if (it.thumb) {
            const img = document.createElement('img');
            img.className = 'studio-thumb';
            img.src = it.thumb;
            img.alt = '';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            img.addEventListener('error', () => img.remove(), { once: true });
            a.appendChild(img);
        }
        const body = document.createElement('span');
        body.className = 'studio-card-body';
        const t = document.createElement('span');
        t.className = 'studio-card-title';
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
        if (!this.root || !this.data) return;
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
        const empty = this.root.querySelector('#studio-empty');
        if (empty) empty.hidden = total > 0;
        const count = this.root.querySelector('#studio-count');
        if (count) {
            const what = this.topic === 'all' ? 'all topics' : StudioPage.TOPICS[this.topic];
            count.textContent = total === 1 ? '1 item in ' + what : total + ' items in ' + what;
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
            name.textContent = c.label;
            const handle = document.createElement('span');
            handle.className = 'studio-channel-handle';
            handle.textContent = c.url ? (c.handle || c.url.replace(/^https:\/\//, '')) : 'coming soon';
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
