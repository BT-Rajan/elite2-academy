import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type BadgeVariant = 'default'|'success'|'warning'|'danger'|'info'|'gray';

@Component({
  selector: 'dojo-badge',
  standalone: true,
  imports: [CommonModule],
  // No component-local styles: this renders the same .badge/.badge--*
  // classes defined once, globally, in styles.scss. A second copy here
  // previously duplicated every color value and silently went stale
  // whenever the palette changed (see git history) -- one source of
  // truth now, so <dojo-badge> and a raw <span class="badge ..."> can
  // never drift apart again.
  template: `<span class="badge" [class]="'badge--' + (variant === 'default' ? 'gray' : variant)"><ng-content /></span>`,
})
export class BadgeComponent {
  @Input() variant: BadgeVariant = 'default';
}
