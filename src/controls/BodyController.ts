// @ts-nocheck
import type { InputCommand, InputController } from "./InputManager";
import { Q } from "../game/core/PlatformQuality";

export type BodyStatus =
  | "OFF"
  | "LOADING"
  | "CAMERA"
  | "CALIBRATING"
  | "READY"
  | "TRACKING"
  | "SHOW_FULL_BODY"
  | "CAMERA_ERROR";

type Landmark = { x: number; y: number; visibility?: number };
type PoseResult = { poseLandmarks?: Landmark[] };

type BodyControllerOptions = {
  onStatus?: (status: BodyStatus, detail: string) => void;
};

/**
 * Lightweight webcam/body input.
 *
 * MediaPipe is loaded only after the player explicitly enables Body Control.
 * No camera, model or processing loop is started during normal game boot.
 */
export class BodyController implements InputController {
  readonly name = "body";

  private listeners = new Set<(command: InputCommand) => void>();
  private statusListener?: (status: BodyStatus, detail: string) => void;
  private active = false;
  private started = false;
  private disposed = false;
  private loading?: Promise<void>;
  private pose: any = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private timer: number | null = null;
  private sending = false;

  private baseline: {
    lean: number;
    hipY: number;
    shoulderY: number;
    bodyHeight: number;
  } | null = null;
  private calibrationUntil = 0;
  private samples: Array<{
    lean: number;
    hipY: number;
    shoulderY: number;
    bodyHeight: number;
  }> = [];
  private smooth = { lean: 0, knee: 170, bodyHeight: 1 };
  private lastPose: { hipY: number; time: number } | null = null;
  private cooldownUntil = 0;
  private leanArmed = true;
  private status: BodyStatus = "OFF";

  constructor(options: BodyControllerOptions = {}) {
    this.statusListener = options.onStatus;
  }

  start() {
    this.started = true;
    // Intentionally does nothing else. Camera/model loading is opt-in.
  }

  stop() {
    this.started = false;
    this.disable();
  }

  onCommand(listener: (command: InputCommand) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setStatusListener(listener?: (status: BodyStatus, detail: string) => void) {
    this.statusListener = listener;
    if (listener) listener(this.status, this.statusDetail(this.status));
  }

  get isActive() {
    return this.active;
  }

  get currentStatus() {
    return this.status;
  }

  async enable() {
    if (this.active || this.loading) return;
    this.disposed = false;
    this.loading = this.startWebcam().catch((error) => {
      console.error("KYNEX body control:", error);
      this.disable();
      this.setStatus("CAMERA_ERROR", "Camera unavailable — keyboard/touch still work.");
    }).finally(() => {
      this.loading = undefined;
    });
    await this.loading;
  }

  disable() {
    this.active = false;
    this.disposed = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.sending = false;

    try { this.pose?.close?.(); } catch { /* noop */ }
    this.pose = null;

    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }

    this.video?.remove();
    this.video = null;
    this.baseline = null;
    this.samples = [];
    this.calibrationUntil = 0;
    this.lastPose = null;
    this.cooldownUntil = 0;
    this.leanArmed = true;
    this.smooth = { lean: 0, knee: 170, bodyHeight: 1 };
    this.setStatus("OFF", "Body control off");
  }

  toggle() {
    return this.active ? (this.disable(), Promise.resolve()) : this.enable();
  }

  private setStatus(status: BodyStatus, detail?: string) {
    this.status = status;
    this.statusListener?.(status, detail ?? this.statusDetail(status));
  }

  private statusDetail(status: BodyStatus) {
    const detail: Record<BodyStatus, string> = {
      OFF: "Webcam motion control off",
      LOADING: "Loading motion model…",
      CAMERA: "Camera active — hold still",
      CALIBRATING: "Calibrating your neutral stance…",
      READY: "Body control ready",
      TRACKING: "Body tracking active",
      SHOW_FULL_BODY: "Step back so your full body is visible",
      CAMERA_ERROR: "Camera unavailable — keyboard/touch still work.",
    };
    return detail[status];
  }

  private emit(command: InputCommand) {
    if (!this.active || !this.started) return;
    for (const listener of this.listeners) listener(command);
  }

  private async startWebcam() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera API unavailable");
    }

    this.setStatus("LOADING", "Loading motion model…");
    await this.loadPoseScript();

    if (this.disposed) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: Q.bodyVideoWidth, max: Q.bodyVideoWidth },
        height: { ideal: Q.bodyVideoHeight, max: Q.bodyVideoHeight },
        frameRate: { ideal: Q.bodyFps, max: Q.bodyFps },
        facingMode: "user",
      },
      audio: false,
    });

    if (this.disposed) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
      return;
    }

    const video = document.createElement("video");
    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    Object.assign(video.style, {
      position: "fixed",
      width: "1px",
      height: "1px",
      left: "-10px",
      top: "-10px",
      opacity: "0",
      pointerEvents: "none",
    });
    video.srcObject = this.stream;
    document.body.appendChild(video);
    this.video = video;
    await video.play();

    const PoseCtor = (window as any).Pose;
    if (typeof PoseCtor !== "function") throw new Error("MediaPipe Pose did not load");

    this.pose = new PoseCtor({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    this.pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.60,
      minTrackingConfidence: 0.60,
    });
    this.pose.onResults((result: PoseResult) => this.handleResults(result));

    this.active = true;
    this.lastPose = null;
    this.calibrationUntil = 0;
    this.samples = [];
    this.setStatus("CAMERA", "Camera active — hold still for calibration");
    this.scheduleFrame(80);
  }

  private scheduleFrame(delay = 80) {
    if (!this.active || this.disposed) return;
    this.timer = window.setTimeout(() => this.sendFrame(), delay);
  }

  private async sendFrame() {
    if (!this.active || this.disposed || !this.video || !this.pose) return;
    if (this.sending || this.video.readyState < 2) {
      this.scheduleFrame(100);
      return;
    }
    this.sending = true;
    try {
      await this.pose.send({ image: this.video });
    } catch (error) {
      console.warn("KYNEX body frame skipped:", error);
    } finally {
      this.sending = false;
      this.scheduleFrame(Q.bodyFrameMs); // throttled pose inference; game render stays independent
    }
  }

  private handleResults(result: PoseResult) {
    if (!this.active || !result.poseLandmarks) {
      if (this.active) this.setStatus("CAMERA", "Show your full body to the camera");
      return;
    }

    const lm = result.poseLandmarks;
    const ids = [11, 12, 23, 24, 25, 26, 27, 28];
    const visible = ids.filter((i) => (lm[i]?.visibility ?? 0) > 0.60).length / ids.length;
    if (visible < 0.75) {
      this.setStatus("SHOW_FULL_BODY", "Step back so shoulders, hips and feet are visible");
      this.lastPose = null;
      return;
    }

    const f = this.features(lm);
    this.smooth.lean = this.smooth.lean * 0.72 + f.lean * 0.28;
    this.smooth.knee = this.smooth.knee * 0.72 + f.knee * 0.28;
    this.smooth.bodyHeight = this.smooth.bodyHeight * 0.72 + f.bodyHeight * 0.28;

    const live = {
      ...f,
      lean: this.smooth.lean,
      knee: this.smooth.knee,
      bodyHeight: this.smooth.bodyHeight,
    };
    const now = performance.now();

    if (!this.baseline) {
      this.collectCalibration(live, now);
      return;
    }

    this.setStatus("TRACKING", "Body tracking active");

    const leanDelta = live.lean - this.baseline.lean;
    const hipDelta = (live.hip.y - this.baseline.hipY) / Math.max(this.baseline.bodyHeight, 0.2);
    const shoulderDelta = (live.shoulder.y - this.baseline.shoulderY) / Math.max(this.baseline.bodyHeight, 0.2);
    const crouchAmount = (hipDelta + shoulderDelta) * 0.5;

    const dt = this.lastPose ? Math.max(16, now - this.lastPose.time) : 100;
    const hipVelocity = this.lastPose
      ? ((this.lastPose.hipY - live.hip.y) / dt) * 1000 / Math.max(this.baseline.bodyHeight, 0.2)
      : 0;

    if (now > this.cooldownUntil) {
      if (hipVelocity > 0.30 && hipDelta < -0.07 && live.knee > 125) {
        this.emit("JUMP");
        this.cooldownUntil = now + 850;
      } else if (crouchAmount > 0.075 && live.knee < 145) {
        this.emit("SLIDE");
        this.cooldownUntil = now + 800;
      } else if (Math.abs(leanDelta) < 0.18) {
        this.leanArmed = true;
      } else if (Math.abs(leanDelta) > 0.32 && this.leanArmed) {
        // Camera is mirrored from the player's perspective: positive torso lean is LEFT.
        this.emit(leanDelta > 0 ? "MOVE_LEFT" : "MOVE_RIGHT");
        this.cooldownUntil = now + 450;
        this.leanArmed = false;
      }
    }

    this.lastPose = { hipY: live.hip.y, time: now };
  }

  private collectCalibration(f: ReturnType<BodyController["features"]>, now: number) {
    if (!this.calibrationUntil) {
      this.calibrationUntil = now + 1100;
      this.samples = [];
    }

    this.setStatus("CALIBRATING", "Stand naturally and hold still…");
    this.samples.push({ lean: f.lean, hipY: f.hip.y, shoulderY: f.shoulder.y, bodyHeight: f.bodyHeight });

    if (now < this.calibrationUntil) return;

    if (this.samples.length < 6) {
      this.calibrationUntil = now + 700;
      return;
    }

    const mean = (key: keyof typeof this.samples[number]) =>
      this.samples.reduce((sum, item) => sum + item[key], 0) / this.samples.length;

    this.baseline = {
      lean: mean("lean"),
      hipY: mean("hipY"),
      shoulderY: mean("shoulderY"),
      bodyHeight: Math.max(mean("bodyHeight"), 0.20),
    };
    this.samples = [];
    this.calibrationUntil = 0;
    this.lastPose = null;
    this.setStatus("READY", "Body control ready — move clearly");
  }

  private features(lm: Landmark[]) {
    const shoulder = this.mid(lm[11], lm[12]);
    const hip = this.mid(lm[23], lm[24]);
    const ankle = this.mid(lm[27], lm[28]);
    const shoulderWidth = Math.max(this.distance(lm[11], lm[12]), 0.06);
    const bodyHeight = Math.max(this.distance(shoulder, ankle), 0.20);
    const lean = (shoulder.x - hip.x) / shoulderWidth;
    const leftKnee = this.angle(lm[23], lm[25], lm[27]);
    const rightKnee = this.angle(lm[24], lm[26], lm[28]);
    return {
      shoulder,
      hip,
      ankle,
      bodyHeight,
      lean,
      knee: (leftKnee + rightKnee) * 0.5,
    };
  }

  private mid(a: Landmark, b: Landmark) {
    return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
  }

  private distance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private angle(a: Landmark, b: Landmark, c: Landmark) {
    const ab = { x: a.x - b.x, y: a.y - b.y };
    const cb = { x: c.x - b.x, y: c.y - b.y };
    const denom = Math.max(Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y), 1e-6);
    const cosine = Math.max(-1, Math.min(1, (ab.x * cb.x + ab.y * cb.y) / denom));
    return Math.acos(cosine) * 180 / Math.PI;
  }

  private loadPoseScript() {
    const globalWindow = window as any;
    if (typeof globalWindow.Pose === "function") return Promise.resolve();

    const existing = document.querySelector('script[data-kynex-mediapipe="pose"]') as HTMLScriptElement | null;
    if (existing) {
      return new Promise<void>((resolve, reject) => {
        if (typeof globalWindow.Pose === "function") return resolve();
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("MediaPipe Pose script failed to load")), { once: true });
      });
    }

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js";
      script.async = true;
      script.dataset.kynexMediapipe = "pose";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load MediaPipe Pose"));
      document.head.appendChild(script);
    });
  }
}
