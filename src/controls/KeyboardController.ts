// @ts-nocheck
import type { InputCommand, InputController } from "./InputManager";

export interface KeyboardControllerOptions {
  onPause?: () => void;
}

export class KeyboardController implements InputController {
  readonly name = "keyboard";
  private listeners = new Set<(command: InputCommand) => void>();
  private started = false;
  private readonly onPause?: () => void;

  constructor(options: KeyboardControllerOptions = {}) {
    this.onPause = options.onPause;
  }

  private handler = (event: KeyboardEvent) => {
    if (event.repeat) return;

    if (event.code === "KeyP" || event.code === "Escape") {
      event.preventDefault();
      this.onPause?.();
      return;
    }

    const map: Record<string, InputCommand | undefined> = {
      ArrowLeft: "MOVE_LEFT",
      KeyA: "MOVE_LEFT",
      ArrowRight: "MOVE_RIGHT",
      KeyD: "MOVE_RIGHT",
      ArrowUp: "JUMP",
      KeyW: "JUMP",
      Space: "JUMP",
      ArrowDown: "SLIDE",
      KeyS: "SLIDE",
    };

    const command = map[event.code];
    if (!command) return;

    event.preventDefault();
    for (const listener of this.listeners) listener(command);
  };

  start() {
    if (this.started) return;
    this.started = true;
    window.addEventListener("keydown", this.handler, { passive: false });
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener("keydown", this.handler);
  }

  onCommand(listener: (command: InputCommand) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
