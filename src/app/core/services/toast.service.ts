import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ToastService — every API call in the app should surface its outcome
//  through here. No more silent failures: if a save/delete/action fails,
//  the user sees why; if it succeeds, they get a quiet confirmation.
// ─────────────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  success(message: string, ms = 3000): void { this.push('success', message, ms); }
  error(message: string, ms = 6000): void { this.push('error', message, ms); }
  info(message: string, ms = 4000): void { this.push('info', message, ms); }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  private push(kind: ToastKind, message: string, ms: number): void {
    const id = this.nextId++;
    this.toasts.update(list => [...list, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
