import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

const NAV = [
  { path: '/parent/dashboard',     icon: '⊞', label: 'Dashboard' },
  { path: '/parent/progress',      icon: '📈', label: 'My Child' },
  { path: '/parent/messages',      icon: '💬', label: 'Messages' },
  { path: '/parent/loyalty',       icon: '⭐', label: 'Loyalty Points' },
  { path: '/parent/notifications', icon: '🔔', label: 'Notifications' },
];

@Component({
  selector: 'app-parent-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AvatarComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar__logo">🥋 <span>Parent Portal</span></div>
        <nav class="sidebar__nav">
          <a *ngFor="let item of nav"
             [routerLink]="item.path"
             routerLinkActive="active"
             class="nav-item">
            <span class="nav-icon">{{ item.icon }}</span>
            {{ item.label }}
          </a>
        </nav>
        <div class="sidebar__footer">
          <div class="nav-item" (click)="auth.logout()">
            <span class="nav-icon">🚪</span> Sign out
          </div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <span class="topbar__title">Parent Portal</span>
          <div class="topbar__right">
            <dojo-avatar [name]="user()?.displayName || 'P'" size="sm"></dojo-avatar>
          </div>
        </header>
        <div class="page"><router-outlet /></div>
      </div>
    </div>
  `
})
export class ParentShellComponent {
  auth = inject(AuthService);
  user = computed(() => this.auth.currentUser());
  nav  = NAV;
}
