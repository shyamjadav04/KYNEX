// @ts-nocheck
import { M } from '../core/MathUtils';
import { J, POSES, RUN_PARAMS, FAST_PARAMS } from './PoseLibrary';
import { StrideSolver } from './StrideSolver';

class PlayerAnimationController {
  constructor(rig) {
    this.rig = rig;
    this.state = 'IDLE'; this.prev = 'IDLE';
    this.blend = 1; this.blendTime = 0.16;
    this.phase = 0; this.stateTime = 0; this.prevTime = 0;
    this.lean = 0; this.airT = 0;
    this._pose = { j: J(), y: 0, pitch: 0, roll: 0 };
    this._a = { j: J(), y: 0, pitch: 0 };
    this._b = { j: J(), y: 0, pitch: 0 };

    // solve both ends of the base blend once, at construction
    this.runSolve = StrideSolver.solve(POSES.RUN, RUN_PARAMS);
    this.fastSolve = StrideSolver.solve(POSES.FAST_RUN, FAST_PARAMS);
    this.cycle = this.runSolve.cycle;
    this.ground = this.runSolve.ground;
  }

  play(state, blendTime) {
    if (state === this.state) return;
    this.prev = this.state; this.prevTime = this.stateTime;
    this.state = state; this.stateTime = 0;
    this.blend = 0; this.blendTime = blendTime == null ? 0.16 : blendTime;
  }

  // RUN is really a two-pose blend tree: RUN at the low end of the speed
  // range, FAST_RUN at the cap, mixed by current speed
  _sample(state, out, t, k) {
    if (state === 'RUN') {
      const a = POSES.RUN(this.phase, k, t), b = POSES.FAST_RUN(this.phase, k, t);
      for (const n in a.j) { const A = a.j[n], B = b.j[n], o = out.j[n];
        o[0] = M.lerp(A[0], B[0], k); o[1] = M.lerp(A[1], B[1], k); o[2] = M.lerp(A[2], B[2], k); }
      out.y = M.lerp(a.y, b.y, k); out.pitch = 0;
      return out;
    }
    const p = POSES[state](this.phase, k, t);
    for (const n in p.j) { const P = p.j[n], o = out.j[n]; o[0] = P[0]; o[1] = P[1]; o[2] = P[2]; }
    out.y = p.y; out.pitch = p.pitch;
    return out;
  }

  /* additive lean layer: weight shift, shoulder roll and a counter-rotated
     head, applied on top of whatever base state is playing */
  _leanLayer(out, lean, airborne) {
    const j = out.j, L = lean;
    j.spine[2] += L * 7; j.spine[1] += -L * 5;
    j.hips[2] += L * 4; j.hips[1] += L * 3;
    // inside arm tucks, outside arm opens out for balance
    j.shoulderL[2] += L * 14; j.shoulderR[2] += L * 14;
    j.shoulderL[0] += -L * 10; j.shoulderR[0] += L * 10;
    if (airborne) { j.hipL[2] += L * 8; j.hipR[2] += L * 8; }
    else { j.hipL[2] += L * 5; j.hipR[2] += L * 3; }   // trailing leg crosses under
    // head stabilisation: cancel most of the torso's yaw and roll
    j.neck[1] -= j.spine[1] * 0.55; j.neck[2] -= j.spine[2] * 0.5;
    j.head[1] -= j.spine[1] * 0.25; j.head[2] -= L * 5;
  }

  update(dt, speed, speedNorm, leanTarget) {
    this.stateTime += dt; this.prevTime += dt;
    const k = M.clamp(speedNorm, 0, 1);

    // stride length for the current blend, measured not guessed: the body
    // covers exactly this distance per cycle, so the planted foot stays put
    this.cycle = M.lerp(this.runSolve.cycle, this.fastSolve.cycle, k);
    this.ground = M.lerp(this.runSolve.ground, this.fastSolve.ground, k);
    this.phase += (speed / Math.max(0.5, this.cycle)) * Math.PI * 2 * dt;
    if (this.phase > Math.PI * 2000) this.phase -= Math.PI * 2000;

    this.blend = Math.min(1, this.blend + dt / Math.max(0.0001, this.blendTime));
    const w = M.easeInOutCubic(this.blend);

    const a = this._sample(this.prev, this._a, this.prevTime, k);
    const b = this._sample(this.state, this._b, this.stateTime, k);
    const out = this._pose;
    for (const n in b.j) {
      const A = a.j[n], B = b.j[n], o = out.j[n];
      o[0] = M.lerp(A[0], B[0], w); o[1] = M.lerp(A[1], B[1], w); o[2] = M.lerp(A[2], B[2], w);
    }
    out.y = M.lerp(a.y, b.y, w);
    out.pitch = M.lerp(a.pitch, b.pitch, w);

    this.lean = M.damp(this.lean, leanTarget, 11, dt);
    const airborne = this.state === 'JUMP' || this.state === 'FALL' || this.state === 'JUMP_START';
    this._leanLayer(out, this.lean, airborne);

    this.rig.apply(out);
    if (this.rig.fx) {
      const pulse = 0.94 + 0.06 * (0.5 + 0.5 * Math.sin(this.phase * 2));
      const boost = 1 + k * 0.10;
      if (this.rig.fx.chestCore) this.rig.fx.chestCore.setLocalScale(.09 * pulse * boost, .09 * pulse * boost, .05);
      if (this.rig.fx.chestBar) this.rig.fx.chestBar.setLocalScale(.28 * boost, .022, .018);
    }
    const body = this.rig.body;
    // ground offset puts the lowest sole exactly on the road
    body.setLocalPosition(0, out.y + this.ground, 0);
    body.setLocalEulerAngles(out.pitch, -this.lean * 8, this.lean * 14);

    // contact shadow tightens on the ground and fades out with height
    const blob = this.rig.blob;
    if (blob) {
      const h = M.clamp(this.rig.root.getLocalPosition().y, 0, 3);
      const sc = M.clamp(1.15 - h * 0.22, 0.45, 1.25);
      blob.setLocalScale(sc, 1, sc * 1.3);
      blob.setLocalPosition(-this.rig.root.getLocalPosition().x * 0, 0.02 - this.rig.root.getLocalPosition().y, 0.06);
      blob.enabled = h < 2.6;
    }
    return out;
  }
}

export { PlayerAnimationController };
