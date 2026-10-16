// @ts-nocheck
import * as pc from "playcanvas";

export const CFG = {
  lanes: [-3, 0, 3],
  laneChangeTime: 0.15,
  gravity: -40,
  jumpVelocity: 11.0,
  comboWindow: 1.35,
  comboThresholds: [1, 5, 12, 22, 35],
  slideTime: 0.85,
  speedStart: 10.5,
  speedMax: 16,
  speedKeys: [
    { t: 0, v: 10.5 }, { t: 25, v: 11.6 }, { t: 65, v: 13.2 },
    { t: 150, v: 14.8 }, { t: 260, v: 16.0 }
  ],
  difficultyKeys: [
    { t: 0, v: 0.00 }, { t: 20, v: 0.14 }, { t: 45, v: 0.30 },
    { t: 90, v: 0.50 }, { t: 150, v: 0.68 }, { t: 240, v: 0.85 }, { t: 340, v: 1.00 }
  ],
  tiers: [
    { at: 0.00, name: "Warm up" }, { at: 0.10, name: "Easy" }, { at: 0.24, name: "Medium" },
    { at: 0.42, name: "Medium+" }, { at: 0.58, name: "Hard" }, { at: 0.80, name: "Advanced" }
  ],
  fairness: {
    graceSeconds: 3.0, gapSecondsEasy: 1.50, gapSecondsHard: 1.05,
    forcedGapEasy: 1.95, forcedGapHard: 1.40, fullRowGapScale: 1.25, twoRowThreshold: 0.28
  },
  segmentLength: 34, segmentCount: 9,
  districts: ["neonDowntown", "cyberMarket", "industrial", "elevatedCity", "cyberDistrict"],
  districtBlockSegments: 3, segmentAhead: 8, roadWidth: 11, coinValue: 10,
  fogStart: 55, fogEnd: 205, farClip: 460,
  camera: { pos: new pc.Vec3(0, 3.55, 7.6), look: new pc.Vec3(0, 1.25, -7), fov: 56, fovBoost: 12 },
  player: { radius: 0.42, height: 1.72, slideHeight: 0.82 }
};
