// Calendar.js — month-grid calendar UI for the launcher. Local-first via CalendarStore;
// re-renders on any store change (including remote sync). classic script, window global.
// NASA Power-of-10: bounded loops, >=2 asserts/method, methods <=60 lines, graceful fallback.

class Calendar {
    constructor(root, store) {
        console.assert(root && root.nodeType === 1, 'Calendar: root element required');
        console.assert(store && typeof store.forDate === 'function', 'Calendar: CalendarStore required');
        this.root = root;
        this.store = store;
        var now = new Date();
        this.viewYear = now.getFullYear();
        this.viewMonth = now.getMonth();               // 0-11
        this.selected = this._iso(now);
        this._MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        this._DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        this._onClick = this._handleClick.bind(this);
        this._onSubmit = this._handleSubmit.bind(this);
    }

    mount() {
        console.assert(this.root, 'mount: root required');
        console.assert(this.store, 'mount: store required');
        var self = this;
        this.store.onChange(function () { self.render(); });
        this.root.addEventListener('click', this._onClick);
        this.root.addEventListener('submit', this._onSubmit);
        this.render();
        return true;
    }

    dispose() {
        console.assert(this.root, 'dispose: root');
        console.assert(this._onClick, 'dispose: handler');
        this.root.removeEventListener('click', this._onClick);
        this.root.removeEventListener('submit', this._onSubmit);
        return true;
    }

    // yyyy-mm-dd for a Date. Rule 5: 2 asserts.
    _iso(d) {
        console.assert(d instanceof Date, '_iso: Date required');
        console.assert(!isNaN(d.getTime()), '_iso: valid date');
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return d.getFullYear() + '-' + m + '-' + day;
    }

    // 6x7 matrix of ISO date strings covering the view month. <=60 lines.
    _matrix() {
        console.assert(Number.isInteger(this.viewMonth), '_matrix: month int');
        console.assert(Number.isInteger(this.viewYear), '_matrix: year int');
        var first = new Date(this.viewYear, this.viewMonth, 1);
        var start = new Date(first);
        start.setDate(1 - first.getDay());             // back up to the Sunday
        var weeks = [];
        for (var w = 0; w < 6; w++) {
            var row = [];
            for (var d = 0; d < 7; d++) {
                var cell = new Date(start);
                cell.setDate(start.getDate() + (w * 7 + d));
                row.push(cell);
            }
            weeks.push(row);
        }
        return weeks;
    }

    render() {
        console.assert(this.root, 'render: root');
        console.assert(this.store, 'render: store');
        var counts = this.store.countsByDate();
        var todayIso = this._iso(new Date());
        this.root.innerHTML =
            '<div class="cal-wrap">' +
                this._renderGrid(counts, todayIso) +
                this._renderDayPanel() +
            '</div>';
        return true;
    }

    _renderGrid(counts, todayIso) {
        var self = this, weeks = this._matrix();
        var head = '<div class="cal-head">' +
            '<button class="cal-nav" data-cal="prev" aria-label="Previous month">&#8249;</button>' +
            '<h3 class="cal-title">' + this._MONTHS[this.viewMonth] + ' ' + this.viewYear + '</h3>' +
            '<button class="cal-nav" data-cal="next" aria-label="Next month">&#8250;</button>' +
            '<button class="cal-nav cal-today" data-cal="today">Today</button></div>';
        var dow = '<div class="cal-dow">' + this._DOW.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>';
        var body = '<div class="cal-grid">';
        weeks.forEach(function (row) {
            row.forEach(function (cell) {
                var iso = self._iso(cell);
                var other = cell.getMonth() !== self.viewMonth ? ' cal-other' : '';
                var today = iso === todayIso ? ' cal-is-today' : '';
                var sel = iso === self.selected ? ' cal-selected' : '';
                var n = counts[iso] || 0;
                var dot = n ? '<span class="cal-dot">' + (n > 3 ? '&#8226;&#8226;&#8226;' : Array(n + 1).join('&#8226;')) + '</span>' : '';
                body += '<button class="cal-cell' + other + today + sel + '" data-cal="day" data-date="' + iso + '">' +
                    '<span class="cal-num">' + cell.getDate() + '</span>' + dot + '</button>';
            });
        });
        body += '</div>';
        return '<div class="cal-month">' + head + dow + body + '</div>';
    }

    _renderDayPanel() {
        var evs = this.store.forDate(this.selected);
        var list = evs.length
            ? evs.map(function (e) {
                return '<li class="cal-ev"><span class="cal-ev-time">' + (e.time ? Calendar._esc(e.time) : 'all day') + '</span>' +
                    '<span class="cal-ev-title">' + Calendar._esc(e.title) + '</span>' +
                    '<button class="cal-ev-del" data-cal="del" data-id="' + Calendar._esc(e.id) + '" aria-label="Delete event">&times;</button></li>';
            }).join('')
            : '<li class="cal-empty">No events. Add one below.</li>';
        return '<div class="cal-day">' +
            '<h4 class="cal-day-title">' + Calendar._esc(this.selected) + '</h4>' +
            '<ul class="cal-ev-list">' + list + '</ul>' +
            '<form class="cal-form" data-cal="add">' +
                '<input type="time" name="time" class="cal-input cal-time" aria-label="Event time">' +
                '<input type="text" name="title" class="cal-input cal-title-in" placeholder="New event…" maxlength="80" required aria-label="Event title">' +
                '<button type="submit" class="control-btn cal-add">Add</button>' +
            '</form></div>';
    }

    _handleClick(e) {
        console.assert(e && e.target, '_handleClick: event');
        console.assert(this.store, '_handleClick: store');
        var el = e.target.closest('[data-cal]');
        if (!el) return;
        var kind = el.getAttribute('data-cal');
        if (kind === 'prev') { this._shift(-1); }
        else if (kind === 'next') { this._shift(1); }
        else if (kind === 'today') { var t = new Date(); this.viewYear = t.getFullYear(); this.viewMonth = t.getMonth(); this.selected = this._iso(t); this.render(); }
        else if (kind === 'day') { this.selected = el.getAttribute('data-date'); this.render(); }
        else if (kind === 'del') { e.preventDefault(); this.store.remove(el.getAttribute('data-id')); }
    }

    _handleSubmit(e) {
        console.assert(e && e.target, '_handleSubmit: event');
        console.assert(this.store, '_handleSubmit: store');
        if (!e.target.matches('[data-cal="add"]')) return;
        e.preventDefault();
        var title = (e.target.title && e.target.title.value || '').trim();
        var time = (e.target.time && e.target.time.value) || '';
        if (!title) return;
        this.store.upsert({ date: this.selected, time: time, title: title });
        e.target.reset();
    }

    _shift(delta) {
        console.assert(delta === 1 || delta === -1, '_shift: +/-1');
        console.assert(Number.isInteger(this.viewMonth), '_shift: month');
        this.viewMonth += delta;
        if (this.viewMonth < 0) { this.viewMonth = 11; this.viewYear--; }
        else if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
        this.render();
        return true;
    }

    static _esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c];
        });
    }
}

if (typeof window !== 'undefined') window.Calendar = Calendar;
if (typeof module !== 'undefined' && module.exports) module.exports = { Calendar: Calendar };
