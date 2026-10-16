// KYNEX Stage 4: ObstacleManager extracted from the verified Stage 3 runtime.
// @ts-nocheck

import * as pc from "playcanvas";
import { Pool } from "../core/Pool";
import { M } from "../core/MathUtils";
import { prim } from "./EnvironmentKit";
import { MatLib } from "./TextureFactory";

/* ================================================================
   FILE: Scripts/World/ObstacleManager.mjs
   Four silhouettes the player can read at 30 m/s, each pooled.
   Every obstacle carries its own collision volume — no invisible
   boxes standing in for the art.
   ================================================================ */
const OBSTACLE_DEFS = {
  // requires JUMP
  barrier: { yMin: 0, yMax: 1.00, halfW: 1.25, halfD: 0.35, action: 'jump' },
  // requires SLIDE
  beam:    { yMin: 1.18, yMax: 3.40, halfW: 1.35, halfD: 0.55, action: 'slide' },
  // requires LANE CHANGE
  block:   { yMin: 0, yMax: 3.10, halfW: 1.35, halfD: 1.10, action: 'dodge' },
  // moves across lanes, clearable with a well-timed JUMP
  drone:   { yMin: 0.25, yMax: 1.32, halfW: 0.85, halfD: 0.85, action: 'jump' }
};

class ObstacleManager {
  constructor(app, root) {
    this.app = app; this.root = root; this.pools = {};
    const lib = MatLib.get();
    this.pools.barrier = new Pool(() => this._barrier(lib), 8, root);
    this.pools.beam = new Pool(() => this._beam(lib), 6, root);
    this.pools.block = new Pool(() => this._block(lib), 6, root);
    this.pools.drone = new Pool(() => this._drone(lib), 4, root);
  }

  _wrap(name, kind) { const e = new pc.Entity(name); e._kind = kind; e._def = OBSTACLE_DEFS[kind]; return e; }

  _barrier(lib) {
    const e = this._wrap('Barrier', 'barrier');
    e.addChild(prim('box', lib.hazard, [0, .62, 0], [2.4, .46, .18]));
    e.addChild(prim('box', lib.metalDark, [0, .30, 0], [2.4, .12, .30]));
    for (const s of [-1, 1]) {
      e.addChild(prim('cylinder', lib.metal, [s * 1.08, .42, 0], [.13, .84, .13]));
      e.addChild(prim('box', lib.rubber, [s * 1.08, .05, 0], [.46, .10, .52], null, { noShadow: true }));
      e.addChild(prim('box', lib.neonMagenta, [s * 1.08, .86, .12], [.16, .07, .06], null, { noShadow: true, noReceive: true }));
    }
    return e;
  }

  _beam(lib) {
    const e = this._wrap('Gantry', 'beam');
    // overhead sign block the player has to duck under
    e.addChild(prim('box', lib.metalDark, [0, 2.30, 0], [3.0, .55, .60]));
    e.addChild(prim('box', M.pick(lib.signs), [0, 1.72, .33], [2.3, .92, .06], null, { noShadow: true }));
    e.addChild(prim('box', lib.hazard, [0, 1.32, 0], [3.0, .22, .50]));
    for (const s of [-1, 1]) {
      e.addChild(prim('cylinder', lib.metal, [s * 1.55, 2.0, 0], [.16, 4.0, .16]));
      e.addChild(prim('box', lib.neonCyan, [s * 1.45, 1.30, .28], [.10, .10, .06], null, { noShadow: true, noReceive: true }));
    }
    return e;
  }

  _block(lib) {
    const e = this._wrap('Container', 'block');
    e.addChild(prim('box', lib.metalDark, [0, 1.5, 0], [2.6, 3.0, 2.0]));
    e.addChild(prim('box', lib.metal, [0, 1.5, 1.02], [2.35, 2.7, .06], null, { noReceive: true }));
    e.addChild(prim('box', M.pick(lib.signs), [0, 2.05, 1.08], [1.7, .70, .05], null, { noShadow: true }));
    e.addChild(prim('box', lib.hazard, [0, .28, 1.03], [2.6, .40, .08], null, { noShadow: true }));
    for (const s of [-1, 1]) e.addChild(prim('cylinder', lib.metal, [s * 1.2, 1.5, 1.0], [.12, 2.9, .12], null, { noReceive: true }));
    return e;
  }

  _drone(lib) {
    const e = this._wrap('Drone', 'drone');
    const body = prim('sphere', lib.metalDark, [0, .80, 0], [1.05, .70, 1.05]);
    e.addChild(body);
    e.addChild(prim('box', lib.visor, [0, .74, .42], [.62, .22, .18], null, { noShadow: true, noReceive: true }));
    e.addChild(prim('box', lib.neonMagenta, [0, 1.05, 0], [.30, .08, .30], null, { noShadow: true, noReceive: true }));
    const rotors = new pc.Entity('rotors');
    for (const s of [-1, 1]) for (const d of [-1, 1]) {
      rotors.addChild(prim('cylinder', lib.metal, [s * .62, 1.02, d * .62], [.70, .04, .70], null, { noShadow: true }));
    }
    e.addChild(rotors); e._rotors = rotors;
    e.addChild(prim('cylinder', lib.neonCyan, [0, .40, 0], [.42, .06, .42], null, { noShadow: true, noReceive: true }));
    return e;
  }

  spawn(kind, parent, x, z, extra) {
    const e = this.pools[kind].get();
    parent.addChild(e);
    e.setLocalPosition(x, 0, z);
    e.setLocalEulerAngles(0, 0, 0);
    e._home = x;
    e._patrol = extra && extra.patrol ? extra.patrol : 0;
    e._phase = Math.random() * Math.PI * 2;
    e._hit = false;
    return e;
  }

  update(dt, t) {
    for (const kind in this.pools) {
      for (const e of this.pools[kind].live) {
        if (kind === 'drone') {
          e._phase += dt * 1.7;
          const p = e.getLocalPosition();
          const x = e._patrol ? e._home + Math.sin(e._phase) * e._patrol : e._home;
          e.setLocalPosition(x, Math.sin(e._phase * 1.6) * 0.12, p.z);
          if (e._rotors) e._rotors.rotateLocal(0, dt * 1400, 0);
        }
      }
    }
  }
  releaseFrom(list) { for (const e of list) this.pools[e._kind].release(e); }
}
export { OBSTACLE_DEFS, ObstacleManager };

