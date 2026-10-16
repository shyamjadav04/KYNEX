// Stage 7 — pure module export; no global KYNEX registry.
// @ts-nocheck
class Pool {
  constructor(factory, initial, parent) {
    this.factory = factory; this.parent = parent; this.free = []; this.live = [];
    for (let i = 0; i < initial; i++) this.free.push(this._make());
  }
  _make() { const e = this.factory(); e.enabled = false; if (this.parent) this.parent.addChild(e); return e; }
  get() {
    const e = this.free.length ? this.free.pop() : this._make();
    e.enabled = true; this.live.push(e); return e;
  }
  release(e) {
    const i = this.live.indexOf(e); if (i >= 0) this.live.splice(i, 1);
    e.enabled = false; if (e.parent !== this.parent && this.parent) this.parent.addChild(e);
    this.free.push(e);
  }
  releaseAll() { while (this.live.length) this.release(this.live[this.live.length - 1]); }
}
export { Pool };
