// @ts-nocheck
import * as pc from 'playcanvas';
import { CFG } from '../core/GameConfig';
import { M } from '../core/MathUtils';

class PlayerController {
  constructor(app, rig, anim, vfx, audio) {
    this.app = app; this.rig = rig; this.anim = anim; this.vfx = vfx; this.audio = audio;
    this.reset();
    this.collider = { x: 0, yMin: 0, yMax: CFG.player.height, halfW: CFG.player.radius };
  }
  reset() {
    this.lane = 1; this.fromX = 0; this.toX = 0; this.x = 0; this.laneT = 1;
    this.y = 0; this.vy = 0; this.grounded = true;
    this.sliding = false; this.slideT = 0;
    this.dead = false; this.landT = 0; this.coyote = 0;
    this.bufJump = 0; this.bufSlide = 0; this.lean = 0;
    this.footPhase = 0;
    if (this.anim) this.anim.play('RUN', 0.3);
    if (this.rig) { this.rig.root.setLocalPosition(0, 0, 0); this.rig.root.setLocalEulerAngles(0, 0, 0); }
  }
  command(cmd) {
    if (this.dead) return;
    switch (cmd) {
      case 'MOVE_LEFT': this._lane(-1); break;
      case 'MOVE_RIGHT': this._lane(1); break;
      case 'JUMP': this._jump(); break;
      case 'SLIDE': this._slide(); break;
    }
  }
  _lane(dir) {
    const next = M.clamp(this.lane + dir, 0, CFG.lanes.length - 1);
    if (next === this.lane && this.laneT >= 1) { this.anim.lean = this.anim.lean + dir * 0.15; return; }
    this.lane = next; this.fromX = this.x; this.toX = CFG.lanes[next]; this.laneT = 0;
    this.audio && this.audio.play('swipe');
  }
  _jump() {
    if (!this.grounded && this.coyote <= 0) { this.bufJump = 0.18; return; }
    if (this.sliding) this._endSlide();
    this.vy = CFG.jumpVelocity; this.grounded = false; this.coyote = 0;
    this.anim.play('JUMP_START', 0.10);   // anticipation + takeoff, no input delay
    this.vfx.dust(this.worldPos(), 7);
    this.audio && this.audio.play('jump');
    this.onJump && this.onJump();
  }
  _slide() {
    if (!this.grounded) { this.vy = Math.min(this.vy, -9); this.bufSlide = 0.20; return; }
    this.sliding = true; this.slideT = 0;
    this.anim.play('SLIDE', 0.10);
    this.vfx.dust(this.worldPos(), 6);
    this.audio && this.audio.play('slide');
  }
  _endSlide() { this.sliding = false; this.anim.play('SLIDE_RECOVER', 0.12); }
  kill() {
    if (this.dead) return;
    this.dead = true; this.sliding = false;
    this.anim.play('HIT', 0.10);
    this.vfx.impact(this.worldPos());
    this.audio && this.audio.play('hit');
  }
  worldPos() { return new pc.Vec3(this.x, this.y + 0.6, 0); }

  update(dt, speed, speedNorm) {
    // --- lanes ---
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / CFG.laneChangeTime);
      const e = M.easeInOutCubic(this.laneT);
      this.x = M.lerp(this.fromX, this.toX, e);
      const dir = Math.sign(this.toX - this.fromX);
      this.lean = dir * Math.sin(Math.PI * this.laneT) * 0.9;
    } else {
      this.x = this.toX;
      this.lean = M.damp(this.lean, 0, 9, dt);
    }

    // --- vertical ---
    if (!this.grounded) {
      this.vy += CFG.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0; this.grounded = true;
        const hard = this.vy < -12;
        this.vy = 0; this.landT = 0.20;
        if (!this.dead) {
          this.anim.play('LAND', 0.07);
          this.vfx.dust(this.worldPos(), hard ? 10 : 6);
          this.audio && this.audio.play('land');
          this.onLand && this.onLand(hard);
          if (this.bufSlide > 0) { this.bufSlide = 0; this._slide(); }
        }
      }
    } else {
      this.coyote = 0.09;
      if (this.bufJump > 0) { this.bufJump = 0; this._jump(); }
    }
    this.coyote -= dt; this.bufJump -= dt; this.bufSlide -= dt;

    // --- slide window ---
    if (this.sliding) {
      this.slideT += dt;
      if (this.slideT >= CFG.slideTime) this._endSlide();
    }

    // --- animation state resolution ---
    if (!this.dead) {
      if (this.landT > 0) { this.landT -= dt; if (this.landT <= 0 && this.grounded && !this.sliding) this.anim.play('RUN', 0.16); }
      if (!this.grounded && !this.sliding) {
        if (this.anim.state === 'JUMP_START') { if (this.anim.stateTime > 0.12) this.anim.play('JUMP', 0.14); }
        else if (this.vy > 1.2) this.anim.play('JUMP', 0.10);
        else if (this.anim.state !== 'FALL') this.anim.play('FALL', 0.16);
      }
      // rise out of the slide before the run cycle takes back over
      if (this.grounded && !this.sliding && this.anim.state === 'SLIDE_RECOVER' && this.anim.stateTime > 0.22)
        this.anim.play('RUN', 0.17);
    }

    // --- transform + collider ---
    this.rig.root.setLocalPosition(this.x, this.y, 0);
    this.anim.update(dt, this.dead ? 0 : speed, speedNorm, this.lean);
    const h = this.sliding ? CFG.player.slideHeight : CFG.player.height;
    this.collider.x = this.x; this.collider.yMin = this.y + 0.05; this.collider.yMax = this.y + h;

    // footfall dust while running flat out
    if (this.grounded && !this.sliding && !this.dead) {
      this.footPhase += dt * speed;
      if (this.footPhase > 1.65) { this.footPhase = 0; if (speedNorm > .35) this.vfx.dust(new pc.Vec3(this.x, 0.08, 0.2), 2); this.audio && this.audio.play('step'); }
    }
  }
}

export { PlayerController };
