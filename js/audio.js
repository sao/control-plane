(function () {
  'use strict';
  const CP = (globalThis.CP = globalThis.CP || {});

  // All sound is synthesised. No audio files.
  const A = {
    ctx: null, master: null, sfxGain: null, musGain: null,
    sfxVol: 0.7, musVol: 0.45, lastTick: 0, musicOn: false, timer: null, step: 0, nextT: 0, intensity: 0,

    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createDynamicsCompressor();
      this.master.threshold.value = -14; this.master.ratio.value = 6;
      this.master.connect(c.destination);
      this.sfxGain = c.createGain(); this.sfxGain.gain.value = this.sfxVol; this.sfxGain.connect(this.master);
      this.musGain = c.createGain(); this.musGain.gain.value = this.musVol * 0.5; this.musGain.connect(this.master);
      // Shared noise buffer.
      const len = c.sampleRate * 1;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // Simple feedback delay for space on the music bus.
      const delay = c.createDelay(1); delay.delayTime.value = 0.36;
      const fb = c.createGain(); fb.gain.value = 0.32;
      const wet = c.createGain(); wet.gain.value = 0.35;
      this.musGain.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.master);
    },
    setVolumes(sfx, music) {
      this.sfxVol = sfx; this.musVol = music;
      if (!this.ctx) return;
      this.sfxGain.gain.value = sfx;
      this.musGain.gain.value = music * 0.5;
    },

    tone(freq, dur, opts) {
      const c = this.ctx; if (!c) return;
      opts = opts || {};
      const t = c.currentTime + (opts.at || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = opts.type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
      const v = opts.vol == null ? 0.2 : opts.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + (opts.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(opts.bus || this.sfxGain);
      o.start(t); o.stop(t + dur + 0.02);
    },
    hiss(dur, opts) {
      const c = this.ctx; if (!c) return;
      opts = opts || {};
      const t = c.currentTime + (opts.at || 0);
      const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const f = c.createBiquadFilter(); f.type = opts.type || 'bandpass';
      f.frequency.setValueAtTime(opts.freq || 1200, t);
      if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
      f.Q.value = opts.q || 1;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(opts.vol || 0.2, t + (opts.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.sfxGain);
      s.start(t); s.stop(t + dur + 0.02);
    },

    sfx(name, arg) {
      if (!this.ctx || this.sfxVol <= 0) return;
      const now = this.ctx.currentTime;
      switch (name) {
        case 'click': this.tone(660, 0.05, { type: 'triangle', vol: 0.12 }); break;
        case 'hover': this.tone(1200, 0.02, { vol: 0.03 }); break;
        case 'buy': this.tone(392, 0.09, { type: 'triangle', vol: 0.2 }); this.tone(587, 0.09, { type: 'triangle', vol: 0.2, at: 0.07 }); this.tone(784, 0.16, { type: 'triangle', vol: 0.2, at: 0.14 }); break;
        case 'on': this.tone(520, 0.07, { type: 'square', vol: 0.07 }); this.tone(780, 0.09, { type: 'square', vol: 0.07, at: 0.06 }); break;
        case 'off': this.tone(520, 0.07, { type: 'square', vol: 0.07 }); this.tone(350, 0.1, { type: 'square', vol: 0.07, at: 0.06 }); break;
        case 'deny': this.tone(180, 0.12, { type: 'sawtooth', vol: 0.1 }); break;
        case 'serve': {
          if (now - this.lastTick < 0.07) return;
          this.lastTick = now;
          const n = [0, 2, 4, 7, 9][(arg || 0) % 5];
          this.tone(880 * Math.pow(2, n / 12), 0.045, { vol: 0.035 });
          break;
        }
        case 'block': this.hiss(0.12, { freq: 3200, q: 4, vol: 0.09 }); this.tone(1320, 0.12, { vol: 0.07 }); break;
        case 'refuse': this.tone(150, 0.09, { type: 'triangle', vol: 0.12, to: 90 }); break;
        case 'damage': this.tone(110, 0.4, { type: 'sawtooth', vol: 0.28, to: 38 }); this.hiss(0.3, { type: 'lowpass', freq: 1800, to: 200, vol: 0.3 }); break;
        case 'card': this.tone(880, 0.12, { vol: 0.12 }); this.tone(1174, 0.2, { vol: 0.1, at: 0.09 }); break;
        case 'right': [523, 659, 784].forEach((f, i) => this.tone(f, 0.14, { type: 'triangle', vol: 0.16, at: i * 0.06 })); break;
        case 'wrong': this.tone(233, 0.28, { type: 'sawtooth', vol: 0.13 }); this.tone(247, 0.28, { type: 'sawtooth', vol: 0.13 }); break;
        case 'wave': this.hiss(0.7, { freq: 300, to: 4000, q: 2, vol: 0.14, attack: 0.3 }); this.tone(196, 0.5, { type: 'triangle', vol: 0.18, at: 0.25 }); this.tone(294, 0.6, { type: 'triangle', vol: 0.14, at: 0.25 }); break;
        case 'clear': [392, 523, 659].forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', vol: 0.15, at: i * 0.08 })); break;
        case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.2, at: i * 0.1 })); this.tone(262, 0.9, { type: 'sine', vol: 0.2, at: 0.1 }); break;
        case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, { type: 'sawtooth', vol: 0.12, at: i * 0.16 })); break;
        case 'star': this.tone(1047 * Math.pow(2, (arg || 0) * 4 / 12), 0.4, { type: 'triangle', vol: 0.22 }); this.tone(2093 * Math.pow(2, (arg || 0) * 4 / 12), 0.3, { vol: 0.08, at: 0.02 }); break;
        case 'streak': [1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.08, { vol: 0.07, at: i * 0.04 })); break;
        case 'rewind': this.tone(1400, 0.6, { type: 'triangle', vol: 0.16, to: 200 }); this.hiss(0.6, { freq: 5000, to: 300, q: 3, vol: 0.12 }); break;
        case 'alarm': [0, 0.22, 0.44].forEach((at) => { this.tone(740, 0.12, { type: 'square', vol: 0.1, at }); this.tone(554, 0.1, { type: 'square', vol: 0.1, at: at + 0.11 }); }); break;
        case 'xp': this.tone(700 + (arg || 0) * 60, 0.05, { type: 'triangle', vol: 0.08 }); break;
        case 'rank': [392, 523, 659, 784, 1047, 1568].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', vol: 0.18, at: i * 0.09 })); break;
      }
    },

    // ---- ambient music: slow pad chords and a sparse pluck line, scheduled ahead of time.
    startMusic() {
      if (!this.ctx || this.musicOn) return;
      this.musicOn = true; this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 120);
    },
    stopMusic() { this.musicOn = false; clearInterval(this.timer); },
    schedule() {
      const c = this.ctx;
      if (!c || c.state !== 'running' || this.musVol <= 0) { if (c) this.nextT = c.currentTime + 0.1; return; }
      const CH = [[57, 60, 64, 71], [53, 57, 60, 67], [48, 55, 64, 67], [55, 59, 62, 69]]; // Am9, Fmaj9, Cmaj, G6
      const beat = 0.42 - this.intensity * 0.1;
      while (this.nextT < c.currentTime + 0.4) {
        const s = this.step, t = this.nextT - c.currentTime;
        const chord = CH[Math.floor(s / 16) % 4];
        if (s % 16 === 0) {
          for (const n of chord) this.pad(midi(n - 12), beat * 16, t);
          this.tone(midi(chord[0] - 24), beat * 14, { type: 'sine', vol: 0.16, at: t, attack: 0.4, bus: this.musGain });
        }
        const pat = this.intensity > 0.5 ? [0, 2, 1, 3, 2, 1, 3, 2] : [0, -1, 2, -1, 1, -1, -1, 3];
        const k = pat[s % 8];
        if (k >= 0) this.tone(midi(chord[k] + (s % 16 >= 8 ? 12 : 0)), beat * 1.6, { type: 'triangle', vol: 0.05 + this.intensity * 0.03, at: t, bus: this.musGain });
        if (this.intensity > 0.5 && s % 4 === 0) this.tone(midi(chord[0] - 24), 0.12, { type: 'sine', vol: 0.14, at: t, to: 40, bus: this.musGain });
        this.step++; this.nextT += beat;
      }
    },
    pad(freq, dur, at) {
      const c = this.ctx, t = c.currentTime + at;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700 + this.intensity * 600; f.Q.value = 0.5;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.035, t + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      for (const det of [-6, 6]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 0.05);
      }
      f.connect(g); g.connect(this.musGain);
    },
  };
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  CP.audio = A;
})();
