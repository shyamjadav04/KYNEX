// @ts-nocheck
import * as pc from 'playcanvas';
import { M } from '../core/MathUtils';
import { Pool } from '../core/Pool';
import { MatLib, prim } from '../world/EnvironmentKit';
import { Q } from '../core/PlatformQuality';

class VFXManager {
  constructor(app, root) {
    this.app = app;
    this.root = new pc.Entity('VFX'); root.addChild(this.root);
    const lib = MatLib.get();
    const mk = mat => new Pool(() => prim('plane', mat, [0, 0, 0], [1, 1, 1], [90, 0, 0], { noShadow: true, noReceive: true }), 24, this.root);
    this.pools = { dust: mk(lib.dust), spark: mk(lib.spark), pink: mk(lib.sparkPink) };
    this.live = [];
    this.lines = [];
    for (let i = 0; i < Q.speedLines; i++) {
      const e = prim('box', lib.speedLine, [0, 0, 0], [.04, .04, 3], null, { noShadow: true, noReceive: true });
      e.enabled = false; this.root.addChild(e); this.lines.push(e);
    }
  }
  _emit(kind, pos, n, opt) {
    opt = opt || {};
    for (let i = 0; i < n; i++) {
      const e = this.pools[kind].get();
      e.setPosition(pos.x + M.rand(-.2, .2), pos.y + M.rand(-.1, .2), pos.z + M.rand(-.2, .2));
      const s = opt.size ? M.rand(opt.size * .6, opt.size * 1.4) : M.rand(.25, .6);
      e.setLocalScale(s, s, s);
      e.setLocalEulerAngles(90, 0, M.rand(0, 360));
      this.live.push({
        e: e, kind: kind, life: 0, max: opt.life || M.rand(.35, .7), s0: s,
        v: new pc.Vec3(M.rand(-opt.spread || -1.6, opt.spread || 1.6), M.rand(opt.up || 1.2, (opt.up || 1.2) + 1.8), M.rand(1, 4.5)),
        g: opt.gravity == null ? -5 : opt.gravity, spin: M.rand(-200, 200)
      });
    }
  }
  dust(pos, n) { this._emit('dust', pos, Math.max(1, Math.round((n || 8) * Q.vfxScale)), { size: .55, life: .55, up: .8, spread: 2.2, gravity: -3 }); }
  coin(pos) { this._emit('spark', pos, Math.max(2, Math.round(7 * Q.vfxScale)), { size: .30, life: .40, up: 1.6, spread: 2.4, gravity: -4 }); }
  impact(pos) {
    this._emit('pink', pos, Math.max(4, Math.round(16 * Q.vfxScale)), { size: .55, life: .75, up: 2.4, spread: 4.5, gravity: -7 });
    this._emit('dust', pos, Math.max(2, Math.round(10 * Q.vfxScale)), { size: .8, life: .8, up: 1.2, spread: 3, gravity: -3 });
  }
  update(dt, speed, speedNorm) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) { this.pools[p.kind].release(p.e); this.live.splice(i, 1); continue; }
      p.v.y += p.g * dt;
      const pos = p.e.getPosition();
      p.e.setPosition(pos.x + p.v.x * dt, Math.max(0.02, pos.y + p.v.y * dt), pos.z + (p.v.z + speed) * dt);
      const s = p.s0 * (1 + t * 1.1) * (1 - t * .55);
      p.e.setLocalScale(s, s, s);
      p.e.rotateLocal(0, 0, p.spin * dt);
    }
    // speed lines only show up once the run is genuinely fast
    const on = speedNorm > 0.42;
    for (const l of this.lines) {
      if (!on) { l.enabled = false; continue; }
      if (!l.enabled) { l.enabled = true; l.setPosition(M.rand(-7, 7), M.rand(.4, 5), M.rand(-40, -14)); }
      const p = l.getPosition();
      const z = p.z + speed * 2.4 * dt;
      if (z > 12) l.setPosition(M.rand(-7, 7), M.rand(.4, 5), M.rand(-46, -26)); else l.setPosition(p.x, p.y, z);
      l.setLocalScale(.04, .04, 2 + speedNorm * 6);
    }
  }
  clear() { for (const p of this.live) this.pools[p.kind].release(p.e); this.live.length = 0; }
}

export { VFXManager };
