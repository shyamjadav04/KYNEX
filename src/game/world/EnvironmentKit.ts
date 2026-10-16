// KYNEX Stage 3 module extracted from the verified FPS-optimized Stage 2 runtime.
// @ts-nocheck

import * as pc from "playcanvas";
import { CFG } from "../core/GameConfig";
import { M } from "../core/MathUtils";
import { Pool } from "../core/Pool";
import { MatLib } from "./TextureFactory";

/* ================================================================
   FILE: Scripts/World/Builders.mjs — shared primitive helpers
   ================================================================ */
function prim(type, mat, pos, scl, rot, opts) {
  const e = new pc.Entity(type);
  e.addComponent('render', { type: type });
  e.render.material = mat;
  e.render.castShadows = !(opts && opts.noShadow);
  e.render.receiveShadows = !(opts && opts.noReceive);
  if (opts && opts.layers) e.render.layers = opts.layers;
  if (pos) e.setLocalPosition(pos[0], pos[1], pos[2]);
  if (scl) e.setLocalScale(scl[0], scl[1], scl[2]);
  if (rot) e.setLocalEulerAngles(rot[0], rot[1], rot[2]);
  return e;
}


// Environment meshes are decorative and sit outside the collision path.
// They do not need to cast/receive the main directional shadow, which is
// especially expensive once the whole roadside hierarchy scrolls each frame.
function optimizeEnvironmentNode(root) {
  const stack = [root];
  while (stack.length) {
    const e = stack.pop();
    if (e.render) {
      e.render.castShadows = false;
      e.render.receiveShadows = false;
    }
    for (let i = 0; i < e.children.length; i++) stack.push(e.children[i]);
  }
  return root;
}

/* ================================================================
   FILE: Scripts/World/TrackSegment.mjs
   A segment is a pre-built 34 m block of city: road, kerbs,
   sidewalks, towers, lamps, props. Built once, recycled forever.
   Three moods keep the skyline from reading as wallpaper.
   ================================================================ */
/* ================================================================
   FILE: Scripts/World/EnvironmentKit.mjs
   Every building and street prop is POOLED, the same way obstacles
   and coins already are. Previously the 9 live segments were built
   once and simply recycled position, which meant only 9 unique
   blocks ever existed and the city visibly looped every ~300 m.
   Now each segment re-draws from these pools whenever it recycles,
   so the skyline is re-randomized on every pass instead of repeating
   the exact same building. Nothing here allocates during play —
   every spawn only repositions, rescales and re-skins an existing
   entity.
   ================================================================ */

// six tower archetypes, one rooftop feature each, so the kind of
// building varies as well as its size and colour
const TOWER_KINDS = ['plain', 'antenna', 'tank', 'dish', 'neonstrip', 'balcony'];

class TowerKit {
  constructor(root) {
    this.root = root;
    const lib = MatLib.get();
    this.pools = {};
    for (const kind of TOWER_KINDS) this.pools[kind] = new Pool(() => optimizeEnvironmentNode(this._build(kind, lib)), 12, root);
  }

  _build(kind, lib) {
    const e = new pc.Entity('Tower_' + kind);
    e._kind = kind;
    e.facade = prim('box', lib.facades[0], [0, 0, 0], [10, 10, 8]);
    e.addChild(e.facade);
    e.cap = prim('box', lib.concrete, [0, 0, 0], [10.7, .7, 8.7]);
    e.addChild(e.cap);
    e.canopy = prim('box', lib.metalDark, [0, 3.4, 0], [1.4, .25, 6.4]);
    e.addChild(e.canopy);
    e.sign = prim('box', lib.facades[0], [0, 6, 0], [.12, 2.2, 5.0], null, { noShadow: true, noReceive: true });
    e.addChild(e.sign);
    e.antenna = prim('cylinder', lib.metal, [0, 0, 0], [.10, 4.0, .10], null, { noReceive: true });
    e.antennaTip = prim('sphere', lib.neonMagenta, [0, 0, 0], [.28, .28, .28], null, { noShadow: true, noReceive: true });
    e.addChild(e.antenna); e.addChild(e.antennaTip);
    e.tank = prim('cylinder', lib.metalDark, [0, 0, 0], [1.6, 2.0, 1.6], null, { noReceive: true });
    e.addChild(e.tank);
    e.dishMount = prim('cylinder', lib.metal, [0, 0, 0], [.14, 1.4, .14], null, { noReceive: true });
    e.dish = prim('cone', lib.metal, [0, 0, 0], [1.6, .5, 1.6], [70, 0, 0], { noReceive: true });
    e.addChild(e.dishMount); e.addChild(e.dish);
    e.neonStrip = prim('box', lib.neonCyan, [0, 0, 0], [.14, .14, 6], null, { noShadow: true, noReceive: true });
    e.addChild(e.neonStrip);
    e.balcony1 = new pc.Entity('balcony1'); e.balcony1.addChild(prim('box', lib.concrete, [0, 0, 0], [.6, .12, 3.4]));
    e.balcony1.addChild(prim('box', lib.metal, [0, .25, 1.65], [.62, .45, .08]));
    e.balcony2 = new pc.Entity('balcony2'); e.balcony2.addChild(prim('box', lib.concrete, [0, 0, 0], [.6, .12, 3.4]));
    e.balcony2.addChild(prim('box', lib.metal, [0, .25, 1.65], [.62, .45, .08]));
    e.addChild(e.balcony1); e.addChild(e.balcony2);
    for (const f of [e.antenna, e.antennaTip, e.tank, e.dishMount, e.dish, e.neonStrip, e.balcony1, e.balcony2]) f.enabled = false;
    return e;
  }

  spawn(kind, side, x, z, h, w, depth, district, parent, showSign, signMaterial) {
    const e = this.pools[kind].get();
    (parent || this.root).addChild(e);
    e.setLocalPosition(x, h / 2, z + depth / 2);
    e.facade.setLocalScale(w, h, depth);
    e.facade.material = M.pick(district.facades);
    e.cap.setLocalPosition(0, h / 2 + .35, 0);
    e.cap.setLocalScale(w + .7, .7, depth + .7);
    e.canopy.setLocalPosition(-side * (w / 2 + .6), 3.4 - h / 2, 0);
    e.canopy.setLocalScale(1.4, .25, depth * .8);

    // Billboards are deliberately scheduled by TrackSegment instead of
    // appearing randomly during recycling. This keeps the skyline readable.
    const hasSign = !!showSign;
    e.sign.enabled = hasSign;
    if (hasSign) {
      e.sign.material = signMaterial || district.signs[0];
      e.sign.setLocalPosition(-side * (w / 2 + .12), M.rand(6, Math.max(7, h - 4)) - h / 2, 0);
      e.sign.setLocalScale(0.78, 0.78, 0.78);
    }

    if (kind === 'antenna') {
      e.antenna.enabled = e.antennaTip.enabled = true;
      e.antenna.setLocalPosition(M.rand(-w * .3, w * .3), h / 2 + 2, M.rand(-depth * .3, depth * .3));
      e.antennaTip.setLocalPosition(e.antenna.getLocalPosition().x, h / 2 + 4, e.antenna.getLocalPosition().z);
      e.antennaTip.material = M.pick(district.accents);
    } else if (kind === 'tank') {
      e.tank.enabled = true;
      e.tank.setLocalPosition(M.rand(-w * .25, w * .25), h / 2 + 1, M.rand(-depth * .25, depth * .25));
    } else if (kind === 'dish') {
      e.dishMount.enabled = e.dish.enabled = true;
      const dx = M.rand(-w * .25, w * .25), dz = M.rand(-depth * .25, depth * .25);
      e.dishMount.setLocalPosition(dx, h / 2 + .7, dz);
      e.dish.setLocalPosition(dx, h / 2 + 1.5, dz);
      e.dish.setLocalEulerAngles(60 + M.rand(-15, 15), M.rand(0, 360), 0);
    } else if (kind === 'neonstrip') {
      e.neonStrip.enabled = true;
      e.neonStrip.setLocalPosition(-side * (w / 2 - .1), h / 2 + .1, 0);
      e.neonStrip.setLocalScale(.14, .14, depth * .92);
      e.neonStrip.material = M.pick(district.accents);
    } else if (kind === 'balcony' && h < 20) {
      e.balcony1.enabled = true;
      e.balcony1.setLocalPosition(side * (w / 2 + .3), h * -0.18, 0);
      e.balcony1.setLocalEulerAngles(0, side < 0 ? 180 : 0, 0);
      if (h > 9) {
        e.balcony2.enabled = true;
        e.balcony2.setLocalPosition(side * (w / 2 + .3), h * 0.12, 0);
        e.balcony2.setLocalEulerAngles(0, side < 0 ? 180 : 0, 0);
      }
    }
    return e;
  }

  release(e) {
    for (const f of [e.antenna, e.antennaTip, e.tank, e.dishMount, e.dish, e.neonStrip, e.balcony1, e.balcony2]) f.enabled = false;
    this.pools[e._kind].release(e);
  }
}

// street-level props, one pool per kind — mirrors ObstacleManager
const PROP_BUILDERS = {
  tree(lib) {
    const e = new pc.Entity('Tree');
    e.addChild(prim('cylinder', lib.trunk, [0, .9, 0], [.28, 1.8, .28]));
    e.addChild(prim('sphere', lib.foliage, [0, 2.4, 0], [2.4, 2.2, 2.4], null, { noReceive: true }));
    e.addChild(prim('sphere', lib.foliage, [.5, 3.1, .3], [1.5, 1.4, 1.5], null, { noReceive: true }));
    e.addChild(prim('cylinder', lib.concrete, [0, .1, 0], [1.5, .3, 1.5], null, { noShadow: true }));
    return e;
  },
  bench(lib) {
    const e = new pc.Entity('Bench');
    e.addChild(prim('box', lib.wood, [0, .45, 0], [.7, .12, 2.0]));
    e.addChild(prim('box', lib.wood, [-.3, .75, 0], [.12, .6, 2.0]));
    e.addChild(prim('box', lib.metal, [0, .22, .8], [.5, .45, .1]));
    e.addChild(prim('box', lib.metal, [0, .22, -.8], [.5, .45, .1]));
    return e;
  },
  kiosk(lib) {
    const e = new pc.Entity('Kiosk');
    e.addChild(prim('box', lib.metalDark, [0, 1.3, 0], [1.6, 2.6, 1.2]));
    e.sign = prim('box', lib.facades[0], [-.85, 1.6, 0], [.08, 1.5, 1.0], null, { noShadow: true, noReceive: true });
    e.addChild(e.sign);
    e.trim = prim('box', lib.neonMagenta, [0, 2.68, 0], [1.7, .10, 1.3], null, { noShadow: true, noReceive: true });
    e.addChild(e.trim);
    return e;
  },
  crateStack(lib) {
    const e = new pc.Entity('Crates');
    e.boxes = [];
    for (let i = 0; i < 4; i++) { const b = prim('box', lib.wood, [0, .55 + i * 1.05, 0], [1.0, 1.0, 1.0]); e.addChild(b); e.boxes.push(b); }
    return e;
  },
  hazardDrum(lib) {
    return prim('cylinder', lib.hazard, [0, 1.05, 0], [.85, 1.1, .85]);
  },
  pipeRun(lib) {
    const e = new pc.Entity('PipeRun');
    e.addChild(prim('cylinder', lib.metal, [0, 0, 0], [.42, CFG.segmentLength, .42], [90, 0, 0], { noReceive: true }));
    e.addChild(prim('cylinder', lib.metalDark, [0, -.9, 0], [.28, CFG.segmentLength, .28], [90, 0, 0], { noReceive: true }));
    return e;
  },
  holoArch(lib) {
    const e = new pc.Entity('HoloArch');
    e.legL = prim('cylinder', lib.metalDark, [-6.2, 4.2, 0], [.34, 8.4, .34], null, { noReceive: true });
    e.legR = prim('cylinder', lib.metalDark, [6.2, 4.2, 0], [.34, 8.4, .34], null, { noReceive: true });
    e.addChild(e.legL); e.addChild(e.legR);
    e.addChild(prim('box', lib.metalDark, [0, 8.2, 0], [13, .5, .9], null, { noReceive: true }));
    e.sign = prim('box', lib.facades[0], [0, 7.4, .5], [6, 1.5, .08], null, { noShadow: true, noReceive: true });
    e.addChild(e.sign);
    e.trim = prim('box', lib.neonViolet, [0, 8.55, 0], [13.2, .1, 1.0], null, { noShadow: true, noReceive: true });
    e.addChild(e.trim);
    return e;
  },
  marketStall(lib) {
    const e = new pc.Entity('Stall');
    e.addChild(prim('box', lib.wood, [0, .7, 0], [1.6, 1.4, 1.0]));
    e.awning = prim('box', lib.canvasAwning, [0, 1.55, .55], [1.8, .10, 1.1], [-18, 0, 0]);
    e.addChild(e.awning);
    e.sign = prim('box', lib.facades[3], [0, 1.15, -.52], [1.5, .7, .05], null, { noShadow: true, noReceive: true });
    e.addChild(e.sign);
    return e;
  },
  vendingMachine(lib) {
    const e = new pc.Entity('Vending');
    e.addChild(prim('box', lib.metalDark, [0, .95, 0], [.85, 1.9, .7]));
    e.glow = prim('box', lib.neonCyan, [0, .95, .37], [.65, 1.5, .05], null, { noShadow: true, noReceive: true });
    e.addChild(e.glow);
    return e;
  },
  railPylon(lib) {
    const e = new pc.Entity('RailPylon');
    e.addChild(prim('box', lib.concrete, [0, 4.5, 0], [1.6, 9.0, 1.6]));
    e.addChild(prim('box', lib.metalDark, [0, 9.1, 0], [2.6, .5, 2.6]));
    e.addChild(prim('cylinder', lib.metal, [0, 9.55, 1.1], [.09, .9, .09], [90, 0, 0], { noShadow: true }));
    return e;
  },
  trainCar(lib) {
    const e = new pc.Entity('TrainCar');
    e.addChild(prim('box', lib.silhouette, [0, 10.4, 0], [3.0, 2.2, 8.0], null, { noShadow: true, noReceive: true }));
    e.addChild(prim('box', lib.neonCyan, [0, 9.9, 0], [3.05, .10, 8.05], null, { noShadow: true, noReceive: true }));
    return e;
  }
};

class PropKit {
  constructor(root) {
    this.root = root;
    const lib = MatLib.get();
    this.pools = {};
    for (const kind in PROP_BUILDERS) this.pools[kind] = new Pool(() => optimizeEnvironmentNode(PROP_BUILDERS[kind](lib)), 7, root);
  }
  spawn(kind, x, y, z, rotY, parent) {
    const e = this.pools[kind].get();
    (parent || this.root).addChild(e);
    e.setLocalPosition(x, y, z);
    e.setLocalEulerAngles(0, rotY || 0, 0);
    return e;
  }
  releaseKind(kind, e) { this.pools[kind].release(e); }
}
class LampKit {
  constructor(root) {
    this.root = root;
    const lib = MatLib.get();
    this.pool = new Pool(() => optimizeEnvironmentNode(this._build(lib)), 20, root);
  }
  _build(lib) {
    const e = new pc.Entity('Lamp');
    e.addChild(prim('cylinder', lib.metalDark, [0, 3.2, 0], [.16, 6.4, .16], null, { noReceive: true }));
    e.arm = prim('box', lib.metalDark, [0, 6.3, 0], [1.9, .14, .14], null, { noReceive: true });
    e.addChild(e.arm);
    e.glow = prim('box', lib.lampGlow, [0, 6.1, 0], [.8, .18, .36], null, { noShadow: true, noReceive: true });
    e.addChild(e.glow);
    e.accent = prim('box', lib.neonCyan, [0, 4.6, 0], [.2, .9, .2], null, { noShadow: true, noReceive: true });
    e.addChild(e.accent);
    e.omni = new pc.Entity('LampLight');
    e.omni.addComponent('light', { type: 'omni', color: new pc.Color(1, .78, .46), intensity: 2.4, range: 14, castShadows: false });
    e.addChild(e.omni);
    return e;
  }
  spawn(s, x, z, accentMat, lit, parent) {
    const e = this.pool.get();
    (parent || this.root).addChild(e);
    e.setLocalPosition(x, 0, z);
    e.arm.setLocalPosition(-s * .9, 6.3, 0);
    e.glow.setLocalPosition(-s * 1.7, 6.1, 0);
    e.accent.material = accentMat;
    e.omni.enabled = !!lit;
    if (lit) e.omni.setLocalPosition(-s * 1.7, 5.8, 0);
    return e;
  }
  release(e) { this.pool.release(e); }
}

export { prim, optimizeEnvironmentNode, TowerKit, PropKit, LampKit, MatLib };
