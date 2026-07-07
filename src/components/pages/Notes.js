// Notes.js — notes UI for the launcher. List + editor with debounced autosave. Local-first
// via NotesStore. On store change ONLY the list re-renders (never the editor), so typing
// never loses focus. classic script, window global. NASA Power-of-10: >=2 asserts/method,
// methods <=60 lines, bounded, graceful fallback.

class Notes {
    constructor(root, store) {
        console.assert(root && root.nodeType === 1, 'Notes: root element required');
        console.assert(store && typeof store.list === 'function', 'Notes: NotesStore required');
        this.root = root;
        this.store = store;
        this.editingId = null;
        this._saveTimer = null;
        this._onClick = this._handleClick.bind(this);
        this._onInput = this._handleInput.bind(this);
    }

    mount() {
        console.assert(this.root, 'mount: root required');
        console.assert(this.store, 'mount: store required');
        var self = this;
        this.root.innerHTML = '<div class="notes-wrap"><aside class="notes-list" id="notes-list"></aside>' +
            '<section class="notes-editor" id="notes-editor"></section></div>';
        this.root.addEventListener('click', this._onClick);
        this.root.addEventListener('input', this._onInput);
        this.store.onChange(function () { self._renderList(); });
        this._renderList();
        var first = this.store.list()[0];
        this._openEditor(first ? first.id : null);
        return true;
    }

    dispose() {
        console.assert(this.root, 'dispose: root');
        console.assert(this._onClick, 'dispose: handler');
        if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
        this.root.removeEventListener('click', this._onClick);
        this.root.removeEventListener('input', this._onInput);
        return true;
    }

    _renderList() {
        console.assert(this.root, '_renderList: root');
        console.assert(this.store, '_renderList: store');
        var el = this.root.querySelector('#notes-list');
        if (!el) return false;
        var self = this, notes = this.store.list();
        var items = notes.length ? notes.map(function (n) {
            var sel = n.id === self.editingId ? ' active' : '';
            var title = n.title.trim() || '(untitled)';
            var preview = n.body.replace(/\s+/g, ' ').trim().slice(0, 48);
            return '<button class="note-item' + sel + '" data-note="open" data-id="' + Notes._esc(n.id) + '">' +
                '<span class="note-item-title">' + Notes._esc(title) + '</span>' +
                '<span class="note-item-preview">' + Notes._esc(preview) + '</span></button>';
        }).join('') : '<p class="notes-empty">No notes yet.</p>';
        el.innerHTML = '<button class="control-btn notes-new" data-note="new">+ New note</button>' +
            '<div class="note-items">' + items + '</div>';
        return true;
    }

    _openEditor(id) {
        console.assert(this.root, '_openEditor: root');
        console.assert(id === null || typeof id === 'string', '_openEditor: id');
        var el = this.root.querySelector('#notes-editor');
        if (!el) return false;
        this.editingId = id;
        var n = id ? this.store.get(id) : null;
        if (!n) {
            el.innerHTML = '<div class="notes-placeholder">Select a note, or create a new one.</div>';
            this._syncListActive();
            return true;
        }
        el.innerHTML =
            '<div class="note-edit-head">' +
                '<input type="text" class="note-title-in" data-note="title" value="' + Notes._esc(n.title) + '" placeholder="Title" maxlength="120" aria-label="Note title">' +
                '<button class="note-del" data-note="del" data-id="' + Notes._esc(n.id) + '" aria-label="Delete note">Delete</button>' +
            '</div>' +
            '<textarea class="note-body-in" data-note="body" placeholder="Write your note… (saved automatically)" aria-label="Note body">' + Notes._esc(n.body) + '</textarea>' +
            '<span class="note-saved" id="note-saved"></span>';
        this._syncListActive();
        return true;
    }

    _syncListActive() {
        var self = this;
        var items = this.root.querySelectorAll('.note-item');
        items.forEach(function (it) { it.classList.toggle('active', it.getAttribute('data-id') === self.editingId); });
        return true;
    }

    _handleClick(e) {
        console.assert(e && e.target, '_handleClick: event');
        console.assert(this.store, '_handleClick: store');
        var el = e.target.closest('[data-note]');
        if (!el) return;
        var kind = el.getAttribute('data-note');
        if (kind === 'new') {
            var rec = this.store.upsert({ title: '', body: '' });
            this._openEditor(rec.id);
            var t = this.root.querySelector('.note-title-in'); if (t) t.focus();
        } else if (kind === 'open') {
            this._openEditor(el.getAttribute('data-id'));
        } else if (kind === 'del') {
            e.preventDefault();
            this.store.remove(el.getAttribute('data-id'));
            var next = this.store.list()[0];
            this._openEditor(next ? next.id : null);
        }
    }

    // Debounced autosave from the editor inputs. Does NOT re-render the editor. <=60 lines.
    _handleInput(e) {
        console.assert(e && e.target, '_handleInput: event');
        console.assert(this.store, '_handleInput: store');
        var field = e.target.getAttribute && e.target.getAttribute('data-note');
        if (field !== 'title' && field !== 'body') return;
        if (!this.editingId) return;
        var self = this;
        var saved = this.root.querySelector('#note-saved');
        if (saved) saved.textContent = 'saving…';
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(function () {
            var cur = self.store.get(self.editingId) || { id: self.editingId };
            var titleEl = self.root.querySelector('.note-title-in');
            var bodyEl = self.root.querySelector('.note-body-in');
            self.store.upsert({ id: self.editingId, title: titleEl ? titleEl.value : cur.title, body: bodyEl ? bodyEl.value : cur.body });
            var s = self.root.querySelector('#note-saved'); if (s) s.textContent = 'saved';
        }, 400);
    }

    static _esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c];
        });
    }
}

if (typeof window !== 'undefined') window.Notes = Notes;
if (typeof module !== 'undefined' && module.exports) module.exports = { Notes: Notes };
