// KYNEX Stage 7 — TrackManager extracted from the verified Stage 6 runtime.
// @ts-nocheck
import * as pc from "playcanvas";
import { CFG } from "../core/GameConfig";
import { M } from "../core/MathUtils";
import { TowerKit, PropKit, LampKit } from "./EnvironmentKit";
import { buildDistrictProfiles, TrackSegment } from "./TrackSegment";
import { ObstacleManager } from "./ObstacleManager";
import { CoinManager } from "./CoinManager";
import { Q } from "../core/PlatformQuality";

const ROWS = [
  // --- one obstacle, one lane: the whole of the first 30 seconds ---
  { d: 0.00, r: ['barrier', null, null] },
  { d: 0.00, r: [null, 'barrier', null] },
  { d: 0.00, r: [null, null, 'barrier'] },
  { d: 0.06, r: [null, 'beam', null] },
  { d: 0.06, r: ['beam', null, null] },
  { d: 0.06, r: [null, null, 'beam'] },
  { d: 0.12, r: ['block', null, null] },
  { d: 0.12, r: [null, null, 'block'] },
  { d: 0.16, r: [null, 'block', null] },
  // --- two lanes: forces a specific lane ---
  { d: 0.26, r: ['block', 'block', null] },
  { d: 0.26, r: [null, 'block', 'block'] },
  { d: 0.32, r: ['block', null, 'block'] },
  { d: 0.36, r: ['barrier', 'barrier', null] },
  { d: 0.36, r: [null, 'beam', 'beam'] },
  // --- full width, uniform action: one move clears it ---
  { d: 0.42, r: ['barrier', 'barrier', 'barrier'] },
  { d: 0.48, r: ['beam', 'beam', 'beam'] },
  // --- mixed: lane choice decides which move you make ---
  { d: 0.50, r: ['barrier', 'block', null] },
  { d: 0.54, r: [null, 'block', 'barrier'] },
  { d: 0.58, r: ['beam', 'block', null] },
  { d: 0.62, r: [null, 'block', 'beam'] },
  { d: 0.66, r: [null, 'drone', null], patrol: 3 },
  { d: 0.72, r: ['block', 'drone', null] },
  { d: 0.78, r: ['barrier', 'beam', 'barrier'] },
  { d: 0.84, r: ['drone', null, 'drone'] },
  { d: 0.90, r: ['block', 'barrier', 'block'] },
  { d: 0.95, r: ['beam', 'block', 'beam'] }
];

const lanesOpen = row => { const o = []; row.forEach((k, i) => { if (k !== 'block') o.push(i); }); return o; };
const lanesFree = row => { const o = []; row.forEach((k, i) => { if (!k) o.push(i); }); return o; };

class TrackManager {
  constructor(app, root, obstacles, coins) {
    this.app = app; this.root = root;
    this.obstacles = obstacles; this.coins = coins;
    this.kits = { towers: new TowerKit(root), props: new PropKit(root), lamps: new LampKit(root) };
    this.districts = buildDistrictProfiles();
    this.segments = [];
    this.distance = 0;
    this.speed = CFG.speedStart;
    this.difficulty = 0;
    this.trackBase = 0; this.lastRowTrack = -999;
    this.lastOpen = null; this.lastForced = false; this.graceUntil = 0;
    this.districtCursor = 0;
    for (let i = 0; i < Q.trackSegments; i++) {
      const seg = new TrackSegment(app, i, this.kits);
      seg.setZ(CFG.segmentLength - i * CFG.segmentLength);
      root.addChild(seg.root);
      this.segments.push(seg);
    }
  }

  _districtFor(cursor) {
    const idx = Math.floor(cursor / CFG.districtBlockSegments) % CFG.districts.length;
    return CFG.districts[idx];
  }

  reset(difficultyMgr) {
    this.distance = 0;
    this.speed = difficultyMgr ? difficultyMgr.speed : CFG.speedStart;
    this.difficulty = 0;
    this.trackBase = 0; this.lastRowTrack = -999;
    this.lastOpen = null; this.lastForced = false;
    this.districtCursor = 0;
    this.graceUntil = CFG.segmentLength * 1.5 + this.speed * CFG.fairness.graceSeconds;
    this.segments.forEach((seg, i) => {
      seg.setZ(CFG.segmentLength - i * CFG.segmentLength);
      const name = this._districtFor(this.districtCursor); this.districtCursor++;
      seg.populate(this.districts[name], name);
      this._populate(seg, 0);
    });
  }

  // attract-mode / menu: keep the city standing, only strip gameplay objects
  clearAll() { for (const seg of this.segments) this._clear(seg); }

  _clear(seg) {
    for (const o of seg.obstacles) this.obstacles.pools[o._kind].release(o);
    for (const c of seg.coins) this.coins.release(c);
    seg.obstacles.length = 0; seg.coins.length = 0;
  }

  _rowAllowed(row, gapM, forcedGap) {
    const r = row.r;
    if (r.every(k => k === 'block')) return false;
    if (r.every(k => k)) {
      const kinds = {}; r.forEach(k => kinds[k] = 1);
      if (kinds.block) return false;
      if (Object.keys(kinds).length > 1) return false;
      if (gapM < forcedGap * CFG.fairness.fullRowGapScale) return false;
    }
    if (this.lastForced && gapM < forcedGap) return false;
    if (this.lastOpen && gapM < forcedGap) {
      const open = lanesOpen(r);
      if (open.length < 2) return false;
      if (!this.lastOpen.some(l => open.indexOf(l) >= 0)) return false;
    }
    return true;
  }

  _pickRow(difficulty, gapM, forcedGap) {
    const pool = ROWS.filter(r => r.d <= difficulty + 0.001 && this._rowAllowed(r, gapM, forcedGap));
    if (!pool.length) {
      const simple = ROWS.filter(r => r.d <= 0.06 && this._rowAllowed(r, gapM, forcedGap));
      return simple.length ? M.pick(simple) : null;
    }
    return Math.random() < 0.55 ? pool[M.randInt(Math.floor(pool.length * 0.5), pool.length - 1)] : M.pick(pool);
  }

  _populate(seg, difficulty) {
    this._clear(seg);
    const L = CFG.segmentLength, half = L / 2;
    const base = this.trackBase; this.trackBase += L;
    const rowsInfo = [];

    if (difficulty >= 0) {
      const gap = this.gapM = Math.max(8, this.speed * M.lerp(CFG.fairness.gapSecondsEasy, CFG.fairness.gapSecondsHard, difficulty));
      const forcedGap = Math.max(gap, this.speed * M.lerp(CFG.fairness.forcedGapEasy, CFG.fairness.forcedGapHard, difficulty));
      const maxRows = difficulty < CFG.fairness.twoRowThreshold ? 1 : 2;

      let u = Math.max(2.5, this.lastRowTrack + gap - base);
      let placed = 0;
      while (u <= L - 2.5 && placed < maxRows) {
        if (base + u < this.graceUntil) { u = this.graceUntil - base + 1; continue; }
        const gapM = (base + u) - this.lastRowTrack;
        const row = this._pickRow(difficulty, gapM, forcedGap);
        if (row) {
          const z = half - u;
          row.r.forEach((kind, lane) => {
            if (!kind) return;
            const patrol = kind === 'drone' ? (row.patrol || 0) : 0;
            seg.obstacles.push(this.obstacles.spawn(kind, seg.root, CFG.lanes[lane], z, { patrol: patrol }));
          });
          this.lastRowTrack = base + u;
          this.lastOpen = lanesOpen(row.r);
          this.lastForced = row.r.some(k => k === 'block');
          rowsInfo.push({ z: z, open: this.lastOpen, free: lanesFree(row.r) });
          if (this.onRow) this.onRow({ track: this.lastRowTrack, gap: gapM, kinds: row.r.slice(), open: this.lastOpen.slice(), forced: this.lastForced, speed: this.speed, difficulty: difficulty });
          placed++;
        }
        u += gap * M.rand(1.0, 1.5);
      }
    }
    this._coins(seg, rowsInfo);
  }

  _coins(seg, rowsInfo) {
    const L = CFG.segmentLength, half = L / 2;
    const guide = rowsInfo.length ? rowsInfo[rowsInfo.length - 1] : null;
    const lane = guide ? M.pick(guide.free.length ? guide.free : guide.open) : M.randInt(0, 2);
    const pattern = M.pick(['line', 'arc', 'zig', 'pair']);
    const startZ = -half + M.rand(3, 8);
    const put = (x, y, z) => {
      if (z > half - 1 || z < -half + 1) return;
      for (const o of seg.obstacles) {
        const op = o.getLocalPosition();
        if (Math.abs(op.x - x) < 1.6 && Math.abs(op.z - z) < o._def.halfD + 1.4 && y < o._def.yMax + 0.3 && y > o._def.yMin - 0.3) return;
      }
      seg.coins.push(this.coins.spawn(seg.root, x, y, z));
    };
    if (pattern === 'line') {
      for (let i = 0; i < 8; i++) put(CFG.lanes[lane], 1.05, startZ + i * 1.7);
    } else if (pattern === 'arc') {
      for (let i = 0; i < 9; i++) { const t = i / 8; put(CFG.lanes[lane], 1.0 + Math.sin(t * Math.PI) * 1.5, startZ + i * 1.7); }
    } else if (pattern === 'zig') {
      for (let i = 0; i < 9; i++) put(CFG.lanes[(lane + (i < 3 ? 0 : (i < 6 ? 1 : 2))) % 3], 1.05, startZ + i * 1.7);
    } else {
      for (let i = 0; i < 6; i++) { put(CFG.lanes[lane], 1.05, startZ + i * 1.8); put(CFG.lanes[(lane + 2) % 3], 1.05, startZ + i * 1.8); }
    }
  }

  update(dt, speed, difficulty) {
    this.speed = speed; this.difficulty = difficulty;
    const move = speed * dt;
    this.distance += move;
    let minZ = Infinity;
    for (const s of this.segments) minZ = Math.min(minZ, s.z);
    for (const seg of this.segments) {
      const z = seg.z + move;
      if (z > CFG.segmentLength * 1.6) {
        const nz = minZ - CFG.segmentLength + move;
        seg.setZ(nz);
        minZ = nz;
        const name = this._districtFor(this.districtCursor); this.districtCursor++;
        seg.populate(this.districts[name], name);
        this._populate(seg, difficulty);
      } else {
        seg.setZ(z);
      }
    }
  }

  // the district the player is currently running through, for ambient tint
  currentDistrict() {
    let best = null, bestAbs = Infinity;
    for (const seg of this.segments) { const az = Math.abs(seg.z); if (az < bestAbs) { bestAbs = az; best = seg; } }
    return best ? best.district : null;
  }

  forEachNear(zWindow, fn) {
    for (const seg of this.segments) {
      const sz = seg.z;
      if (sz < -zWindow - CFG.segmentLength || sz > zWindow + CFG.segmentLength) continue;
      for (const o of seg.obstacles) fn(o, sz + o.getLocalPosition().z, seg);
      for (const c of seg.coins) fn(c, sz + c.getLocalPosition().z, seg);
    }
  }
}

export { TrackManager };
