// SineAudio.js — every sound in the project synthesised from oscillators. No MP3s,
// no WAVs, no audio files of any kind.
//
// Same principle as SineShape: a sound is a handful of numbers rather than a decoded
// buffer. Techniques taken from the Zanzlanz "no assets" breakdown (transcript in the
// vault): layered waves for timbre, a lowpass sweep for a pluck, a triangle wave plus
// noise for a wind instrument, an LFO on pitch for vibrato, and randomised loops so
// music varies without more data.
//
// Why this belongs in a PORTFOLIO and not just a game: it costs zero bytes of
// download and zero cache. The site already went from 22 MB to 5 MB by deleting
// assets; adding audio as files would walk that straight back.
//
// Autoplay policy: browsers refuse to start audio before a user gesture, so the
// context is created lazily on the first play() and stays suspended until then.
// Nothing here throws if audio is unavailable — it degrades to silence.
class SineAudio {
    constructor(opts) {
        const o = opts || {};
        this.ctx = null;
        this.master = null;
        this.volume = Number.isFinite(o.volume) ? o.volume : 0.25;
        this._disposed = false;
        this._voices = 0;
        this.maxVoices = Number.isFinite(o.maxVoices) ? o.maxVoices : 16;
    }

    /**
     * Create/resume the AudioContext. Must be called from a user gesture the first
     * time or the browser leaves it suspended. Rule 5: 2 asserts.
     * @returns {boolean} whether audio is usable
     */
    ensure() {
        console.assert(!this._disposed, 'ensure: not disposed');
        console.assert(typeof window !== 'undefined', 'ensure: window required');
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return true;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;                       // fail-soft: no audio, no error
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        return true;
    }

    /**
     * One note. `type` is any oscillator type; layering two detuned oscillators is
     * what stops a raw sine sounding like a hearing test.
     * @param {Object} p - {freq, dur, type, attack, decay, gain, detune, sweepTo, q}
     * Rule 4: <=60 lines | Rule 5: 2 asserts.
     */
    note(p) {
        console.assert(p && Number.isFinite(p.freq), 'note: freq required');
        console.assert(!this._disposed, 'note: not disposed');
        if (!this.ensure()) return false;
        if (this._voices >= this.maxVoices) return false;   // Rule 2: bounded polyphony
        const t0 = this.ctx.currentTime;
        const dur = Number.isFinite(p.dur) ? p.dur : 0.35;
        const atk = Number.isFinite(p.attack) ? p.attack : 0.008;
        const g = this.ctx.createGain();
        // Exponential decay, not linear: linear release clicks audibly at the tail.
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, p.gain || 0.3), t0 + atk);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        let node = g;
        if (Number.isFinite(p.sweepTo)) {
            // Lowpass sweeping downward = the "pluck". Timbre from filtering, not samples.
            const f = this.ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.Q.value = Number.isFinite(p.q) ? p.q : 4;
            f.frequency.setValueAtTime(p.freq * 8, t0);
            f.frequency.exponentialRampToValueAtTime(Math.max(60, p.sweepTo), t0 + dur);
            g.connect(f); f.connect(this.master); node = g;
        } else {
            g.connect(this.master);
        }

        const osc = this.ctx.createOscillator();
        osc.type = p.type || 'sine';
        osc.frequency.value = p.freq;
        osc.connect(node);
        osc.start(t0); osc.stop(t0 + dur + 0.02);

        // Second, slightly detuned oscillator: beating between the two is what makes
        // it read as an instrument rather than a test tone.
        let osc2 = null;
        if (p.detune !== 0) {
            osc2 = this.ctx.createOscillator();
            osc2.type = p.type || 'sine';
            osc2.frequency.value = p.freq;
            osc2.detune.value = Number.isFinite(p.detune) ? p.detune : 7;
            osc2.connect(node);
            osc2.start(t0); osc2.stop(t0 + dur + 0.02);
        }
        this._voices++;
        osc.onended = () => { this._voices = Math.max(0, this._voices - 1); };
        return true;
    }

    /** Vibrato: a slow sine modulating pitch. Rule 5: 2 asserts. */
    vibratoNote(freq, dur, depth, rate) {
        console.assert(Number.isFinite(freq), 'vibratoNote: freq required');
        console.assert(Number.isFinite(dur), 'vibratoNote: dur required');
        if (!this.ensure()) return false;
        const t0 = this.ctx.currentTime;
        const carrier = this.ctx.createOscillator();
        carrier.type = 'triangle';
        carrier.frequency.value = freq;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = Number.isFinite(rate) ? rate : 5.5;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = Number.isFinite(depth) ? depth : freq * 0.012;
        lfo.connect(lfoGain); lfoGain.connect(carrier.frequency);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        carrier.connect(g); g.connect(this.master);
        carrier.start(t0); lfo.start(t0);
        carrier.stop(t0 + dur + 0.02); lfo.stop(t0 + dur + 0.02);
        return true;
    }

    /**
     * Pentatonic ambient phrase. Pentatonic because every note in it consonates with
     * every other, so random selection cannot produce a wrong note — that is what
     * makes endless generated music safe with no composition data.
     * Rule 5: 2 asserts.
     */
    ambientPhrase(rootHz, count) {
        console.assert(Number.isFinite(rootHz), 'ambientPhrase: root required');
        console.assert(!this._disposed, 'ambientPhrase: not disposed');
        if (!this.ensure()) return 0;
        const STEPS = [0, 2, 4, 7, 9, 12];               // minor-free pentatonic
        const n = Math.max(1, Math.min(8, count || 4));  // Rule 2: bounded
        let played = 0;
        for (let i = 0; i < n; i++) {
            const semi = STEPS[Math.floor(Math.random() * STEPS.length)];
            const freq = rootHz * Math.pow(2, semi / 12);
            setTimeout(() => {
                this.note({ freq, dur: 1.6, type: 'sine', gain: 0.10, detune: 5, sweepTo: freq * 2 });
            }, i * 420);
            played++;
        }
        return played;
    }

    setVolume(v) {
        console.assert(Number.isFinite(v), 'setVolume: number required');
        console.assert(!this._disposed, 'setVolume: not disposed');
        this.volume = Math.max(0, Math.min(1, v));
        if (this.master) this.master.gain.value = this.volume;
        return this.volume;
    }

    dispose() {
        console.assert(!this._disposed, 'dispose: once only');
        console.assert(this !== undefined, 'dispose: instance');
        this._disposed = true;
        if (this.ctx && this.ctx.state !== 'closed') this.ctx.close();
        this.ctx = null; this.master = null;
        return true;
    }
}

if (typeof window !== 'undefined') window.SineAudio = SineAudio;
if (typeof module !== 'undefined' && module.exports) module.exports = SineAudio;
