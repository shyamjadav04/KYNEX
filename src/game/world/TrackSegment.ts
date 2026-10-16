// KYNEX Stage 3 module extracted from the verified FPS-optimized Stage 2 runtime.
// @ts-nocheck

import * as pc from "playcanvas";
import { CFG } from "../core/GameConfig";
import { M } from "../core/MathUtils";
import { MatLib } from "./TextureFactory";
import { prim } from "./EnvironmentKit";
import { TowerKit, PropKit, LampKit } from "./EnvironmentKit";
import { Q } from "../core/PlatformQuality";

/* ================================================================
   FILE: Scripts/World/Districts.mjs
   One profile per district: which facades/signs/accent colour it
   draws from, how tall its towers run, and which street props it
   favours. Districts arrive in contiguous blocks (see TrackManager)
   so each one reads as an actual place, not a per-tile shuffle.
   ================================================================ */
function buildDistrictProfiles() {
  const lib = MatLib.get();
  return {
    neonDowntown: {
      facades: [lib.facades[0]], signs: lib.signSets.neonDowntown, accents: [lib.neonMagenta, lib.neonCyan, lib.neonAmber],
      towerH: [16, 34], towerCount: 4, towerKindWeights: { plain: 3, antenna: 2, neonstrip: 2, balcony: 1, tank: 1, dish: 1 },
      props: [['tree', 2], ['bench', 1], ['kiosk', 1]], fogTint: new pc.Color(0.62, 0.52, 0.62)
    },
    cyberMarket: {
      facades: [lib.facades[3]], signs: lib.signSets.cyberMarket, accents: [lib.neonAmber, lib.neonMagenta, lib.neonCyan],
      towerH: [7, 15], towerCount: 3, towerKindWeights: { plain: 3, balcony: 3, neonstrip: 2, antenna: 1 },
      props: [['marketStall', 3], ['vendingMachine', 2], ['kiosk', 2], ['bench', 1]], fogTint: new pc.Color(0.70, 0.48, 0.42)
    },
    industrial: {
      facades: [lib.facades[4]], signs: lib.signSets.industrial, accents: [lib.neonAmber, lib.warnStripe],
      towerH: [7, 15], towerCount: 3, towerKindWeights: { plain: 4, tank: 3, dish: 1, antenna: 1 },
      props: [['crateStack', 3], ['hazardDrum', 3], ['pipeRun', 1]], fogTint: new pc.Color(0.50, 0.50, 0.56)
    },
    elevatedCity: {
      facades: [lib.facades[1]], signs: lib.signSets.elevatedCity, accents: [lib.neonCyan, lib.neonAmber],
      towerH: [18, 30], towerCount: 3, towerKindWeights: { plain: 3, antenna: 2, dish: 2, neonstrip: 2 },
      props: [['railPylon', 2], ['trainCar', 1], ['kiosk', 1]], fogTint: new pc.Color(0.48, 0.54, 0.68)
    },
    cyberDistrict: {
      facades: [lib.facades[2]], signs: lib.signSets.cyberDistrict, accents: [lib.neonViolet, lib.neonMagenta, lib.neonCyan],
      towerH: [20, 36], towerCount: 4, towerKindWeights: { neonstrip: 3, antenna: 2, plain: 2, dish: 1 },
      props: [['holoArch', 1], ['kiosk', 2], ['vendingMachine', 1]], fogTint: new pc.Color(0.58, 0.42, 0.68)
    }
  };
}
function weightedKind(weights) {
  const keys = Object.keys(weights); let total = 0; for (const k of keys) total += weights[k];
  let r = Math.random() * total;
  for (const k of keys) { r -= weights[k]; if (r <= 0) return k; }
  return keys[keys.length - 1];
}


/* ================================================================
   FILE: Scripts/World/TrackSegment.mjs
   A segment is a 34 m slot: road, kerb and sidewalk are permanent;
   towers, lamps and props are BORROWED from the shared kits and
   returned whenever the segment recycles, then re-drawn for whatever
   district now occupies that slot. The road itself never rebuilds —
   only the city around it changes.
   ================================================================ */
class TrackSegment {
  constructor(app, index, kits) {
    this.app = app; this.kits = kits;
    this.index = index;
    this.root = new pc.Entity('Segment' + index);
    this.obstacles = []; this.coins = [];
    this.towers = []; this.props = []; this.lamps = [];
    this.district = null;
    this._buildRoad();
  }

  _buildRoad() {
    const lib = MatLib.get(), L = CFG.segmentLength, half = L / 2, r = this.root;
    r.addChild(prim('box', lib.road, [0, -.2, 0], [CFG.roadWidth, .4, L], null, { noShadow: true }));
    for (const x of [-1.5, 1.5]) {
      for (let z = -half + 1.6; z < half; z += Q.roadMarkStep)
        r.addChild(prim('box', lib.roadPaint, [x, .006, z], [.16, .02, 2.3], null, { noShadow: true }));
    }
    for (const x of [-5.1, 5.1]) r.addChild(prim('box', lib.roadGlow, [x, .006, 0], [.20, .02, L], null, { noShadow: true, noReceive: true }));
    for (const s of [-1, 1]) {
      r.addChild(prim('box', lib.kerb, [s * 5.85, .14, 0], [1.2, .68, L], null, { noShadow: true }));
      r.addChild(prim('box', lib.sidewalk, [s * 8.4, .30, 0], [4.2, .60, L], null, { noShadow: true }));
      r.addChild(prim('box', lib.concrete, [s * 10.6, .55, 0], [.5, .30, L], null, { noShadow: true }));
    }
    // occasional wet-look patch on the sidewalk — catches the key light
    // without interfering with the lanes the player actually runs in
    this.puddles = [];
    if (Q.puddles) for (const s of [-1, 1]) {
      if (Math.random() < .5) {
        const p = prim('plane', lib.puddle, [s * (7.6 + M.rand(0, 1.6)), .61, M.rand(-half + 3, half - 3)], [M.rand(1.4, 2.4), 1, M.rand(1.8, 3)], [90, 0, M.rand(0, 360)], { noShadow: true, noReceive: true });
        r.addChild(p); this.puddles.push(p);
      }
    }
  }

  /* release everything borrowed from the kits, then draw a fresh set
     for the given district. Called once at construction and again on
     every recycle, so the skyline never repeats verbatim. */
  populate(district, districtName) {
    this.clearEnv();
    this.district = districtName;
    if (!district) return;      // menu attract mode: bare road, no city
    this._towers(district);
    this._lamps(district);
    this._props(district);
  }

  clearEnv() {
    for (const t of this.towers) this.kits.towers.release(t);
    for (const l of this.lamps) this.kits.lamps.release(l);
    for (const p of this.props) this.kits.props.releaseKind(p._kind, p);
    this.towers.length = 0; this.lamps.length = 0; this.props.length = 0;
  }

  _towers(d) {
    const L = CFG.segmentLength, half = L / 2;
    for (const s of [-1, 1]) {
      let z = -half + M.rand(1, 5);
      const towerCount = Math.max(1, Math.round(d.towerCount * Q.towerScale));
      for (let i = 0; i < towerCount && z < half - 3; i++) {
        const depth = M.rand(6, 11), w = M.rand(6, 10);
        const h = M.rand(d.towerH[0], d.towerH[1]);
        const x = s * (15 + w / 2 + M.rand(0, 3.5));
        const kind = weightedKind(d.towerKindWeights);
        const showSign = (Q.billboardSigns && this.index % 3 === 0 && i === 0 && s < 0 && this.district !== 'industrial');
        const signMaterial = showSign ? d.signs[Math.abs(this.index) % d.signs.length] : null;
        this.towers.push(this.kits.towers.spawn(kind, s, x, z, h, w, depth, d, this.root, showSign, signMaterial));
        z += depth + M.rand(2.5, 6);
      }
    }
  }

  _lamps(d) {
    const L = CFG.segmentLength, half = L / 2;
    for (let i = 0; i < Q.lamps; i++) {
      const s = i % 2 === 0 ? -1 : 1;
      const z = -half + 8 + i * (L / 2);
      this.lamps.push(this.kits.lamps.spawn(s, s * 7.2, z, M.pick(d.accents), Q.lampLights && i === 0, this.root));
    }
  }

  _props(d) {
    const L = CFG.segmentLength, half = L / 2, r = this.root;
    for (const [kind, count] of d.props) {
      const scaledCount = Math.max(0, Math.round(count * Q.propScale));
      for (let i = 0; i < scaledCount; i++) {
        const s = Math.random() < .5 ? -1 : 1;
        const z = M.rand(-half + 3, half - 3);
        let e;
        if (kind === 'pipeRun') {
          e = this.kits.props.spawn(kind, s * 11.5, 6.6, 0, 0, this.root);
        } else if (kind === 'holoArch') {
          if (Math.random() > .55) continue;
          e = this.kits.props.spawn(kind, 0, 0, M.rand(-half + 6, half - 6), 0, this.root);
        } else if (kind === 'railPylon' || kind === 'trainCar') {
          e = this.kits.props.spawn(kind, s * 9.4, 0, z, s < 0 ? 0 : 180, this.root);
        } else {
          const x = s * M.rand(7.2, 9.8);
          e = this.kits.props.spawn(kind, x, .6, z, s < 0 ? 90 : -90, this.root);
        }
        e._kind = kind;
        this.props.push(e);
      }
    }
  }

  setZ(z) { this.root.setLocalPosition(0, 0, z); }
  get z() { return this.root.getLocalPosition().z; }
}

export { buildDistrictProfiles, weightedKind, TrackSegment };
