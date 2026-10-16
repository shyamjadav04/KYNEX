// @ts-nocheck
import * as pc from 'playcanvas';
import { Pool } from '../core/Pool';
import { MatLib, prim } from './EnvironmentKit';
import { Q } from '../core/PlatformQuality';

class CoinManager {
  constructor(app, root) {
    this.app = app; this.root = root;
    const lib = MatLib.get();
    this.pool = new Pool(() => {
      const e = new pc.Entity('Coin');
      const disc = prim('cylinder', lib.gold, [0, 0, 0], Q.simpleCoins ? [.47, .055, .47] : [.52, .07, .52], [90, 0, 0], { noShadow: Q.simpleCoins, noReceive: true });
      e.addChild(disc);
      if (!Q.simpleCoins) {
        const ring = prim('torus', lib.gold, [0, 0, 0], [.30, .30, .30], [90, 0, 0], { noShadow: true, noReceive: true });
        e.addChild(ring);
      }
      return e;
    }, 90, root);
  }
  spawn(parent, x, y, z) {
    const e = this.pool.get();
    parent.addChild(e);
    e.setLocalPosition(x, y, z);
    e.setLocalEulerAngles(0, Math.random() * 360, 0);
    e._taken = false;
    return e;
  }
  update(dt) { for (const e of this.pool.live) e.rotateLocal(0, dt * 190, 0); }
  release(e) { this.pool.release(e); }
}

export { CoinManager };
