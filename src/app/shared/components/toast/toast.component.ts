import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'dojo-toast-stack',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack">
      <div *ngFor="let t of toast.toasts()" class="toast" [class]="'toast--' + t.kind" (click)="toast.dismiss(t.id)">
        <span class="toast__icon">{{ icon(t.kind) }}</span>
        <span class="toast__msg">{{ t.message }}</span>
      </div>
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed; top: 20px; right: 20px; z-index: 1000;
      display: flex; flex-direction: column; gap: 10px;
      max-width: 380px;
    }
    .toast {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 12px 14px; border-radius: var(--radius-md);
      background: var(--surface-2); border: 1px solid var(--border);
      box-shadow: var(--shadow-md); color: var(--text);
      font-size: 13px; line-height: 1.5; cursor: pointer;
      animation: toast-in .18s ease-out;
    }
    .toast--success { border-left: 3px solid var(--success); }
    .toast--error   { border-left: 3px solid var(--danger); }
    .toast--info    { border-left: 3px solid var(--info); }
    .toast__icon { flex-shrink: 0; font-weight: 700; }
    .toast--success .toast__icon { color: var(--success); }
    .toast--error   .toast__icon { color: var(--danger); }
    .toast--info    .toast__icon { color: var(--info); }
    .toast__msg { flex: 1; word-break: break-word; }
    @keyframes toast-in {
      from { opacity: 0; transform: translateX(12px); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `],
})
export class ToastStackComponent {
  toast = inject(ToastService);

  icon(kind: string): string {
    return kind === 'success' ? '✓' : kind === 'error' ? '!' : 'i';
  }
}
