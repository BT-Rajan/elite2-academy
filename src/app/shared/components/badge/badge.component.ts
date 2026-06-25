import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type BadgeVariant = 'default'|'success'|'warning'|'danger'|'info'|'gray';

@Component({
  selector: 'dojo-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="badge" [class]="'badge--' + variant"><ng-content /></span>`,
  styles: [`
    .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:12px;
             font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
    .badge--default { background:#e2e8f0; color:#475569; }
    .badge--success { background:#dcfce7; color:#166534; }
    .badge--warning { background:#fef9c3; color:#854d0e; }
    .badge--danger  { background:#fee2e2; color:#991b1b; }
    .badge--info    { background:#dbeafe; color:#1e40af; }
    .badge--gray    { background:#f1f5f9; color:#64748b; }
  `]
})
export class BadgeComponent {
  @Input() variant: BadgeVariant = 'default';
}
