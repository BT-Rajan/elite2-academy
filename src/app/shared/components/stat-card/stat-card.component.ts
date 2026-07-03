import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

// ─────────────────────────────────────────────────────────────────────────────
//  StatCardComponent — a metric tile. Plain by default (matches every
//  existing usage). Set [link] to make the whole card navigate somewhere
//  relevant — e.g. "Active Students" -> /admin/students — or set [copy]
//  to make it a click-to-copy affordance for IDs/codes. A stat that isn't
//  actionable in some way is usually just a worse version of the number
//  living in a sentence — set one of these whenever there's a real
//  destination or action behind the metric.
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'dojo-stat-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a *ngIf="link" [routerLink]="link" class="stat-card stat-card--action">
      <ng-container *ngTemplateOutlet="body"></ng-container>
      <span class="stat-arrow">→</span>
    </a>
    <button *ngIf="!link && copy" type="button" class="stat-card stat-card--action" (click)="doCopy()">
      <ng-container *ngTemplateOutlet="body"></ng-container>
      <span class="stat-arrow">{{ copied() ? '✓ Copied' : '⧉ Copy' }}</span>
    </button>
    <div *ngIf="!link && !copy" class="stat-card">
      <ng-container *ngTemplateOutlet="body"></ng-container>
    </div>

    <ng-template #body>
      <div class="stat-icon">{{ icon }}</div>
      <div class="stat-body">
        <div class="stat-value">{{ value }}</div>
        <div class="stat-label">{{ label }}</div>
        <div class="stat-sub" *ngIf="sub">{{ sub }}</div>
      </div>
    </ng-template>
  `,
  styles: [`
    .stat-card { display:flex; align-items:center; gap:16px; padding:20px;
                 background:var(--surface); border-radius:12px; border:1px solid var(--border); }
    .stat-icon { font-size:28px; width:48px; height:48px; display:flex; align-items:center;
                 justify-content:center; background:var(--surface-2); border-radius:10px; flex-shrink:0; }
    .stat-body  { flex:1; min-width:0; text-align:left; }
    .stat-value { font-size:28px; font-weight:700; color:var(--text); line-height:1; }
    .stat-label { font-size:13px; color:var(--text-muted); margin-top:4px; }
    .stat-sub   { font-size:12px; color:var(--accent); margin-top:2px; }
    .stat-card--action {
      width:100%; text-decoration:none; cursor:pointer; font:inherit;
      transition:border-color .15s, transform .1s;
      &:hover  { border-color:var(--accent); }
      &:active { transform:scale(0.99); }
    }
    .stat-arrow { font-size:12px; font-weight:600; color:var(--accent); flex-shrink:0; white-space:nowrap; }
  `]
})
export class StatCardComponent {
  @Input() icon = '📊';
  @Input() value: string | number = 0;
  @Input() label = '';
  @Input() sub?: string;
  @Input() link?: string | any[];
  @Input() copy = false;

  copied = signal(false);

  async doCopy() {
    try {
      await navigator.clipboard.writeText(String(this.value));
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — silently no-op,
      // the value is already visible on the card to copy manually.
    }
  }
}
