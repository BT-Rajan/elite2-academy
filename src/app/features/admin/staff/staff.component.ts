import { Component } from '@angular/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [PageHeaderComponent],
  template: `
    <dojo-page-header title="Staff Management" subtitle="Coming soon in a future phase"></dojo-page-header>
    <div class="card"><div class="card__body" style="color:var(--text-muted);text-align:center;padding:48px">
      🚧 This module is part of Phase 2. Foundation scaffolding in place.
    </div></div>
  `
})
export class StaffComponent {}
