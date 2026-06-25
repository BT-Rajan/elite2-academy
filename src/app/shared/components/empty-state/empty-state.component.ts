import { Component, Input } from '@angular/core';

@Component({
  selector: 'dojo-empty-state',
  standalone: true,
  template: `
    <div class="empty">
      <div class="empty-icon">{{ icon }}</div>
      <div class="empty-title">{{ title }}</div>
      <div class="empty-sub">{{ subtitle }}</div>
      <ng-content />
    </div>
  `,
  styles: [`
    .empty { text-align:center; padding:48px 24px; color:var(--text-muted); }
    .empty-icon  { font-size:40px; margin-bottom:12px; }
    .empty-title { font-size:16px; font-weight:600; color:var(--text); margin-bottom:6px; }
    .empty-sub   { font-size:14px; }
  `]
})
export class EmptyStateComponent {
  @Input() icon = '📭';
  @Input() title = 'Nothing here yet';
  @Input() subtitle = '';
}
