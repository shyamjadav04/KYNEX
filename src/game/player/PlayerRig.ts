// @ts-nocheck
import * as pc from 'playcanvas';
import { MatLib, prim } from '../world/EnvironmentKit';

// leg metrics, in metres, matching the meshes built below
const LEG = { hipY: 0.82, thigh: 0.44, shin: 0.40, sole: 0.145 };

class PlayerRig {
  constructor() {
    const lib = MatLib.get();
    this.joints = {};
    this.root = new pc.Entity('Runner');

    const joint = (name, parent, pos) => {
      const j = new pc.Entity(name);
      j.setLocalPosition(pos[0], pos[1], pos[2]);
      parent.addChild(j);
      this.joints[name] = j;
      j._rest = new pc.Vec3(0, 0, 0);
      return j;
    };
    // the runner both casts and receives shadows, so it sits in the world
    // rather than floating as a self-lit cutout
    const mesh = (parent, type, mat, pos, scl, rot) => { const m = prim(type, mat, pos, scl, rot); parent.addChild(m); return m; };

    // body carries global lean / crouch offsets, hips carry the walk cycle
    const body = joint('body', this.root, [0, 0, 0]);
    const hips = joint('hips', body, [0, 0.92, 0]);
    mesh(hips, 'box', lib.pants, [0, -0.02, 0], [0.40, 0.30, 0.27]);
    mesh(hips, 'box', lib.trim, [0, 0.13, 0], [0.42, 0.07, 0.29]);

    // ---- spine / chest ----
    const spine = joint('spine', hips, [0, 0.13, 0]);
    mesh(spine, 'box', lib.jacket, [0, 0.24, 0], [0.46, 0.48, 0.30]);
    mesh(spine, 'box', lib.jacketDark, [0, 0.24, 0.152], [0.20, 0.46, 0.03]);
    mesh(spine, 'box', lib.trim, [0, 0.40, 0.155], [0.34, 0.05, 0.03]);
    mesh(spine, 'box', lib.jacketDark, [0, 0.20, -0.20], [0.32, 0.40, 0.14]);   // slim backpack
    mesh(spine, 'box', lib.neonCyan, [0, 0.34, -0.28], [0.20, 0.05, 0.02]);
    mesh(spine, 'sphere', lib.jacket, [0, 0.44, 0], [0.46, 0.26, 0.31]);        // shoulder yoke

    this.fx = {};
    this.fx.chestCore = mesh(spine, 'sphere', lib.neonCyan, [0, 0.28, 0.185], [.09, .09, .05]);
    this.fx.chestBar = mesh(spine, 'box', lib.neonMagenta, [0, 0.16, 0.175], [.28, .022, .018]);

    // ---- head ----
    const neck = joint('neck', spine, [0, 0.50, 0]);
    mesh(neck, 'cylinder', lib.skin, [0, 0.05, 0], [0.13, 0.12, 0.13]);
    const head = joint('head', neck, [0, 0.11, 0]);
    mesh(head, 'sphere', lib.skin, [0, 0.16, 0], [0.30, 0.34, 0.30]);
    mesh(head, 'box', lib.visor, [0, 0.18, 0.13], [0.27, 0.10, 0.06]);
    mesh(head, 'sphere', lib.hair, [0, 0.24, -0.02], [0.32, 0.30, 0.32]);
    mesh(head, 'box', lib.hair, [0, 0.19, -0.17], [0.16, 0.22, 0.12]);
    mesh(head, 'box', lib.trim, [0, 0.31, -0.02], [0.33, 0.05, 0.33]);

    // ---- arms ----
    for (const s of [-1, 1]) {
      const sd = s < 0 ? 'L' : 'R';
      const sh = joint('shoulder' + sd, spine, [s * 0.28, 0.42, 0]);
      mesh(sh, 'sphere', lib.jacket, [0, 0, 0], [0.19, 0.19, 0.19]);
      mesh(sh, 'capsule', lib.jacket, [0, -0.16, 0], [0.155, 0.34, 0.155]);
      const el = joint('elbow' + sd, sh, [0, -0.32, 0]);
      mesh(el, 'capsule', lib.skin, [0, -0.14, 0], [0.13, 0.30, 0.13]);
      mesh(el, 'box', lib.trim, [0, -0.02, 0], [0.145, 0.05, 0.145]);
      mesh(el, 'box', lib.skin, [0, -0.30, 0.02], [0.13, 0.15, 0.11]);          // hand
    }

    // ---- legs ----
    for (const s of [-1, 1]) {
      const sd = s < 0 ? 'L' : 'R';
      const hp = joint('hip' + sd, hips, [s * 0.14, -0.10, 0]);
      mesh(hp, 'capsule', lib.pants, [0, -0.22, 0], [0.19, 0.48, 0.19]);
      const kn = joint('knee' + sd, hp, [0, -0.44, 0]);
      mesh(kn, 'capsule', lib.pants, [0, -0.19, 0], [0.165, 0.42, 0.165]);
      mesh(kn, 'box', lib.trim, [0, -0.34, 0.06], [0.14, 0.04, 0.05]);
      const an = joint('ankle' + sd, kn, [0, -0.40, 0]);
      mesh(an, 'box', lib.shoe, [0, -0.05, 0.06], [0.185, 0.13, 0.32]);
      mesh(an, 'box', lib.shoeSole, [0, -0.115, 0.06], [0.195, 0.05, 0.33]);
    }
    this.body = body;

    // soft contact shadow, driven by the animation controller
    this.blob = prim('plane', lib.blob, [0, 0.02, 0.06], [1.15, 1, 1.5], null, { noShadow: true, noReceive: true });
    this.root.addChild(this.blob);
  }
  apply(pose) {
    for (const name in pose.j) {
      const j = this.joints[name];
      if (!j) continue;
      const v = pose.j[name];
      j.setLocalEulerAngles(v[0], v[1], v[2]);
    }
  }
}

export { LEG, PlayerRig };
