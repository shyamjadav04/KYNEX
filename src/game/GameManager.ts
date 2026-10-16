// KYNEX Stage 7 — GameManager orchestration extracted from the working legacy engine.
// @ts-nocheck
import * as pc from "playcanvas";
import { CFG } from "./core/GameConfig";
import { M } from "./core/MathUtils";
import { DifficultyManager } from "./core/DifficultyManager";
import { EnvironmentManager } from "./world/EnvironmentManager";
import { ObstacleManager } from "./world/ObstacleManager";
import { CoinManager } from "./world/CoinManager";
import { PlayerRig } from "./player/PlayerRig";
import { PlayerAnimationController } from "./animation/AnimationController";
import { VFXManager } from "./effects/VFXManager";
import { PlayerController } from "./player/PlayerController";
import { PlayerCollision } from "./player/PlayerCollision";
import { InputManager } from "../controls/InputManager";
import { KeyboardController } from "../controls/KeyboardController";
import { TouchController } from "../controls/TouchController";
import { BodyController } from "../controls/BodyController";
import { TexF, MatLib } from "./world/TextureFactory";
import { TrackManager } from "./world/TrackManager";
import { CameraController } from "./camera/CameraController";
import { AudioManager } from "./audio/AudioManager";
import { UIManager } from "./ui/UIManager";
import { IS_MOBILE, Q } from "./core/PlatformQuality";
import { PerformanceProfiler } from "./core/PerformanceProfiler";

class GameManager {
  constructor(app, canvas) {
    this.app = app; this.canvas = canvas;
    this.state = 'MENU';
    this.diff = new DifficultyManager(CFG);
    this.speed = this.diff.speed; this.speedNorm = 0;
    this.runTime = 0; this.distance = 0; this.coinCount = 0; this.score = 0;
    this.timeScale = 1; this.deathT = 0;
    this.best = 0;
    this.maxCombo = 1;
    try { this.best = parseFloat(localStorage.getItem('kynex.best') || '0') || 0; } catch (e) {}
    this._fpsAcc = 0; this._fpsN = 0; this._fpsLow = 0; this.highRes = true;
    this.profiler = new PerformanceProfiler(app, this);
  }

  build(progress) {
    const app = this.app;
    progress(0.15, 'Weaving textures');
    TexF.init(app.graphicsDevice);
    MatLib.build();

    progress(0.45, 'Raising the city');
    this.root = new pc.Entity('World'); app.root.addChild(this.root);
    this.worldRoot = new pc.Entity('Scroll'); this.root.addChild(this.worldRoot);

    // camera
    this.camEnt = new pc.Entity('MainCamera');
    this.camEnt.addComponent('camera', {
      fov: CFG.camera.fov, nearClip: 0.12, farClip: Q.farClip,
      clearColor: new pc.Color(0.42, 0.40, 0.56)
    });
    try {
      if (pc.TONEMAP_NEUTRAL !== undefined) this.camEnt.camera.toneMapping = pc.TONEMAP_NEUTRAL;
      else if (pc.TONEMAP_ACES !== undefined) this.camEnt.camera.toneMapping = pc.TONEMAP_ACES;
      if (pc.GAMMA_SRGB !== undefined) this.camEnt.camera.gammaCorrection = pc.GAMMA_SRGB;
    } catch (e) {}
    this.camEnt.setLocalPosition(CFG.camera.pos.x, CFG.camera.pos.y, CFG.camera.pos.z);
    this.root.addChild(this.camEnt);

    // environment
    this.env = new EnvironmentManager(app, this.root).build();
    this.env.setShadows(Q.shadows);

    progress(0.62, 'Laying the track');
    this.obstacleRoot = new pc.Entity('Obstacles'); this.worldRoot.addChild(this.obstacleRoot);
    this.coinRoot = new pc.Entity('Coins'); this.worldRoot.addChild(this.coinRoot);
    this.obstacles = new ObstacleManager(app, this.obstacleRoot);
    this.coins = new CoinManager(app, this.coinRoot);
    this.track = new TrackManager(app, this.worldRoot, this.obstacles, this.coins);

    progress(0.82, 'Building the runner');
    this.vfx = new VFXManager(app, this.root);
    this.audio = new AudioManager();
    this.rig = new PlayerRig();
    this.root.addChild(this.rig.root);
    this.anim = new PlayerAnimationController(this.rig);
    this.player = new PlayerController(app, this.rig, this.anim, this.vfx, this.audio);
    this.player.onLand = hard => this.cam.impulse(hard ? 0.55 : 0.28);
    this.collision = new PlayerCollision(this.player, this.track, this.vfx, this.audio);
    this.cam = new CameraController(app, this.camEnt, this.player);

    progress(0.93, 'Binding controls');
    this.input = new InputManager();
    this.input.register(new KeyboardController({ onPause: () => this.togglePause() }));
    this.input.register(new TouchController(this.canvas));
    this.body = new BodyController();
    this.input.register(this.body);
    this.input.onCommand(cmd => { if (this.state === 'PLAYING' || this.state === 'MENU') this.player.command(cmd); });
    this.input.start();

    this.ui = new UIManager(this);
    this.body.setStatusListener((status, detail) => this.ui.setBodyStatus(status, detail));
    this.ui.setBodyStatus(this.body.currentStatus, 'Enable lightweight webcam control');
    this.diff.onTierChange = tier => { if (this.state === 'PLAYING') this.ui.toast(tier); };
    this.toMenu(true);
    app.on('update', dt => this.update(dt));
    return this;
  }

  /* ---- state ---- */
  toMenu(initial) {
    this.state = 'MENU';
    this.diff.reset();
    this.speed = CFG.speedStart * 0.8; this.speedNorm = 0; this.runTime = 0; this.distance = 0;
    this.coinCount = 0; this.score = 0; this.coinScore = 0; this.comboStreak = 0; this.comboLastT = -999; this.maxCombo = 1; this.timeScale = 1;
    this.player.reset(); this.cam.reset(); this.vfx.clear();
    this.track.reset(this.diff);
    this.track.clearAll();                                            // attract mode: clean road
    this.ui.only(['menu']);
    this.ui.setRunState('READY', false);
    this.ui.setBestScore(this.best);
    if (!initial) this.audio.play('ui');
  }
  startRun() {
    this.audio.resume();
    this.audio.setMusic(this.ui.el('tgMusic').getAttribute('aria-pressed') === 'true', () => this.speedNorm);
    this.state = 'PLAYING';
    this.diff.reset();
    this.speed = this.diff.speed; this.speedNorm = 0; this.runTime = 0; this.distance = 0;
    this.coinCount = 0; this.score = 0; this.coinScore = 0; this.comboStreak = 0; this.comboLastT = -999; this.maxCombo = 1;
    this.timeScale = 1; this.deathT = 0; this._milestone = 0;
    this.player.reset(); this.cam.reset(); this.vfx.clear(); this.track.reset(this.diff);
    this.ui.only(['hud']); this.ui.setRunState('LIVE', true); this.ui.setHUD(0, 0, 0, 0, this.track.currentDistrict()); this.ui.setCombo(1, 0); this.ui.toast('Run');
  }
  async toggleBodyControl() {
    await this.body.toggle();
  }

  togglePause() {
    if (this.state === 'PLAYING') { this.state = 'PAUSED'; this.ui.setRunState('PAUSED', false); this.ui.only(['hud', 'pause']); this.audio.stopMusic(); }
    else if (this.state === 'PAUSED') this.resume();
  }
  resume() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING'; this.ui.setRunState('LIVE', true); this.ui.only(['hud']);
    this.audio.setMusic(this.ui.el('tgMusic').getAttribute('aria-pressed') === 'true', () => this.speedNorm);
  }
  die() {
    if (this.state !== 'PLAYING') return;
    this.state = 'DYING'; this.deathT = 0;
    this.ui.setRunState('IMPACT', false);
    this.player.kill();
    this.cam.impulse(1.05);
    this.ui.flash(0.5);
    this.audio.play('over'); this.audio.stopMusic();
  }
  finish() {
    this.state = 'OVER';
    const isBest = this.score > this.best;
    if (isBest) { this.best = this.score; try { localStorage.setItem('kynex.best', String(Math.floor(this.best))); } catch (e) {} }
    this.ui.gameOver(this.score, this.coinCount, this.distance, this.best, isBest, this.maxCombo);
  }
  comboMultiplier(streak) {
    const t = CFG.comboThresholds;
    let m = 1;
    for (let i = 0; i < t.length; i++) if (streak >= t[i]) m = i + 1;
    return m;
  }
  setHighRes(v) {
    this.highRes = v;
    const cap = v ? Q.maxPixelRatio : Math.min(Q.maxPixelRatio, 0.85);
    this.app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, cap);
    this.app.resizeCanvas();
  }

  /* ---- frame ---- */
  update(rawDt) {
    let dt = Math.min(rawDt, 0.05);
    this.profiler.beginFrame();
    this._meterFps(rawDt);

    if (this.state === 'PAUSED' || this.state === 'OVER') { this.cam.update(dt, this.speedNorm, this.anim.phase, this.state !== 'PAUSED'); this.profiler.endFrame(rawDt); return; }

    if (this.state === 'DYING') {
      this.deathT += dt;
      this.timeScale = M.lerp(1, 0.22, M.clamp(this.deathT / 0.45, 0, 1));
      if (this.deathT > 1.15) this.finish();
    }
    dt *= this.timeScale;

    const menuMode = this.state === 'MENU';

    let difficulty = this.diff.difficulty;
    if (this.state === 'PLAYING') {
      this.runTime += dt;
      this.speed = this.diff.update(dt);          // DifficultyManager is the only owner of pace
      difficulty = this.diff.difficulty;
      this.speedNorm = this.diff.speedNorm;
    } else if (this.state === 'DYING') {
      this.speed = M.damp(this.speed, 0, 3.2, dt);
      this.speedNorm = M.clamp((this.speed - CFG.speedKeys[0].v) / (CFG.speedMax - CFG.speedKeys[0].v), 0, 1);
    }

    // world
    this.profiler.begin('track');
    this.track.update(dt, this.speed, menuMode ? -1 : difficulty);
    this.profiler.end('track');
    this.profiler.begin('obstacles');
    this.obstacles.update(dt, this.runTime);
    this.profiler.end('obstacles');
    this.profiler.begin('coins');
    this.coins.update(dt);
    this.profiler.end('coins');
    this.profiler.begin('env');
    this.env.update(dt, this.speed);
    this.profiler.end('env');

    // player
    this.profiler.begin('player');
    this.player.update(dt, this.speed, this.speedNorm);
    this.profiler.end('player');

    // gameplay resolution
    if (this.state === 'PLAYING') {
      this.distance += this.speed * dt;
      // combo decays on its own if the player goes quiet on coins, not only on pickup
      if (this.comboStreak > 0 && this.runTime - this.comboLastT > CFG.comboWindow) { this.comboStreak = 0; this.ui.setCombo(1, 0); }
      this.profiler.begin('collision');
      this.collision.test(
        pos => {
          this.coinCount++;
          this.comboStreak = (this.runTime - this.comboLastT <= CFG.comboWindow) ? this.comboStreak + 1 : 1;
          this.maxCombo = Math.max(this.maxCombo, this.comboStreak);
          this.comboLastT = this.runTime;
          const mult = this.comboMultiplier(this.comboStreak);
          this.coinScore += CFG.coinValue * mult;
          this.ui.setCombo(mult, this.comboStreak);
          this.vfx.coin(new pc.Vec3(pos.x, pos.y, pos.z));
          this.audio.play('coin');
          if (this.coinCount % 25 === 0) this.ui.toast(this.coinCount + ' coins');
        },
        () => this.die()
      );
      this.profiler.end('collision');
      this.score = this.distance + this.coinScore;
      this.ui.setHUD(this.score, this.coinCount, this.distance, this.speedNorm, this.track.currentDistrict());
      const milestone = Math.floor(this.distance / 500);
      if (milestone > (this._milestone || 0)) { this._milestone = milestone; this.ui.toast(milestone * 500 + ' m'); }
    }

    this.profiler.begin('vfx');
    this.vfx.update(dt, this.speed, this.speedNorm);
    this.profiler.end('vfx');
    const dname = this.track.currentDistrict();
    if (dname && this.track.districts[dname]) this.env.setDistrictTint(this.track.districts[dname].fogTint);
    this.profiler.begin('camera');
    this.cam.update(dt, this.speedNorm, this.anim.phase, menuMode);
    this.profiler.end('camera');
    this.profiler.endFrame(rawDt);
  }

  _meterFps(dt) {
    this._fpsAcc += dt; this._fpsN++;
    if (this._fpsAcc >= 0.5) {
      const fps = Math.round(this._fpsN / this._fpsAcc);
      this.ui && this.ui.fps(fps);
      this._fpsAcc = 0; this._fpsN = 0;
      // one automatic step down if the machine is struggling
      const lowFpsThreshold = IS_MOBILE ? 52 : 40;
      if (fps < lowFpsThreshold && this.highRes) {
        this._fpsLow++;
        if (this._fpsLow >= 3) {
          this.setHighRes(false);
          const t = document.getElementById('tgQuality'); if (t) t.setAttribute('aria-pressed', 'false');
        }
      } else if (IS_MOBILE && fps >= 58 && !this.highRes) {
        this.setHighRes(true);
        const t = document.getElementById('tgQuality'); if (t) t.setAttribute('aria-pressed', 'true');
        this._fpsLow = 0;
      } else this._fpsLow = 0;
    }
  }
}
export { GameManager };
