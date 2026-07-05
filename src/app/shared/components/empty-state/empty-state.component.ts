import { Component, Input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

@Component({
  selector: 'dojo-empty-state',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="empty">
      <div class="empty-icon"><dojo-icon [name]="icon" [size]="40" [strokeWidth]="1.5"></dojo-icon></div>
      <div class="empty-title">{{ title }}</div>
      <div class="empty-sub">{{ subtitle }}</div>
      <ng-content />
    </div>
  `,
  styles: [`
    .empty { text-align:center; padding:48px 24px; color:var(--text-muted); }
    .empty-icon  { display:flex; justify-content:center; margin-bottom:12px; color:var(--text-dim); }
    .empty-title { font-size:16px; font-weight:600; color:var(--text); margin-bottom:6px; }
    .empty-sub   { font-size:14px; }
  `]
})
export class EmptyStateComponent {
  @Input() icon: IconName = 'inbox';
  @Input() title = 'Nothing here yet';
  @Input() subtitle = '';
}
