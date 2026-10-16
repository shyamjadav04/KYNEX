// @ts-nocheck
export type InputCommand = "MOVE_LEFT" | "MOVE_RIGHT" | "JUMP" | "SLIDE";

export interface InputController {
  readonly name: string;
  start(): void;
  stop(): void;
  onCommand(listener: (command: InputCommand) => void): () => void;
}

export class InputManager {
  private listeners = new Set<(command: InputCommand, from: string) => void>();
  private controllers: InputController[] = [];
  private started = false;
  private enabled = true;
  private last: { cmd: InputCommand; from: string; t: number } | null = null;

  register(controller: InputController) {
    this.controllers.push(controller);
    if (this.started) controller.start();
    const off = controller.onCommand(command => this.emit(command, controller.name));
    return () => {
      off();
      controller.stop();
      this.controllers = this.controllers.filter(c => c !== controller);
    };
  }

  // Backward-compatible alias for the previous migration stage.
  add(controller: InputController) {
    this.register(controller);
    return controller;
  }

  start() {
    if (this.started) return;
    this.started = true;
    for (const controller of this.controllers) controller.start();
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    for (const controller of this.controllers) controller.stop();
  }

  onCommand(listener: (command: InputCommand, from: string) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Backward-compatible alias.
  on(listener: (command: InputCommand, from: string) => void) {
    return this.onCommand(listener);
  }

  emit(command: InputCommand, from = "unknown") {
    if (!this.enabled) return;
    this.last = { cmd: command, from, t: performance.now() };
    for (const listener of this.listeners) listener(command, from);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  getLast() {
    return this.last;
  }
}
