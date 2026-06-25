import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dojo-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-card">
      <div class="stat-icon">{{ icon }}</div>
      <div class="stat-body">
        <div class="stat-value">{{ value }}</div>
        <div class="stat-label">{{ label }}</div>
        <div class="stat-sub" *ngIf="sub">{{ sub }}</div>
      </div>
    </div>
  `,
  styles: [`
    .stat-card { display:flex; align-items:center; gap:16px; padding:20px;
                 background:var(--surface); border-radius:12px; border:1px solid var(--border); }
    .stat-icon { font-size:28px; width:48px; height:48px; display:flex; align-items:center;
                 justify-content:center; background:var(--surface-2); border-radius:10px; }
    .stat-value { font-size:28px; font-weight:700; color:var(--text); line-height:1; }
    .stat-label { font-size:13px; color:var(--text-muted); margin-top:4px; }
    .stat-sub   { font-size:12px; color:var(--accent); margin-top:2px; }
  `]
})
export class StatCardComponent {
  @Input() icon = '📊';
  @Input() value: string | number = 0;
  @Input() label = '';
  @Input() sub?: string;
}
