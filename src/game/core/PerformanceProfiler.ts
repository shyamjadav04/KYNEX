// @ts-nocheck
/**
 * Opt-in, zero-cost-when-disabled performance profiler for KYNEX.
 * Enable with ?profiler=1 or localStorage.setItem('kynex.profiler','1').
 * It is intentionally independent from gameplay and does not change quality.
 */
export class PerformanceProfiler {
  readonly enabled: boolean;
  private app: any;
  private game: any;
  private acc = 0;
  private frames = 0;
  private frameStart = 0;
  private sampleStart = 0;
  private frameMsSum = 0;
  private frameMsMin = Infinity;
  private frameMsMax = 0;
  private sectionStarts = new Map<string, number>();
  private sectionSums = new Map<string, number>();
  private lastSections: Record<string, number> = {};
  private lastDrawCalls = 0;
  private lastTriangles = 0;
  private lastObjects = 0;
  private overlay: HTMLDivElement | null = null;

  constructor(app: any, game: any) {
    this.app = app;
    this.game = game;
    this.enabled = this.isRequested();
    if (this.enabled) this.createOverlay();
  }

  private isRequested() {
    try {
      const query = new URLSearchParams(window.location.search);
      return query.get('profiler') === '1' || localStorage.getItem('kynex.profiler') === '1';
    } catch (_) {
      return false;
    }
  }

  beginFrame() {
    if (!this.enabled) return;
    this.frameStart = performance.now();
  }

  begin(name: string) {
    if (!this.enabled) return;
    this.sectionStarts.set(name, performance.now());
  }

  end(name: string) {
    if (!this.enabled) return;
    const start = this.sectionStarts.get(name);
    if (start === undefined) return;
    const ms = performance.now() - start;
    this.sectionSums.set(name, (this.sectionSums.get(name) || 0) + ms);
    this.sectionStarts.delete(name);
  }

  endFrame(dt: number) {
    if (!this.enabled) return;
    const ms = performance.now() - this.frameStart;
    this.frames++;
    this.frameMsSum += ms;
    this.frameMsMin = Math.min(this.frameMsMin, ms);
    this.frameMsMax = Math.max(this.frameMsMax, ms);
    this.acc += dt;

    if (this.acc >= 0.5) {
      const seconds = this.acc;
      const avgFrame = this.frameMsSum / Math.max(1, this.frames);
      this.lastSections = {};
      for (const [name, sum] of this.sectionSums) {
        this.lastSections[name] = sum / Math.max(1, this.frames);
      }
      const stats = this.readGraphicsStats();
      this.lastDrawCalls = stats.drawCalls;
      this.lastTriangles = stats.triangles;
      this.lastObjects = this.countEntities();
      const fps = this.frames / seconds;
      this.render(fps, avgFrame);
      this.acc = 0;
      this.frames = 0;
      this.frameMsSum = 0;
      this.frameMsMin = Infinity;
      this.frameMsMax = 0;
      this.sectionSums.clear();
    }
  }

  destroy() {
    this.overlay?.remove();
    this.overlay = null;
  }

  private readGraphicsStats() {
    const gd: any = this.app?.graphicsDevice;
    const s: any = gd?.stats || {};
    const drawCalls = this.readNumber([
      s.drawCalls?.total,
      s.drawCalls?.forward,
      s.drawCalls,
      s.frame?.drawCalls,
    ]);
    const triangles = this.readNumber([
      s.primitives?.triangles,
      s.triangles,
      s.frame?.triangles,
    ]);
    return { drawCalls, triangles };
  }

  private readNumber(values: unknown[]) {
    for (const v of values) {
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  private countEntities() {
    let total = 0;
    const visit = (node: any) => {
      total++;
      const children = node?.children;
      if (!children) return;
      for (const child of children) visit(child);
    };
    const root = this.app?.root;
    if (root) visit(root);
    return total;
  }

  private createOverlay() {
    const style = document.createElement('style');
    style.textContent = `
      #kynexProfiler{position:fixed;left:8px;top:8px;z-index:99999;padding:8px 10px;
      width:min(250px,calc(100vw - 16px));box-sizing:border-box;border:1px solid rgba(120,255,240,.32);
      border-radius:8px;background:rgba(2,7,13,.88);color:#d9fff8;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
      pointer-events:none;white-space:pre;backdrop-filter:blur(5px);text-shadow:0 1px 2px #000}
      #kynexProfiler .p-head{color:#6fffe8;font-weight:700;margin-bottom:3px}
      #kynexProfiler .warn{color:#ffd166}
    `;
    document.head.appendChild(style);
    this.overlay = document.createElement('div');
    this.overlay.id = 'kynexProfiler';
    document.body.appendChild(this.overlay);
  }

  private render(fps: number, avgFrame: number) {
    if (!this.overlay) return;
    const gd: any = this.app?.graphicsDevice;
    const dpr = window.devicePixelRatio || 1;
    const maxDpr = gd?.maxPixelRatio ?? dpr;
    const canvas = this.app?.graphicsDevice?.canvas as HTMLCanvasElement | undefined;
    const w = canvas?.width ?? 0;
    const h = canvas?.height ?? 0;
    const sx = this.lastSections;
    const cpu = (name: string) => (sx[name] || 0).toFixed(2);
    const colorClass = fps < 45 ? ' class="warn"' : '';
    this.overlay.innerHTML =
      `<div class="p-head">KYNEX MOBILE PROFILER</div>` +
      `<div${colorClass}>FPS ${fps.toFixed(1)} | frame ${avgFrame.toFixed(2)} ms</div>` +
      `<div>canvas ${w}×${h} | dpr ${dpr.toFixed(2)} / max ${Number(maxDpr).toFixed(2)}</div>` +
      `<div>draws ${Math.round(this.lastDrawCalls)} | tris ${Math.round(this.lastTriangles)}</div>` +
      `<div>entities ${this.lastObjects}</div>` +
      `<div>CPU ms/frame (avg)</div>` +
      `<div>track ${cpu('track')} | obstacles ${cpu('obstacles')}</div>` +
      `<div>coins ${cpu('coins')} | env ${cpu('env')}</div>` +
      `<div>player ${cpu('player')} | collision ${cpu('collision')}</div>` +
      `<div>vfx ${cpu('vfx')} | camera ${cpu('camera')}</div>`;
  }
}
