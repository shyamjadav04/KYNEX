// @ts-nocheck
import * as pc from "playcanvas";
import { GameManager } from "./GameManager";
import { IS_MOBILE, Q } from "./core/PlatformQuality";

export function bootKynex() {
  const canvas = document.getElementById("app") as HTMLCanvasElement | null;
  const bootEl = document.getElementById("boot");
  const fill = document.getElementById("bootFill") as HTMLElement | null;
  const txt = document.getElementById("bootTxt");

  const progress = (p: number, label?: string) => {
    if (fill) fill.style.width = Math.round(p * 100) + "%";
    if (label && txt) txt.textContent = label;
  };

  const fail = (msg: string) => {
    const e = document.getElementById("bootErr") as HTMLElement | null;
    if (e) { e.hidden = false; e.textContent = msg; }
    if (txt) txt.textContent = "Could not start";
  };

  if (!canvas) { fail("KYNEX canvas was not found."); return; }

  let app: pc.Application;
  try {
    app = new pc.Application(canvas, {
      graphicsDeviceOptions: { alpha: false, antialias: Q.antialias, powerPreference: "high-performance", depth: true }
    });
  } catch (err) {
    fail("WebGL is unavailable in this browser: " + (err as Error).message);
    return;
  }

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, Q.maxPixelRatio);
  window.addEventListener("resize", () => app.resizeCanvas());
  app.start();
  progress(0.08, "Starting engine");

  setTimeout(() => {
    try {
      const game = new GameManager(app, canvas).build(progress);
      progress(1, "Ready");
      setTimeout(() => { bootEl?.classList.add("gone"); setTimeout(() => bootEl?.remove(), 600); }, 260);

      document.addEventListener("visibilitychange", () => { if (document.hidden && game.state === "PLAYING") game.togglePause(); });
      window.addEventListener("blur", () => { if (game.state === "PLAYING") game.togglePause(); });
      canvas.addEventListener("pointerdown", () => game.audio.resume(), { once: true });
    } catch (err) {
      console.error(err);
      fail("KYNEX failed to build the scene: " + (err as Error).message);
    }
  }, 60);
}
