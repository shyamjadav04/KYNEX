// @ts-nocheck
import * as pc from 'playcanvas';

class PlayerCollision {
  constructor(player, track, vfx, audio) { this.p = player; this.track = track; this.vfx = vfx; this.audio = audio; }
  test(onCoin, onHit) {
    const c = this.p.collider;
    this.track.forEachNear(6, (e, z, seg) => {
      if (!e.enabled) return;
      if (e._kind) {
        if (this.p.dead || e._hit) return;
        const d = e._def, ex = e.getLocalPosition().x;
        if (Math.abs(z) > d.halfD + 0.5) return;
        if (Math.abs(c.x - ex) > d.halfW + c.halfW - 0.06) return;
        if (c.yMax < d.yMin + 0.02 || c.yMin > d.yMax - 0.02) return;
        e._hit = true;
        onHit(e);
      } else {
        if (e._taken) return;
        const p = e.getLocalPosition();
        if (Math.abs(z) > 0.95) return;
        if (Math.abs(c.x - p.x) > 0.95) return;
        if (p.y < c.yMin - 0.75 || p.y > c.yMax + 0.45) return;
        e._taken = true; e.enabled = false;
        onCoin(new pc.Vec3(p.x, p.y, z));
      }
    });
  }
}

export { PlayerCollision };
