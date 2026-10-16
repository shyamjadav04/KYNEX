// KYNEX Stage 7 — CameraController extracted from the verified Stage 6 runtime.
// @ts-nocheck
import * as pc from "playcanvas";
import { CFG } from "../core/GameConfig";
import { M } from "../core/MathUtils";

class CameraController {
  constructor(app, camera, player) {
    this.app = app; this.cam = camera; this.player = player;
    this.pos = CFG.camera.pos.clone();
    this.cur = new pc.Vec3(0, CFG.camera.pos.y, CFG.camera.pos.z);
    this.lookX = 0; this.lookY = CFG.camera.look.y;
    this.shake = 0; this.shakeEnabled = true; this.bob = 0; this.fov = CFG.camera.fov; this.roll = 0;
    this._tmp = new pc.Vec3();
  }
  impulse(a) { this.shake = Math.min(1.1, this.shake + a); }
  reset() { this.shake = 0; this.cur.set(0, CFG.camera.pos.y, CFG.camera.pos.z); this.fov = CFG.camera.fov; }
  update(dt, speedNorm, phase, menuMode) {
    const p = this.player;
    // lag the lateral follow so lane changes read as movement
    const tx = menuMode ? Math.sin(phase * 0.25) * 2.4 : p.x * 0.62;
    const ty = CFG.camera.pos.y + (menuMode ? 0.4 : p.y * 0.34 - (p.sliding ? 0.42 : 0));
    const tz = CFG.camera.pos.z + (menuMode ? 1.5 : -speedNorm * 0.6);
    this.cur.x = M.damp(this.cur.x, tx, 7.5, dt);
    this.cur.y = M.damp(this.cur.y, ty, 9, dt);
    this.cur.z = M.damp(this.cur.z, tz, 6, dt);

    this.bob = Math.sin(phase * 2) * 0.022 * (menuMode ? 0.2 : 1);
    this.shake = Math.max(0, this.shake - dt * 2.6);
    const sh = this.shakeEnabled ? this.shake * this.shake : 0;
    const sx = (Math.random() - .5) * sh * 0.55, sy = (Math.random() - .5) * sh * 0.45;

    this.cam.setLocalPosition(this.cur.x + sx, this.cur.y + this.bob + sy, this.cur.z);
    this.lookX = M.damp(this.lookX, menuMode ? 0 : p.x * 0.30, 6, dt);
    this.lookY = M.damp(this.lookY, CFG.camera.look.y + (menuMode ? 0.6 : p.y * 0.42), 7, dt);
    this._tmp.set(this.lookX, this.lookY, CFG.camera.look.z);
    this.cam.lookAt(this._tmp);
    // Cheap camera polish: a very small bank during lane movement gives the
    // runner a sense of momentum without adding post-processing or lights.
    const targetRoll = menuMode ? 0 : (-p.x / 3) * (1.0 + speedNorm * 0.8);
    this.roll = M.damp(this.roll, targetRoll, 8.5, dt);
    if (sh > 0.001) this.cam.rotateLocal(0, 0, (Math.random() - .5) * sh * 3.5);
    if (Math.abs(this.roll) > 0.01) this.cam.rotateLocal(0, 0, this.roll);

    const targetFov = CFG.camera.fov + speedNorm * CFG.camera.fovBoost + (menuMode ? -4 : 0);
    this.fov = M.damp(this.fov, targetFov, 3.5, dt);
    this.cam.camera.fov = this.fov;
  }
}

export { CameraController };
