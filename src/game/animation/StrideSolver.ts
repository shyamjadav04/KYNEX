// @ts-nocheck
import { M } from '../core/MathUtils';
import { LEG } from '../player/PlayerRig';

const StrideSolver = {
  sole(pose, side) {
    const d = Math.PI / 180;
    const a1 = pose.j['hip' + side][0] * d;
    const a2 = a1 + pose.j['knee' + side][0] * d;
    const a3 = a2 + pose.j['ankle' + side][0] * d;
    let y = LEG.hipY + pose.y, z = 0;
    y -= LEG.thigh * Math.cos(a1); z -= LEG.thigh * Math.sin(a1);
    y -= LEG.shin * Math.cos(a2); z -= LEG.shin * Math.sin(a2);
    y -= LEG.sole * Math.cos(a3); z -= LEG.sole * Math.sin(a3);
    return { y: y, z: z };
  },
  solve(poseFn, params) {
    const N = 192, TAU = Math.PI * 2;
    const L = [], R = [];
    let minY = 1e9;
    for (let i = 0; i < N; i++) {
      const pose = poseFn(i / N * TAU, 0, 1);
      const l = this.sole(pose, 'L'), r = this.sole(pose, 'R');
      L.push(l); R.push(r);
      minY = Math.min(minY, l.y, r.y);
    }
    // stance = the part of the cycle the foot spends on the ground
    const band = minY + 0.008;   // the IK stance is exactly flat, so the band can be tight
    let count = 0, zMin = 1e9, zMax = -1e9;
    for (let i = 0; i < N; i++) if (L[i].y <= band) { count++; zMin = Math.min(zMin, L[i].z); zMax = Math.max(zMax, L[i].z); }
    // Authored stance fraction wins over the measured one: sampling the
    // band picks up swing frames that graze the road, which inflates the
    // window and leaves the planted foot running ~1 m/s fast.
    const stanceFrac = params ? params.stance : Math.max(0.12, count / N);
    const travel = params ? params.stride : Math.max(0.25, zMax - zMin);
    // body must cover stride/stance each cycle for the planted foot to stay put
    return { cycle: travel / stanceFrac, ground: -minY, stanceFrac: stanceFrac, travel: travel,
             measuredStance: count / N, measuredTravel: zMax - zMin };
  }
};

export { StrideSolver };
