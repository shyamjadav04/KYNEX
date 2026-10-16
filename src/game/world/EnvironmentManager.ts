// KYNEX Stage 3 module extracted from the verified FPS-optimized Stage 2 runtime.
// @ts-nocheck

import * as pc from "playcanvas";
import { CFG } from "../core/GameConfig";
import { M } from "../core/MathUtils";
import { MatLib } from "./TextureFactory";
import { prim } from "./EnvironmentKit";
import { IS_MOBILE, Q } from "../core/PlatformQuality";

/* ================================================================
   FILE: Scripts/World/EnvironmentManager.mjs
   Golden-hour key light low behind the runner, cool sky fill, warm
   bounce, linear fog tuned to the far clip, sky dome, and two
   parallax skyline bands that recycle forever.
   ================================================================ */
class EnvironmentManager {
  constructor(app, root) { this.app = app; this.root = root; this.bands = []; this.baseFog = null; this.tintTarget = null; }

  build() {
    const app = this.app, lib = MatLib.get();

    // --- atmosphere ---
    app.scene.fog.type = pc.FOG_LINEAR;
    app.scene.fog.color = new pc.Color(0.54, 0.50, 0.64);
    this.baseFog = app.scene.fog.color.clone();
    // Clearer midground while keeping the far skyline softly layered.
    app.scene.fog.start = Q.fogStart;
    app.scene.fog.end = Q.fogEnd;
    app.scene.ambientLight = new pc.Color(0.21, 0.23, 0.36);
    app.scene.exposure = 1.04;
    app.scene.skyboxIntensity = 0.96;

    // --- sky dome (inverted sphere, unlit gradient) ---
    const sky = prim('sphere', lib.sky, [0, 0, 0], [400, 400, 400], [0, 0, 0], { noShadow: true, noReceive: true });
    this.root.addChild(sky);
    this.sky = sky;

    // --- key light: low sun, warm, raking across the lanes ---
    const sun = new pc.Entity('SunLight');
    sun.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1.0, 0.80, 0.56),
      intensity: 2.35,
      castShadows: Q.shadows,
      // Keep the main sun shadow pass affordable now that roadside
      // environment is attached to recycled segments.
      shadowDistance: 70,
      shadowResolution: 1024,
      shadowBias: 0.04,
      normalOffsetBias: 0.05,
      shadowType: pc.SHADOW_PCF3
    });
    try { sun.light.numCascades = Q.shadows ? 2 : 1; sun.light.cascadeDistribution = 0.6; } catch (e) {}
    sun.setLocalEulerAngles(38, 154, 0);
    this.root.addChild(sun);
    this.sun = sun;

    // --- sky fill from above, cool, no shadows ---
    const fill = new pc.Entity('FillLight');
    fill.addComponent('light', { type: 'directional', color: new pc.Color(0.45, 0.55, 0.95), intensity: 0.85, castShadows: false });
    fill.setLocalEulerAngles(58, -30, 0);
    fill.enabled = !IS_MOBILE;
    this.root.addChild(fill);

    // --- rim from the front so the runner's silhouette separates from the road ---
    const rim = new pc.Entity('RimLight');
    rim.addComponent('light', { type: 'directional', color: new pc.Color(1.0, 0.45, 0.62), intensity: 0.6, castShadows: false });
    rim.setLocalEulerAngles(-8, 8, 0);
    rim.enabled = !IS_MOBILE;
    this.root.addChild(rim);

    this._buildSkyline();
    return this;
  }

  // Two depth bands of blocky towers drifting toward the camera at a
  // fraction of the run speed. Each tower recycles individually far
  // inside the fog, so the horizon never pops as a whole.
  _buildSkyline() {
    const lib = MatLib.get();
    const mk = (zNear, depth, count, mat, hRange, scale, speedScale) => {
      const band = new pc.Entity('SkylineBand');
      this.root.addChild(band);
      const towers = [];
      for (let i = 0; i < count; i++) {
        const h = M.rand(hRange[0], hRange[1]) * scale;
        const w = M.rand(8, 18) * scale;
        const t = prim('box', mat, [M.rand(-230, 230), h / 2 - 5, zNear - Math.random() * depth], [w, h, w * .85], null, { noShadow: true, noReceive: true });
        band.addChild(t); towers.push(t);
        if (Math.random() < .25) {
          const lp = t.getLocalPosition();
          const spire = prim('cylinder', mat, [lp.x + M.rand(-2, 2), h + 4, lp.z], [.7, 8, .7], null, { noShadow: true, noReceive: true });
          band.addChild(spire); towers.push(spire);
        }
      }
      this.bands.push({ towers, zNear, depth, speedScale });
    };
    mk(-220, 100, Q.skylineNear, lib.silhouette, [16, 50], 1.0, 0.08);
    mk(-350, 120, Q.skylineFar, lib.silhouetteFar, [26, 82], 1.35, 0.025);
  }

  // subtly shifts fog toward the current district's accent so a
  // market feels warmer and a cyber district feels colder-violet,
  // without abandoning the shared golden-hour identity
  setDistrictTint(color) { this.tintTarget = color; }

  update(dt, speed) {
    if (this.tintTarget && this.app.scene.fog.color) {
      const c = this.app.scene.fog.color, t = this.tintTarget;
      c.r = M.damp(c.r, M.lerp(this.baseFog.r, t.r, 0.35), 0.6, dt);
      c.g = M.damp(c.g, M.lerp(this.baseFog.g, t.g, 0.35), 0.6, dt);
      c.b = M.damp(c.b, M.lerp(this.baseFog.b, t.b, 0.35), 0.6, dt);
    }
    for (const b of this.bands) {
      const move = speed * b.speedScale * dt;
      for (const t of b.towers) {
        const p = t.getLocalPosition();
        let z = p.z + move;
        if (z > b.zNear) { z -= b.depth; t.setLocalPosition(M.rand(-230, 230), p.y, z); }
        else t.setLocalPosition(p.x, p.y, z);
      }
    }
  }
  setShadows(on) { if (this.sun) this.sun.light.castShadows = on; }
}


export { EnvironmentManager };
