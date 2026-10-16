// @ts-nocheck
import { CFG } from "./GameConfig";
import { M } from "./MathUtils";

class DifficultyManager {
  constructor(cfg) { this.cfg = cfg || CFG; this.reset(); }

  reset() {
    this.runTime = 0;
    this.speed = this.cfg.speedKeys[0].v;
    this.targetSpeed = this.speed;
    this.difficulty = 0;
    this.tier = this.cfg.tiers[0].name;
    this._tierIndex = 0;
    this.onTierChange = this.onTierChange || null;
  }

  // smoothstep between keyframes: no corners, no sudden steps between bands
  static sample(keys, t) {
    if (t <= keys[0].t) return keys[0].v;
    const last = keys[keys.length - 1];
    if (t >= last.t) return last.v;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t >= a.t && t <= b.t) {
        const u = (t - a.t) / (b.t - a.t);
        return a.v + (b.v - a.v) * (u * u * (3 - 2 * u));
      }
    }
    return last.v;
  }

  update(dt) {
    const c = this.cfg;
    this.runTime += dt;
    this.targetSpeed = Math.min(c.speedMax, DifficultyManager.sample(c.speedKeys, this.runTime));
    // damp on top of the curve so even a config edit can't produce a jolt
    this.speed = Math.min(c.speedMax, M.damp(this.speed, this.targetSpeed, 1.6, dt));
    this.difficulty = M.clamp(DifficultyManager.sample(c.difficultyKeys, this.runTime), 0, 1);

    let idx = 0;
    for (let i = 0; i < c.tiers.length; i++) if (this.difficulty >= c.tiers[i].at) idx = i;
    if (idx !== this._tierIndex) {
      this._tierIndex = idx; this.tier = c.tiers[idx].name;
      if (this.onTierChange) this.onTierChange(this.tier);
    }
    return this.speed;
  }

  get atMaxSpeed() { return this.speed >= this.cfg.speedMax - 0.02; }
  get speedNorm() {
    const c = this.cfg;
    return M.clamp((this.speed - c.speedKeys[0].v) / Math.max(0.001, c.speedMax - c.speedKeys[0].v), 0, 1);
  }
  // reaction window in metres, widened at low difficulty and never below the floor
  gapMetres() {
    const f = this.cfg.fairness;
    return this.speed * M.lerp(f.gapSecondsEasy, f.gapSecondsHard, this.difficulty);
  }
  forcedGapMetres() {
    const f = this.cfg.fairness;
    return this.speed * M.lerp(f.forcedGapEasy, f.forcedGapHard, this.difficulty);
  }
}


export { DifficultyManager };
