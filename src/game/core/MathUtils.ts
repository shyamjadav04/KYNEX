// @ts-nocheck
export const M = {
  clamp: (v: number, a: number, b: number) => v < a ? a : (v > b ? b : v),
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  damp: (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt)),
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutBack: (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.6 * Math.pow(t - 1, 2),
  rand: (a: number, b: number) => a + Math.random() * (b - a),
  randInt: (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)],
  deg: (r: number) => r * 180 / Math.PI
};
