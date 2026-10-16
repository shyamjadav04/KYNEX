// @ts-nocheck
import { M } from '../core/MathUtils';
import { LEG } from '../player/PlayerRig';

const J = () => ({
  body: [0, 0, 0], hips: [0, 0, 0], spine: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  shoulderL: [0, 0, 0], shoulderR: [0, 0, 0], elbowL: [0, 0, 0], elbowR: [0, 0, 0],
  hipL: [0, 0, 0], hipR: [0, 0, 0], kneeL: [0, 0, 0], kneeR: [0, 0, 0], ankleL: [0, 0, 0], ankleR: [0, 0, 0]
});

/* ================================================================
   Leg IK. The run cycle is authored as a foot PATH, not as joint
   angles: during stance the sole sits flat on the road and travels
   straight backwards at exactly the body's speed; during swing it
   lifts and reaches forward again. Hip, knee and ankle are then
   solved to hit that path. This is what removes foot sliding — the
   contact is a constraint, not something eyeballed per joint.
   ================================================================ */
const DEG = 180 / Math.PI;
function legIK(targetZ, targetY, hipHeight, toeUp) {
  const ay = targetY + LEG.sole;              // ankle sits above a flat sole
  const dz = targetZ, dy = ay - hipHeight;
  let C = Math.hypot(dy, dz);
  const maxReach = LEG.thigh + LEG.shin - 0.012;
  if (C > maxReach) C = maxReach;
  const A = LEG.thigh, B = LEG.shin;
  const aim = Math.atan2(-dz, -dy);
  const alpha = Math.acos(M.clamp((A * A + C * C - B * B) / (2 * A * C), -1, 1));
  const beta = Math.acos(M.clamp((A * A + B * B - C * C) / (2 * A * B), -1, 1));
  const hip = aim + alpha;                    // knee leads forward, as a human knee does
  const knee = -(Math.PI - beta);
  const ankle = -(hip + knee) - (toeUp || 0) / DEG;
  return [hip * DEG, knee * DEG, ankle * DEG];
}

/* Shared run cycle. `stance` is the fraction of the cycle each foot
   spends planted; with the stride length it fixes how far the body
   travels per cycle, which the StrideSolver reads back to set cadence. */
function runCycle(p, o) {
  const j = J();
  const TAU = Math.PI * 2;
  const s = Math.sin(p), c = Math.cos(p);
  // body dips through mid-stance, twice per cycle
  const bodyY = -o.bob * 0.5 * (1 - Math.cos(p * 2)) * 0.5;
  const hipH = LEG.hipY + bodyY;

  const foot = (t) => {
    t = t - Math.floor(t);
    if (t < o.stance) {                        // planted: flat, straight back
      const u = t / o.stance;
      return [-o.stride * 0.5 + u * o.stride, 0, 0];
    }
    const u = (t - o.stance) / (1 - o.stance); // swing: lift, carry, reach
    const e = u * u * (3 - 2 * u);
    const z = o.stride * 0.5 - e * o.stride;
    const y = o.lift * Math.sin(Math.PI * u) * (0.75 + 0.25 * Math.sin(Math.PI * u));
    return [z, y, 10 * Math.sin(Math.PI * u)]; // toe-up through the swing
  };

  const tL = p / TAU, tR = tL + 0.5;
  const fL = foot(tL), fR = foot(tR);
  const L = legIK(fL[0], fL[1], hipH, fL[2]);
  const R = legIK(fR[0], fR[1], hipH, fR[2]);
  j.hipL = [L[0], 0, 2]; j.kneeL = [L[1], 0, 0]; j.ankleL = [L[2], 0, 0];
  j.hipR = [R[0], 0, -2]; j.kneeR = [R[1], 0, 0]; j.ankleR = [R[2], 0, 0];

  // arms counter-swing the legs; elbows stay boxed and tighten with pace
  j.shoulderL = [-56 * s * o.arm + 6, 6, 9];
  j.shoulderR = [56 * s * o.arm + 6, -6, -9];
  j.elbowL = [-(70 + o.elbow - 18 * s), 0, 0];
  j.elbowR = [-(70 + o.elbow + 18 * s), 0, 0];
  // torso leans with pace and counter-rotates against the legs
  j.spine = [o.lean + 2.2 * Math.cos(p * 2), -8 * s * o.arm, 1.5 * s];
  j.hips = [0, 7 * s * o.arm, -2 * s];
  j.neck = [-o.lean * 0.55, 6 * s * o.arm, 0];
  j.head = [0, 0, -2 * c];
  return { j, y: bodyY, pitch: 0, roll: 0 };
}

const RUN_PARAMS = { stance: 0.26, stride: 0.92, lift: 0.20, bob: 0.075, arm: 1.00, elbow: 0, lean: 9 };
const FAST_PARAMS = { stance: 0.21, stride: 1.04, lift: 0.26, bob: 0.095, arm: 1.18, elbow: 8, lean: 15 };

const POSES = {
  IDLE(p) {
    const j = J(), b = Math.sin(p * 0.9);
    j.spine = [3 + b * 1.2, 0, 0];
    j.neck = [-2, b * 2, 0];
    j.shoulderL = [4, 0, 7]; j.shoulderR = [4, 0, -7];
    j.elbowL = [-16, 0, 0]; j.elbowR = [-16, 0, 0];
    j.hipL = [-3, 0, 1]; j.hipR = [-3, 0, -1];
    j.kneeL = [-8, 0, 0]; j.kneeR = [-8, 0, 0];
    return { j, y: b * 0.012, pitch: 0, roll: 0 };
  },

  RUN(p) { return runCycle(p, RUN_PARAMS); },
  // FAST_RUN is the same cycle opened up: longer stride, deeper lean, tighter
  // arms. The base layer blends RUN -> FAST_RUN by current speed.
  FAST_RUN(p) { return runCycle(p, FAST_PARAMS); },

  // anticipation + takeoff: legs compress, then extend as the body rises
  JUMP_START(p, k, t) {
    const j = J();
    const u = M.clamp(t / 0.12, 0, 1);
    const crouch = Math.sin(u * Math.PI);             // dip then extend
    j.hipL = [34 * crouch + 10 * u, 0, 3]; j.hipR = [30 * crouch + 6 * u, 0, -3];
    j.kneeL = [-(66 * crouch + 8), 0, 0]; j.kneeR = [-(60 * crouch + 8), 0, 0];
    j.ankleL = [26 * crouch - 14 * u, 0, 0]; j.ankleR = [24 * crouch - 12 * u, 0, 0];
    j.shoulderL = [-40 - 70 * u, 10, 14]; j.shoulderR = [-34 - 58 * u, -10, -14];
    j.elbowL = [-58 + 20 * u, 0, 0]; j.elbowR = [-62 + 22 * u, 0, 0];
    j.spine = [16 * crouch - 6 * u, 0, 0]; j.neck = [-8 * crouch + 4 * u, 0, 0];
    return { j, y: -0.16 * crouch, pitch: 0, roll: 0 };
  },

  JUMP(p, k, t) {
    const j = J();
    const rise = M.clamp(t * 6, 0, 1);
    j.hipL = [48 * rise, 0, 3]; j.hipR = [20 * rise, 0, -3];
    j.kneeL = [-88 * rise, 0, 0]; j.kneeR = [-48 * rise, 0, 0];
    j.ankleL = [18, 0, 0]; j.ankleR = [8, 0, 0];
    j.shoulderL = [-116 * rise, 10, 16]; j.shoulderR = [-92 * rise, -10, -16];
    j.elbowL = [-36, 0, 0]; j.elbowR = [-48, 0, 0];
    j.spine = [-7 * rise, 0, 0]; j.neck = [5, 0, 0];
    return { j, y: 0, pitch: 0, roll: 0 };
  },

  // reaching for the ground: lead leg drops, arms come down to balance
  FALL(p, k, t) {
    const j = J();
    const u = M.clamp(t * 3.5, 0, 1);
    j.hipL = [24 + 6 * u, 0, 4]; j.hipR = [38 - 10 * u, 0, -4];
    j.kneeL = [-32 + 10 * u, 0, 0]; j.kneeR = [-60 + 14 * u, 0, 0];
    j.ankleL = [-8 - 6 * u, 0, 0]; j.ankleR = [2, 0, 0];
    j.shoulderL = [-60 + 18 * u, 14, 26]; j.shoulderR = [-46 + 14 * u, -14, -26];
    j.elbowL = [-54, 0, 0]; j.elbowR = [-60, 0, 0];
    j.spine = [12 - 4 * u, 0, 0]; j.neck = [-8, 0, 0];
    return { j, y: 0, pitch: 0, roll: 0 };
  },

  LAND(p, k, t) {
    const j = J();
    const c = 1 - M.clamp(t / 0.24, 0, 1);            // compression releases over the landing
    j.hipL = [36 * c, 0, 3]; j.hipR = [32 * c, 0, -3];
    j.kneeL = [-78 * c - 10, 0, 0]; j.kneeR = [-70 * c - 10, 0, 0];
    j.ankleL = [24 * c, 0, 0]; j.ankleR = [22 * c, 0, 0];
    j.shoulderL = [-30 - 26 * c, 8, 22]; j.shoulderR = [-26 - 24 * c, -8, -22];
    j.elbowL = [-70, 0, 0]; j.elbowR = [-70, 0, 0];
    j.spine = [22 * c + 8, 0, 0]; j.neck = [-15 * c, 0, 0];
    return { j, y: -0.32 * c, pitch: 0, roll: 0 };
  },

  SLIDE(p, k, t) {
    const j = J();
    const e = M.clamp(t * 9, 0, 1);
    j.hipL = [-6 * e, 0, 8]; j.hipR = [64 * e, 0, -6];   // lead leg out, trail leg tucked
    j.kneeL = [-14 * e, 0, 0]; j.kneeR = [-98 * e, 0, 0];
    j.ankleL = [-24 * e, 0, 0]; j.ankleR = [16, 0, 0];
    j.shoulderL = [60 * e, 0, 30]; j.shoulderR = [-112 * e, 0, -14];
    j.elbowL = [-22, 0, 0]; j.elbowR = [-56, 0, 0];
    j.spine = [28 * e, 0, 7 * e]; j.neck = [-26 * e, 0, 0]; j.hips = [0, 11 * e, 0];
    return { j, y: -0.52 * e, pitch: -54 * e, roll: 0 };
  },

  // rising out of the slide: hips come up and the trail leg swings under the
  // body before the run cycle takes over, so nothing snaps upright
  SLIDE_RECOVER(p, k, t) {
    const j = J();
    const u = M.clamp(t / 0.22, 0, 1), e = 1 - u;
    j.hipL = [-6 * e + 30 * u, 0, 6 * e]; j.hipR = [64 * e - 10 * u, 0, -5 * e];
    j.kneeL = [-14 * e - 40 * u, 0, 0]; j.kneeR = [-98 * e - 30 * u, 0, 0];
    j.ankleL = [-18 * e + 8 * u, 0, 0]; j.ankleR = [14, 0, 0];
    j.shoulderL = [50 * e - 40 * u, 0, 24 * e]; j.shoulderR = [-100 * e - 20 * u, 0, -12 * e];
    j.elbowL = [-30 - 30 * u, 0, 0]; j.elbowR = [-56 - 10 * u, 0, 0];
    j.spine = [24 * e + 10 * u, 0, 5 * e]; j.neck = [-20 * e, 0, 0]; j.hips = [0, 8 * e, 0];
    return { j, y: -0.50 * e - 0.04 * u, pitch: -50 * e, roll: 0 };
  },

  // impact: sharp recoil on contact, then the body settles rather than flailing
  HIT(p, k, t) {
    const j = J();
    const hit = M.clamp(t * 10, 0, 1);                 // fast recoil
    const settle = M.clamp((t - 0.22) / 0.5, 0, 1);    // then slump
    const e = hit * (1 - settle * 0.45);
    j.hipL = [52 * e + 20 * settle, 0, 12]; j.hipR = [36 * e + 16 * settle, 0, -12];
    j.kneeL = [-62 * e - 24 * settle, 0, 0]; j.kneeR = [-78 * e - 20 * settle, 0, 0];
    j.ankleL = [10 * e, 0, 0]; j.ankleR = [8 * e, 0, 0];
    j.shoulderL = [-152 * e, 20, 40]; j.shoulderR = [-144 * e, -20, -40];
    j.elbowL = [-28 - 26 * settle, 0, 0]; j.elbowR = [-32 - 24 * settle, 0, 0];
    j.spine = [-26 * e + 16 * settle, 0, 4 * e]; j.neck = [20 * e - 10 * settle, 0, 0];
    return { j, y: 0.14 * e - 0.1 * settle, pitch: -20 * e + 8 * settle, roll: 0 };
  }
};


export { J, legIK, runCycle, RUN_PARAMS, FAST_PARAMS, POSES };
