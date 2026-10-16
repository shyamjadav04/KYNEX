// @ts-nocheck
import type { InputCommand, InputController } from "./InputManager";

export class TouchController implements InputController {
  readonly name = "touch";
  private listeners = new Set<(command: InputCommand) => void>();
  private started = false;
  private sx = 0;
  private sy = 0;
  private active = false;
  private fired = false;
  private readonly threshold = 18;

  constructor(private readonly el: HTMLElement) {}

  private emit(command: InputCommand) {
    for (const listener of this.listeners) listener(command);
  }

  private startGesture = (x: number, y: number) => {
    this.sx = x;
    this.sy = y;
    this.active = true;
    this.fired = false;
  };

  private moveGesture = (x: number, y: number) => {
    if (!this.active || this.fired) return;
    const dx = x - this.sx;
    const dy = y - this.sy;
    if (Math.abs(dx) < this.threshold && Math.abs(dy) < this.threshold) return;

    this.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.emit(dx > 0 ? "MOVE_RIGHT" : "MOVE_LEFT");
    } else {
      this.emit(dy > 0 ? "SLIDE" : "JUMP");
    }
  };

  private endGesture = () => {
    this.active = false;
  };

  private onTouchStart = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    if (touch) this.startGesture(touch.clientX, touch.clientY);
  };

  private onTouchMove = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    if (touch) this.moveGesture(touch.clientX, touch.clientY);
  };

  private onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") this.startGesture(event.clientX, event.clientY);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "touch") this.moveGesture(event.clientX, event.clientY);
  };

  start() {
    if (this.started) return;
    this.started = true;
    this.el.addEventListener("touchstart", this.onTouchStart, { passive: true });
    this.el.addEventListener("touchmove", this.onTouchMove, { passive: true });
    this.el.addEventListener("touchend", this.endGesture, { passive: true });
    this.el.addEventListener("pointerdown", this.onPointerDown);
    this.el.addEventListener("pointermove", this.onPointerMove);
    this.el.addEventListener("pointerup", this.endGesture);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    this.el.removeEventListener("touchstart", this.onTouchStart);
    this.el.removeEventListener("touchmove", this.onTouchMove);
    this.el.removeEventListener("touchend", this.endGesture);
    this.el.removeEventListener("pointerdown", this.onPointerDown);
    this.el.removeEventListener("pointermove", this.onPointerMove);
    this.el.removeEventListener("pointerup", this.endGesture);
    this.active = false;
  }

  onCommand(listener: (command: InputCommand) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
