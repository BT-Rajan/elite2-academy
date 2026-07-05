import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type BadgeVariant = 'default'|'success'|'warning'|'danger'|'info'|'gray';

@Component({
  selector: 'dojo-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="badge" [class]="'badge--' + variant"><ng-content /></span>`,
  // Mirrors the global .badge / .badge--* classes in styles.scss so a
  // <dojo-badge> looks identical to a raw <span class="badge ...">,
  // regardless of which one a component happens to use.
  styles: [`
    .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:12px;
             font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
    .badge--default { background:var(--surface-2);      color:var(--text-muted); }
    .badge--success { background:rgba(34,197,94,.15);   color:#4ade80; }
    .badge--warning { background:rgba(245,158,11,.15);  color:#fbbf24; }
    .badge--danger  { background:rgba(239,68,68,.15);   color:#f87171; }
    .badge--info    { background:rgba(59,130,246,.15);  color:#60a5fa; }
    .badge--gray    { background:var(--surface-2);      color:var(--text-muted); }
  `]
})
export class BadgeComponent {
  @Input() variant: BadgeVariant = 'default';
}
