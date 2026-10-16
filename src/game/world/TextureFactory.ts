// KYNEX Stage 3 module extracted from the verified FPS-optimized Stage 2 runtime.
// @ts-nocheck

import * as pc from "playcanvas";
import { M } from "../core/MathUtils";
import { Q } from "../core/PlatformQuality";

/* ================================================================
   FILE: Scripts/Materials/TextureFactory.mjs
   Every texture in KYNEX is authored procedurally on a 2D canvas at
   boot: asphalt, concrete, facades with lit windows, brushed metal,
   wood, gold. No network requests, no licensing questions, and each
   one ships base colour + a matching normal/roughness pair so the
   PBR response is real rather than flat colour.
   TEMPORARY: these stand in for authored PBR texture sets.
   ================================================================ */
const TexF = (function () {
  let device = null;
  const cache = {};
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  function upload(canvas, srgb, name, aniso) {
    const t = new pc.Texture(device, {
      name: name, width: canvas.width, height: canvas.height, mipmaps: true,
      format: srgb && pc.PIXELFORMAT_SRGBA8 ? pc.PIXELFORMAT_SRGBA8 : pc.PIXELFORMAT_RGBA8,
      srgb: !!srgb, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR, magFilter: pc.FILTER_LINEAR,
      anisotropy: Math.min(aniso || 8, Q.textureAnisotropy)
    });
    t.setSource(canvas);
    return t;
  }

  // value noise -> greyscale canvas, used as the base for grain and normals
  function noiseCanvas(size, scale, octaves, seedFn) {
    const c = cv(size, size), x = c.getContext('2d');
    const img = x.createImageData(size, size), d = img.data;
    const grid = [];
    for (let o = 0; o < octaves; o++) {
      const n = Math.max(2, Math.round(scale * Math.pow(2, o))), g = new Float32Array(n * n);
      for (let i = 0; i < g.length; i++) g[i] = Math.random();
      grid.push({ n, g });
    }
    const sample = (layer, u, v) => {
      const n = layer.n, g = layer.g;
      const fx = u * n, fy = v * n;
      const x0 = Math.floor(fx) % n, y0 = Math.floor(fy) % n;
      const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
      let tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = g[y0 * n + x0] * (1 - tx) + g[y0 * n + x1] * tx;
      const b = g[y1 * n + x0] * (1 - tx) + g[y1 * n + x1] * tx;
      return a * (1 - ty) + b * ty;
    };
    for (let y = 0; y < size; y++) for (let x2 = 0; x2 < size; x2++) {
      let v = 0, amp = 1, tot = 0;
      for (let o = 0; o < octaves; o++) { v += sample(grid[o], x2 / size, y / size) * amp; tot += amp; amp *= 0.5; }
      v /= tot;
      if (seedFn) v = seedFn(v, x2 / size, y / size);
      const p = (y * size + x2) * 4, g = Math.round(M.clamp(v, 0, 1) * 255);
      d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  // Sobel a height canvas into a tangent-space normal map
  function normalFrom(heightCanvas, strength) {
    const s = heightCanvas.width;
    const hx = heightCanvas.getContext('2d').getImageData(0, 0, s, s).data;
    const out = cv(s, s), ox = out.getContext('2d'), img = ox.createImageData(s, s), d = img.data;
    const H = (x, y) => hx[(((y + s) % s) * s + ((x + s) % s)) * 4] / 255;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const p = (y * s + x) * 4;
      d[p] = (nx * 0.5 + 0.5) * 255; d[p + 1] = (ny * 0.5 + 0.5) * 255; d[p + 2] = (nz * 0.5 + 0.5) * 255; d[p + 3] = 255;
    }
    ox.putImageData(img, 0, 0);
    return out;
  }

  /* ---- asphalt: dark aggregate, wear streaks, painted lane lines ---- */
  function asphaltPair() {
    const S = 512, h = noiseCanvas(S, 26, 4), c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = '#2B2E3C'; x.fillRect(0, 0, S, S);
    x.globalAlpha = 0.55; x.drawImage(h, 0, 0, S, S); x.globalAlpha = 1;
    x.globalCompositeOperation = 'overlay';
    x.fillStyle = '#3A3F55'; x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = 'source-over';
    // tyre polish down the driving lines + patches of repair
    const g = x.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(180,190,220,.10)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) {
      x.globalAlpha = M.rand(.04, .12); x.fillStyle = Math.random() < .5 ? '#191B26' : '#474C63';
      const w = M.rand(20, 130), hh = M.rand(10, 70);
      x.fillRect(M.rand(0, S), M.rand(0, S), w, hh);
    }
    // cracks
    x.globalAlpha = .35; x.strokeStyle = '#14161F'; x.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) {
      x.beginPath(); let px = M.rand(0, S), py = M.rand(0, S); x.moveTo(px, py);
      for (let s2 = 0; s2 < 7; s2++) { px += M.rand(-45, 45); py += M.rand(-45, 45); x.lineTo(px, py); }
      x.stroke();
    }
    x.globalAlpha = 1;
    return { color: upload(c, true, 'asphalt', 16), normal: upload(normalFrom(h, 1.7), false, 'asphaltN', 8) };
  }

  /* ---- concrete for kerbs, platforms, plazas ---- */
  function concretePair(tint) {
    const S = 256, h = noiseCanvas(S, 12, 4), c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = tint || '#8E93A6'; x.fillRect(0, 0, S, S);
    x.globalAlpha = .35; x.drawImage(h, 0, 0, S, S); x.globalAlpha = 1;
    x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 2;
    x.strokeRect(1, 1, S - 2, S - 2);
    for (let i = 0; i < 70; i++) { x.globalAlpha = M.rand(.03, .10); x.fillStyle = '#4C5163'; x.fillRect(M.rand(0, S), M.rand(0, S), M.rand(2, 9), M.rand(2, 9)); }
    x.globalAlpha = 1;
    return { color: upload(c, true, 'concrete', 8), normal: upload(normalFrom(h, 1.1), false, 'concreteN', 4) };
  }

  /* ---- tower facade: window grid, some rooms lit ---- */
  function facade(base, glass, litColor, litChance) {
    const S = 512, c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    const cols = 8, rows = 16, pw = S / cols, ph = S / rows;
    const em = cv(S, S), ex = em.getContext('2d');
    ex.fillStyle = '#000'; ex.fillRect(0, 0, S, S);
    for (let r = 0; r < rows; r++) for (let cI = 0; cI < cols; cI++) {
      const px = cI * pw, py = r * ph, mx = pw * .18, my = ph * .22;
      x.fillStyle = 'rgba(0,0,0,.30)'; x.fillRect(px + mx - 2, py + my - 2, pw - mx * 2 + 4, ph - my * 2 + 4);
      const lit = Math.random() < litChance;
      x.fillStyle = lit ? litColor : glass;
      x.fillRect(px + mx, py + my, pw - mx * 2, ph - my * 2);
      if (lit) { ex.fillStyle = litColor; ex.fillRect(px + mx, py + my, pw - mx * 2, ph - my * 2); }
      // spandrel band under each floor
      x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(px, py + ph - my * .6, pw, 2);
    }
    // vertical mullions catching the sun
    for (let cI = 0; cI <= cols; cI++) { x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(cI * pw - 1, 0, 2, S); }
    return { color: upload(c, true, 'facade', 8), emissive: upload(em, true, 'facadeE', 4) };
  }

  /* ---- shipping crate / plywood ---- */
  function woodPair() {
    const S = 256, h = noiseCanvas(S, 5, 3, (v, u) => M.clamp(v * .6 + Math.sin(u * 70) * .18 + .3, 0, 1));
    const c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = '#9A6534'; x.fillRect(0, 0, S, S);
    x.globalAlpha = .5; x.drawImage(h, 0, 0, S, S); x.globalAlpha = 1;
    x.globalCompositeOperation = 'multiply'; x.fillStyle = '#C98A4B'; x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = 'source-over';
    x.strokeStyle = 'rgba(70,40,15,.55)'; x.lineWidth = 6;
    x.strokeRect(3, 3, S - 6, S - 6);
    x.beginPath(); x.moveTo(3, 3); x.lineTo(S - 3, S - 3); x.moveTo(S - 3, 3); x.lineTo(3, S - 3); x.stroke();
    return { color: upload(c, true, 'wood', 8), normal: upload(normalFrom(h, 1.4), false, 'woodN', 4) };
  }

  /* ---- brushed metal ---- */
  function metalPair() {
    const S = 256, h = noiseCanvas(S, 60, 2, (v, u, vv) => M.clamp(v * .35 + Math.sin(vv * 420) * .12 + .45, 0, 1));
    const c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = '#9BA3B4'; x.fillRect(0, 0, S, S);
    x.globalAlpha = .4; x.drawImage(h, 0, 0, S, S); x.globalAlpha = 1;
    return { color: upload(c, true, 'metal', 8), normal: upload(normalFrom(h, .8), false, 'metalN', 4) };
  }

  /* ---- hazard chevrons for barriers ---- */
  function hazard(a, b) {
    const S = 256, c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = a; x.fillRect(0, 0, S, S);
    x.fillStyle = b; x.save(); x.translate(-S, 0);
    for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(i * 44, 0); x.lineTo(i * 44 + 22, 0); x.lineTo(i * 44 + 22 + S, S); x.lineTo(i * 44 + S, S); x.closePath(); x.fill(); }
    x.restore();
    x.fillStyle = 'rgba(0,0,0,.20)'; x.fillRect(0, 0, S, 10); x.fillRect(0, S - 10, S, 10);
    return upload(c, true, 'hazard', 8);
  }

  /* ---- neon sign faces for the midground ---- */
  function signFace(text, bg, fg) {
    const W = 512, H = 256, c = cv(W, H), x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.strokeStyle = fg; x.lineWidth = 10; x.strokeRect(16, 16, W - 32, H - 32);
    x.fillStyle = fg; x.font = '700 104px "Chakra Petch", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = fg; x.shadowBlur = 34;
    x.fillText(text, W / 2, H / 2 + 4);
    return upload(c, true, 'sign', 4);
  }

  /* ---- soft radial sprite for sparks and dust ---- */
  function radial(inner, outer) {
    const S = 128, c = cv(S, S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, inner); g.addColorStop(.45, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return upload(c, true, 'radial', 2);
  }

  /* ---- puddle: a faint reflective patch for sidewalks after "rain" ---- */
  function puddle() {
    const S = 128, c = cv(S, S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(140,170,220,.55)'); g.addColorStop(.6, 'rgba(120,150,210,.30)'); g.addColorStop(1, 'rgba(120,150,210,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return upload(c, true, 'puddle', 2);
  }

  /* ---- contact shadow blob: multiplied under the runner's feet ---- */
  function blobShadow() {
    const S = 128, c = cv(S, S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgb(46,40,70)'); g.addColorStop(.45, 'rgb(120,112,150)'); g.addColorStop(1, 'rgb(255,255,255)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    const t = upload(c, true, 'blob', 2);
    t.addressU = pc.ADDRESS_CLAMP_TO_EDGE; t.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
    return t;
  }

  /* ---- sky gradient: golden hour over a cool city ---- */
  function skyGradient() {
    const W = 16, H = 512, c = cv(W, H), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.00, '#1B2260');
    g.addColorStop(0.34, '#4A4E9B');
    g.addColorStop(0.58, '#B06E86');
    g.addColorStop(0.76, '#F0955C');
    g.addColorStop(0.90, '#FFC878');
    g.addColorStop(1.00, '#FFE0A8');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const t = upload(c, true, 'sky', 1);
    t.addressU = pc.ADDRESS_CLAMP_TO_EDGE; t.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
    return t;
  }

  return {
    init(dev) { device = dev; },
    get(key, fn) { if (!cache[key]) cache[key] = fn(); return cache[key]; },
    asphaltPair, concretePair, facade, woodPair, metalPair, hazard, signFace, radial, skyGradient, blobShadow, puddle
  };
})();

/* ================================================================
   FILE: Scripts/Materials/MaterialLibrary.mjs
   One shared material per surface type: fewer shader variants,
   fewer state changes, consistent lighting response.
   ================================================================ */
const MatLib = (function () {
  const lib = {};
  function std(o) {
    const m = new pc.StandardMaterial();
    m.useMetalness = true;
    m.diffuse = o.diffuse || new pc.Color(1, 1, 1);
    if (o.map) m.diffuseMap = o.map;
    if (o.normal) { m.normalMap = o.normal; m.bumpiness = o.bumpiness == null ? 1 : o.bumpiness; }
    m.metalness = o.metalness == null ? 0 : o.metalness;
    m.gloss = o.gloss == null ? 0.35 : o.gloss;
    if (o.tiling) { const t = new pc.Vec2(o.tiling[0], o.tiling[1]); m.diffuseMapTiling = t; m.normalMapTiling = t; m.emissiveMapTiling = t; }
    if (o.emissive) m.emissive = o.emissive;
    if (o.emissiveMap) m.emissiveMap = o.emissiveMap;
    if (o.emissiveIntensity != null) m.emissiveIntensity = o.emissiveIntensity;
    if (o.opacity != null) { m.opacity = o.opacity; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; }
    if (o.blend) { m.blendType = o.blend; m.depthWrite = false; }
    if (o.cull != null) m.cull = o.cull;
    if (o.useFog === false) m.useFog = false;
    if (o.unlit) {
      // unlit surfaces carry their colour on the emissive channel
      m.useLighting = false;
      if (o.map) m.emissiveMap = o.map;
      m.emissive = o.emissive || new pc.Color(1, 1, 1);
      m.diffuse = new pc.Color(0, 0, 0);
      if (o.alpha && o.map) { m.opacityMap = o.map; m.opacityMapChannel = 'a'; m.blendType = o.blend || pc.BLEND_NORMAL; m.depthWrite = false; }
    }
    m.update();
    return m;
  }
  return {
    build() {
      const asphalt = TexF.asphaltPair();
      const conc = TexF.concretePair('#96A0B4');
      const concDark = TexF.concretePair('#6B7183');
      const wood = TexF.woodPair();
      const metal = TexF.metalPair();

      lib.road = std({ map: asphalt.color, normal: asphalt.normal, tiling: [2, 6], gloss: .38, metalness: .02, diffuse: new pc.Color(.80, .82, .88) });
      lib.roadPaint = std({ diffuse: new pc.Color(1.0, .96, .84), gloss: .28, emissive: new pc.Color(.45, .42, .28), emissiveIntensity: .42 });
      lib.roadGlow = std({ diffuse: new pc.Color(.025, .12, .15), gloss: .60, emissive: new pc.Color(.10, .72, .69), emissiveIntensity: 2.35, metalness: .18 });
      lib.kerb = std({ map: conc.color, normal: conc.normal, tiling: [1, 8], gloss: .22 });
      lib.sidewalk = std({ map: conc.color, normal: conc.normal, tiling: [2, 10], gloss: .18, diffuse: new pc.Color(.82, .84, .9) });
      lib.concrete = std({ map: concDark.color, normal: concDark.normal, tiling: [1, 1], gloss: .2 });
      lib.wood = std({ map: wood.color, normal: wood.normal, tiling: [1, 1], gloss: .25 });
      lib.metal = std({ map: metal.color, normal: metal.normal, tiling: [1, 1], metalness: .92, gloss: .55 });
      lib.metalDark = std({ map: metal.color, normal: metal.normal, tiling: [1, 1], metalness: .85, gloss: .40, diffuse: new pc.Color(.34, .36, .44) });
      lib.hazard = std({ map: TexF.hazard('#F0B429', '#23262F'), tiling: [3, 1], gloss: .45, metalness: .15 });
      lib.gold = std({ diffuse: new pc.Color(1, .78, .22), metalness: .98, gloss: .82, emissive: new pc.Color(1, .66, .12), emissiveIntensity: .55 });
      lib.rubber = std({ diffuse: new pc.Color(.09, .10, .13), gloss: .15 });
      lib.glassDark = std({ diffuse: new pc.Color(.10, .13, .26), metalness: .6, gloss: .86 });

      // facades: five families, one accent per district, so the skyline reads
      // as distinct neighbourhoods rather than one pattern repeating
      lib.facades = [
        (function () { const f = TexF.facade('#3C4470', '#1B2246', '#FFD9A0', .26); return std({ map: f.color, normal: null, tiling: [1, 1], gloss: .46, metalness: .12, emissiveMap: f.emissive, emissive: new pc.Color(1, 1, 1), emissiveIntensity: 1.5 }); })(),   // 0 neonDowntown — amber windows
        (function () { const f = TexF.facade('#2E4E63', '#14263A', '#9AF0FF', .20); return std({ map: f.color, tiling: [1, 1], gloss: .52, metalness: .2, emissiveMap: f.emissive, emissive: new pc.Color(1, 1, 1), emissiveIntensity: 1.5 }); })(),   // 1 elevatedCity — cool cyan glass
        (function () { const f = TexF.facade('#4A2A56', '#20122E', '#E19CFF', .24); return std({ map: f.color, tiling: [1, 1], gloss: .48, metalness: .16, emissiveMap: f.emissive, emissive: new pc.Color(1, 1, 1), emissiveIntensity: 1.7 }); })(),   // 2 cyberDistrict — violet holo glow
        (function () { const f = TexF.facade('#5C3A2E', '#2A180F', '#FFC27A', .34); return std({ map: f.color, tiling: [1, 1], gloss: .30, metalness: .05, emissiveMap: f.emissive, emissive: new pc.Color(1, 1, 1), emissiveIntensity: 1.5 }); })(),   // 3 cyberMarket — warm shopfront glow
        (function () { const f = TexF.facade('#3A3E48', '#1B1D24', '#CFE0EC', .08); return std({ map: f.color, tiling: [1, 1], gloss: .22, metalness: .10, emissiveMap: f.emissive, emissive: new pc.Color(1, 1, 1), emissiveIntensity: 1.1 }); })()    // 4 industrial — dim service lighting
      ];

      lib.signs = [
        std({ map: TexF.signFace('KYNEX', '#120C2A', '#35E8E0'), emissiveMap: TexF.signFace('KYNEX', '#000000', '#35E8E0'), emissive: new pc.Color(1, 1, 1), emissiveIntensity: 3.0, gloss: .5 }),
        std({ map: TexF.signFace('24/7', '#2A0C22', '#FF3D8B'), emissiveMap: TexF.signFace('24/7', '#000000', '#FF3D8B'), emissive: new pc.Color(1, 1, 1), emissiveIntensity: 3.0, gloss: .5 }),
        std({ map: TexF.signFace('NORTH', '#1E1A06', '#FFC53D'), emissiveMap: TexF.signFace('NORTH', '#000000', '#FFC53D'), emissive: new pc.Color(1, 1, 1), emissiveIntensity: 2.6, gloss: .5 })
      ];
      // per-district sign sets: same factory, different text/colour so a
      // market reads differently to a transit corridor without new geometry
      lib.signSets = {
        neonDowntown: lib.signs,
        cyberMarket: [
          std({ map: TexF.signFace('MART', '#241004', '#FFA23D'), emissiveMap: TexF.signFace('MART', '#000000', '#FFA23D'), emissive: new pc.Color(1, 1, 1), emissiveIntensity: 3.0, gloss: .5 }),
          std({ map: TexF.signFace('24/7', '#2A0C22', '#FF3D8B'), emissiveMap: TexF.signFace('24/7', '#000000', '#FF3D8B'), emissive: new pc.Color(1, 1, 1), emissiveIntensity: 3.0, gloss: .5 }),
          std({ map: TexF.signFace('FRESH', '#0E220E', '#7CFF6B'), emissiveMap: TexF.signFace('FRESH', '#000000', '#7CFF6B'), emissive: new pc.Color(1, 1, 1), emissiveIntensity: 2.8, gloss: .5 })
        ],
        industrial: [
          std({ map: TexF.signFace('WORKS', '#1C1A06', '#FFC53D'), emissiveMap: TexF.signFace('WORKS', '#000000', '#FFC53D'), emissive: new pc.Color(1, 1, 1), emissiveIntensity: 2.4, gloss: .5 }),
          std({ map: TexF.signFace('ZONE 4', '#1E1406', '#FF9A3C'), emissiveMap: TexF.signFace('ZONE 4', '#000000', '#FF9A3C'), emissive: new pc.Color(1, 1, 1), emissiveIntensity: 2.4, gloss: .5 })
        ],
        elevatedCity: [
          std({ map: TexF.signFace('TRANSIT', '#0A1A2A', '#6BD8FF'), emissiveMap: TexF.signFace('TRANSIT', '#000000', '#6BD8FF'), emissive: new pc.Color(1, 1, 1), emissiveIntensity: 2.8, gloss: .5 }),
          std({ map: TexF.signFace('NORTH', '#1E1A06', '#FFC53D'), emissiveMap: TexF.signFace('NORTH', '#000000', '#FFC53D'), emissive: new pc.Color(1, 1, 1), emissiveIntensity: 2.6, gloss: .5 })
        ],
        cyberDistrict: [
          std({ map: TexF.signFace('NEXUS', '#1A0A2A', '#C79BFF'), emissiveMap: TexF.signFace('NEXUS', '#000000', '#C79BFF'), emissive: new pc.Color(1, 1, 1), emissiveIntensity: 3.4, gloss: .5 }),
          std({ map: TexF.signFace('KYNEX', '#120C2A', '#35E8E0'), emissiveMap: TexF.signFace('KYNEX', '#000000', '#35E8E0'), emissive: new pc.Color(1, 1, 1), emissiveIntensity: 3.2, gloss: .5 })
        ]
      };

      lib.neonCyan = std({ diffuse: new pc.Color(.05, .3, .32), emissive: new pc.Color(.21, .91, .88), emissiveIntensity: 4.0, gloss: .6 });
      lib.neonMagenta = std({ diffuse: new pc.Color(.3, .05, .16), emissive: new pc.Color(1, .24, .55), emissiveIntensity: 4.0, gloss: .6 });
      lib.neonViolet = std({ diffuse: new pc.Color(.18, .05, .3), emissive: new pc.Color(.78, .40, 1), emissiveIntensity: 4.0, gloss: .6 });
      lib.neonAmber = std({ diffuse: new pc.Color(.3, .18, .04), emissive: new pc.Color(1, .68, .18), emissiveIntensity: 3.6, gloss: .55 });
      lib.lampGlow = std({ diffuse: new pc.Color(.2, .2, .2), emissive: new pc.Color(1, .82, .52), emissiveIntensity: 5.0 });
      lib.puddle = std({ map: TexF.puddle(), unlit: true, alpha: true, blend: pc.BLEND_NORMAL, emissive: new pc.Color(1, 1, 1), emissiveIntensity: .9, cull: pc.CULLFACE_NONE });
      lib.canvasAwning = std({ diffuse: new pc.Color(.85, .3, .18), gloss: .18 });
      lib.canvasAwningAlt = std({ diffuse: new pc.Color(.18, .55, .75), gloss: .18 });
      lib.warnStripe = std({ diffuse: new pc.Color(.95, .78, .12), gloss: .3, emissive: new pc.Color(.4, .32, 0), emissiveIntensity: .3 });

      // character palette — stylized runner, flat-but-lit surfaces
      lib.skin = std({ diffuse: new pc.Color(.80, .55, .42), gloss: .30 });
      lib.hair = std({ diffuse: new pc.Color(.12, .10, .14), gloss: .42 });
      lib.jacket = std({ diffuse: new pc.Color(.10, .74, .72), gloss: .36, metalness: .05 });
      lib.jacketDark = std({ diffuse: new pc.Color(.06, .30, .38), gloss: .32 });
      lib.pants = std({ diffuse: new pc.Color(.16, .18, .30), gloss: .26 });
      lib.shoe = std({ diffuse: new pc.Color(.95, .95, .98), gloss: .40 });
      lib.shoeSole = std({ diffuse: new pc.Color(1, .30, .55), gloss: .35, emissive: new pc.Color(.5, .08, .22), emissiveIntensity: .5 });
      lib.visor = std({ diffuse: new pc.Color(.02, .05, .08), metalness: .7, gloss: .92, emissive: new pc.Color(.16, .8, .78), emissiveIntensity: 1.6 });
      lib.trim = std({ diffuse: new pc.Color(1, .78, .25), emissive: new pc.Color(1, .6, .1), emissiveIntensity: .8, gloss: .5 });

      // effects
      lib.dust = std({ map: TexF.radial('rgba(255,236,206,.95)', 'rgba(220,196,160,.35)'), unlit: true, alpha: true, blend: pc.BLEND_NORMAL, emissive: new pc.Color(1, .92, .78), emissiveIntensity: 1.1, cull: pc.CULLFACE_NONE });
      lib.spark = std({ map: TexF.radial('rgba(255,255,230,1)', 'rgba(255,190,60,.6)'), unlit: true, alpha: true, blend: pc.BLEND_ADDITIVE, emissive: new pc.Color(1, .85, .45), emissiveIntensity: 3, cull: pc.CULLFACE_NONE });
      lib.sparkPink = std({ map: TexF.radial('rgba(255,255,255,1)', 'rgba(255,61,139,.7)'), unlit: true, alpha: true, blend: pc.BLEND_ADDITIVE, emissive: new pc.Color(1, .3, .55), emissiveIntensity: 3, cull: pc.CULLFACE_NONE });
      lib.blob = std({ map: TexF.blobShadow(), unlit: true, blend: pc.BLEND_MULTIPLICATIVE, emissive: new pc.Color(1, 1, 1), cull: pc.CULLFACE_NONE });
      lib.speedLine = std({ unlit: true, emissive: new pc.Color(.75, .93, 1), emissiveIntensity: 2.2, blend: pc.BLEND_ADDITIVE, opacity: .45 });
      lib.sky = std({ map: TexF.skyGradient(), unlit: true, useFog: false, cull: pc.CULLFACE_FRONT, emissive: new pc.Color(1, 1, 1), emissiveIntensity: 1 });
      lib.silhouette = std({ unlit: true, emissive: new pc.Color(.16, .17, .38) });
      lib.silhouetteFar = std({ unlit: true, emissive: new pc.Color(.34, .31, .55) });
      lib.foliage = std({ diffuse: new pc.Color(.20, .52, .38), gloss: .22 });
      lib.trunk = std({ diffuse: new pc.Color(.28, .22, .19), gloss: .2 });
      return lib;
    },
    get: () => lib
  };
})();

export { TexF, MatLib };
