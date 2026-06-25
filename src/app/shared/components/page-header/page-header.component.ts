import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dojo-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ title }}</h1>
        <p class="page-sub" *ngIf="subtitle">{{ subtitle }}</p>
      </div>
      <div class="page-actions"><ng-content /></div>
    </div>
  `,
  styles: [`
    .page-header  { display:flex; align-items:center; justify-content:space-between;
                    margin-bottom:24px; flex-wrap:wrap; gap:12px; }
    .page-title   { font-size:22px; font-weight:700; color:var(--text); margin:0; }
    .page-sub     { font-size:14px; color:var(--text-muted); margin:4px 0 0; }
    .page-actions { display:flex; gap:8px; flex-wrap:wrap; }
  `]
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle?: string;
}
