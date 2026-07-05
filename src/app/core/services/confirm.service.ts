import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ConfirmService — replaces window.confirm() / silent-on-click destructive
//  actions with a real modal that matches the app's design. Usage:
//
//    const ok = await this.confirm.ask({
//      title: 'Reject this request?',
//      message: `${u.displayName}'s account request will be rejected.`,
//      confirmLabel: 'Reject', danger: true,
//    });
//    if (!ok) return;
// ─────────────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);
  private resolver: ((result: boolean) => void) | null = null;

  ask(req: ConfirmRequest): Promise<boolean> {
    // Only one confirmation can be in flight -- if something is already
    // pending, treat it as cancelled rather than losing the resolver.
    this.resolver?.(false);
    return new Promise<boolean>(resolve => {
      this.resolver = resolve;
      this.request.set(req);
    });
  }

  resolve(result: boolean): void {
    this.resolver?.(result);
    this.resolver = null;
    this.request.set(null);
  }
}
