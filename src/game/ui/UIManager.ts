// KYNEX Stage 7 — UIManager extracted from the verified Stage 6 runtime.
// @ts-nocheck

class UIManager {
  constructor(game) {
    this.g = game;
    this.el = id => document.getElementById(id);
    this.layers = ['hud', 'menu', 'controls', 'settings', 'pause', 'over'];
    this.score = this.el('score'); this.coins = this.el('coins'); this.dist = this.el('dist');
    this.speedFill = this.el('speedFill');
    this.speedReadout = this.el('speedReadout');
    this.zoneChip = this.el('zoneChip'); this.zoneName = this.el('zoneName');
    this.runStateChip = this.el('runStateChip'); this.runState = this.el('runState');
    this.comboChip = this.el('comboChip'); this.comboVal = this.el('comboVal'); this.comboMeta = this.el('comboMeta');
    this.bestScore = this.el('bestScore');
    this._score = -1; this._coins = -1; this._dist = -1; this._zone = null; this._combo = 1;
    if ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0)) {
      const ui = document.getElementById('ui'); if (ui) ui.classList.add('touch-active');
    }
    this._wire();
  }
  static humanizeZone(name) {
    if (!name) return '';
    return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
  }
  show(name, on) {
    const e = this.el(name); if (!e) return;
    e.classList.toggle('on', on !== false);
    const sheet = e.querySelector('.sheet');
    if (sheet) { if (on === false) sheet.classList.remove('in'); else requestAnimationFrame(() => sheet.classList.add('in')); }
  }
  only(names) { for (const l of this.layers) this.show(l, names.indexOf(l) >= 0); }
  _btn(id, fn) { const b = this.el(id); if (b) b.addEventListener('click', () => { this.g.audio.resume(); this.g.audio.play('ui'); fn(); }); }
  _toggle(id, initial, fn) {
    const t = this.el(id); if (!t) return;
    t.setAttribute('aria-pressed', String(initial));
    const flip = () => {
      const v = t.getAttribute('aria-pressed') !== 'true';
      t.setAttribute('aria-pressed', String(v)); this.g.audio.play('ui'); fn(v);
    };
    t.addEventListener('click', flip);
    t.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); flip(); } });
  }
  _wire() {
    const g = this.g;
    this._btn('btnPlay', () => g.startRun());
    this._btn('btnControls', () => this.only(['controls']));
    this._btn('btnControlsBack', () => this.only(['menu']));
    this._btn('btnSettings', () => this.only(['settings']));
    this._btn('btnBody', () => g.toggleBodyControl());
    this._btn('btnSettingsBack', () => this.only(['menu']));
    this._btn('btnResume', () => g.resume());
    this._btn('btnQuit', () => g.toMenu());
    this._btn('btnRetry', () => g.startRun());
    this._btn('btnMenu', () => g.toMenu());
    this._toggle('tgMusic', true, v => g.audio.setMusic(v, () => g.speedNorm));
    this._toggle('tgSfx', true, v => g.audio.sfx = v);
    this._toggle('tgShadows', true, v => g.env.setShadows(v));
    this._toggle('tgShake', true, v => g.cam.shakeEnabled = v);
    this._toggle('tgQuality', true, v => g.setHighRes(v));
    this._btn('btnPause', () => g.togglePause());
    // touch buttons fire on pointerdown, not click, so the input reaches the
    // player on the same frame as a tap — click adds a ~100-300ms platform delay
    const touchCmd = (id, cmd) => {
      const b = this.el(id); if (!b) return;
      const fire = ev => { ev.preventDefault(); this.g.audio.resume(); this.g.input.emit(cmd, 'touchButton'); b.classList.add('pressed'); };
      b.addEventListener('pointerdown', fire);
      b.addEventListener('pointerup', () => b.classList.remove('pressed'));
      b.addEventListener('pointercancel', () => b.classList.remove('pressed'));
      b.addEventListener('contextmenu', e => e.preventDefault());
    };
    touchCmd('btnJump', 'JUMP');
    touchCmd('btnSlide', 'SLIDE');
  }
  setHUD(score, coins, distance, speedNorm, zone) {
    const s = Math.floor(score);
    if (s !== this._score) { this._score = s; this.score.textContent = s.toLocaleString(); }
    if (coins !== this._coins) {
      this._coins = coins; this.coins.textContent = coins;
      this.coins.classList.remove('pop'); void this.coins.offsetWidth; this.coins.classList.add('pop');
    }
    const d = Math.floor(distance);
    if (d !== this._dist) { this._dist = d; this.dist.textContent = d; }
    const pct = Math.round(Math.max(0, Math.min(1, speedNorm)) * 100);
    this.speedFill.style.width = (8 + speedNorm * 92) + '%';
    if (this.speedReadout) this.speedReadout.textContent = pct + '%';
    if (zone && zone !== this._zone) { this._zone = zone; this.zoneName.textContent = UIManager.humanizeZone(zone); }
  }
  setCombo(mult, streak = 0) {
    this._combo = mult;
    if (this.comboVal) this.comboVal.textContent = 'x' + mult;
    if (this.comboMeta) this.comboMeta.textContent = 'streak ' + streak;
    if (this.comboChip) this.comboChip.classList.toggle('on', mult > 1);
    if (mult > 1 && this.comboChip) { this.comboChip.classList.remove('pop'); void this.comboChip.offsetWidth; this.comboChip.classList.add('pop'); }
  }
  setRunState(label, active = true) {
    if (this.runState) this.runState.textContent = label;
    if (this.runStateChip) { this.runStateChip.classList.toggle('live', active); this.runStateChip.classList.toggle('idle', !active); }
  }
  setBestScore(v) { if (this.bestScore) this.bestScore.textContent = Math.floor(v).toLocaleString(); }
  toast(msg) {
    const t = this.el('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('in');
    clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('in'), 1100);
  }
  flash(a) {
    const f = this.el('flash');
    f.style.transition = 'none'; f.style.opacity = a;
    requestAnimationFrame(() => { f.style.transition = 'opacity .5s ease'; f.style.opacity = 0; });
  }
  gameOver(score, coins, dist, best, isBest, maxCombo = 1) {
    this.el('oScore').textContent = Math.floor(score).toLocaleString();
    this.el('oCoins').textContent = coins;
    this.el('oDist').textContent = Math.floor(dist) + ' m';
    this.el('oBest').textContent = Math.floor(best).toLocaleString();
    const maxComboEl = this.el('oMaxCombo'); if (maxComboEl) maxComboEl.textContent = 'x' + maxCombo;
    this.el('overNote').textContent = isBest ? 'A new personal best' : 'The run ended at speed';
    this.setRunState('OVER', false);
    this.only(['hud', 'over']);
  }
  setBodyStatus(status, detail = '') {
    const button = this.el('btnBody');
    if (!button) return;
    const sub = button.querySelector('.sub');
    if (sub) sub.textContent = detail || (status === 'TRACKING' ? 'Webcam motion control active' : 'Enable lightweight webcam control');
    button.setAttribute('aria-pressed', status !== 'OFF' ? 'true' : 'false');
    button.classList.toggle('active', status !== 'OFF');
  }
  fps(v) { const t = this.el('fpsTag'); if (t) t.textContent = v + ' fps'; }
}

export { UIManager };
