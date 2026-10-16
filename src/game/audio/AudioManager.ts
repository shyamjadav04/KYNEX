// KYNEX Stage 7 — AudioManager extracted from the verified Stage 6 runtime.
// @ts-nocheck

class AudioManager {
  constructor() { this.ctx = null; this.sfx = true; this.music = true; this.musicTimer = null; this.step = 0; }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musBus = this.ctx.createGain(); this.musBus.gain.value = 0.22; this.musBus.connect(this.master);
  }
  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  _tone(freq, dur, type, gain, sweepTo, bus) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || .25, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus); o.start(t); o.stop(t + dur + .05);
  }
  _noise(dur, cutoff, gain, sweep) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, sweep), t + dur);
    const g = this.ctx.createGain(); g.gain.value = gain || .3;
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus); src.start(t);
  }
  play(name) {
    if (!this.ctx || !this.sfx) return;
    switch (name) {
      case 'coin': this._tone(1180, .09, 'triangle', .18); setTimeout(() => this._tone(1760, .12, 'triangle', .15), 45); break;
      case 'jump': this._tone(320, .18, 'sine', .22, 680); this._noise(.12, 1800, .10); break;
      case 'land': this._tone(120, .16, 'sine', .28, 60); this._noise(.16, 700, .18, 200); break;
      case 'slide': this._noise(.42, 2600, .16, 500); break;
      case 'step': this._noise(.05, 900, .05); break;
      case 'swipe': this._noise(.10, 3000, .06, 900); break;
      case 'hit': this._tone(150, .5, 'sawtooth', .3, 48); this._noise(.5, 1400, .3, 120); break;
      case 'ui': this._tone(720, .06, 'square', .10, 980); break;
      case 'over': this._tone(420, .8, 'sine', .2, 110); break;
    }
  }
  // sparse arpeggio + pulse, tempo follows the run
  startMusic(getSpeedNorm) {
    this.init(); if (!this.ctx) return;
    this.stopMusic();
    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
    const tick = () => {
      if (!this.music || !this.ctx) return;
      const k = getSpeedNorm ? getSpeedNorm() : 0;
      const n = scale[(this.step * 3) % scale.length] * (this.step % 8 < 4 ? 1 : 1.5);
      this._tone(n, .34, 'triangle', .07, null, this.musBus);
      if (this.step % 4 === 0) this._tone(110, .32, 'sine', .14, 70, this.musBus);
      if (this.step % 8 === 6) this._tone(n * 2, .2, 'square', .03, null, this.musBus);
      this.step++;
      this.musicTimer = setTimeout(tick, 340 - k * 90);
    };
    tick();
  }
  stopMusic() { if (this.musicTimer) clearTimeout(this.musicTimer); this.musicTimer = null; }
  setMusic(on, getSpeedNorm) { this.music = on; if (on) this.startMusic(getSpeedNorm); else this.stopMusic(); }
}

export { AudioManager };
