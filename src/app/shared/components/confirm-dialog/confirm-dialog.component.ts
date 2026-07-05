import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../../core/services/confirm.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'dojo-confirm-dialog',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="confirm-overlay" *ngIf="confirm.request() as req" (click)="confirm.resolve(false)">
      <div class="confirm-card" [class.confirm-card--danger]="req.danger" (click)="$event.stopPropagation()">
        <div class="confirm-icon" [class.confirm-icon--danger]="req.danger">
          <dojo-icon [name]="req.danger ? 'warning' : 'check-circle'" [size]="22"></dojo-icon>
        </div>
        <div class="confirm-title">{{ req.title }}</div>
        <div class="confirm-message">{{ req.message }}</div>
        <div class="confirm-actions">
          <button class="btn btn--secondary" (click)="confirm.resolve(false)">
            {{ req.cancelLabel || 'Cancel' }}
          </button>
          <button [class]="req.danger ? 'btn btn--danger' : 'btn btn--primary'" (click)="confirm.resolve(true)">
            {{ req.confirmLabel || 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-overlay {
      position: fixed; inset: 0; z-index: 2000;
      background: rgba(0,0,0,.5);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      animation: confirm-fade-in .15s ease-out;
    }
    .confirm-card {
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
      max-width: 420px; width: 100%; padding: 24px;
      animation: confirm-pop-in .15s ease-out;
    }
    .confirm-icon {
      width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: var(--accent-dim); color: var(--accent); margin-bottom: 16px;
    }
    .confirm-icon--danger { background: rgba(239,68,68,.12); color: var(--danger); }
    .confirm-title { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
    .confirm-message { font-size: 13px; line-height: 1.6; color: var(--text-muted); margin-bottom: 24px; }
    .confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
    @keyframes confirm-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes confirm-pop-in { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
  `],
})
export class ConfirmDialogComponent {
  confirm = inject(ConfirmService);
}
