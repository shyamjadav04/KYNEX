// @ts-nocheck
// Lightweight automatic quality profile for phones/tablets.
// Desktop keeps the existing Stage 11 quality; mobile gets cheaper rendering.
export const IS_MOBILE = (() => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const uaMobile = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(ua);
  const touchSmall = (navigator.maxTouchPoints || 0) > 1 && Math.min(window.innerWidth, window.innerHeight) <= 900;
  return uaMobile || touchSmall;
})();

export const Q = IS_MOBILE ? {
  maxPixelRatio: 1.0,
  antialias: false,
  shadows: false,
  farClip: 300,
  fogStart: 45,
  fogEnd: 165,
  trackSegments: 7,
  skylineNear: 14,
  skylineFar: 10,
  towerScale: 0.72,
  propScale: 0.58,
  roadMarkStep: 5.4,
  puddles: false,
  lamps: 1,
  lampLights: false,
  billboardSigns: false,
  vfxScale: 0.55,
  speedLines: 7,
  simpleCoins: true,
  textureAnisotropy: 2,
  bodyVideoWidth: 480,
  bodyVideoHeight: 270,
  bodyFps: 10,
  bodyFrameMs: 100
} : {
  maxPixelRatio: 2.0,
  antialias: true,
  shadows: true,
  farClip: 460,
  fogStart: 65,
  fogEnd: 220,
  trackSegments: 9,
  skylineNear: 26,
  skylineFar: 22,
  towerScale: 1,
  propScale: 1,
  roadMarkStep: 4.2,
  puddles: true,
  lamps: 2,
  lampLights: true,
  billboardSigns: true,
  vfxScale: 1,
  speedLines: 14,
  simpleCoins: false,
  textureAnisotropy: 8,
  bodyVideoWidth: 640,
  bodyVideoHeight: 360,
  bodyFps: 15,
  bodyFrameMs: 80
};
