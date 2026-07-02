import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

const NAV = [
  { path: '/admin/dashboard', icon: '⊞', label: 'Dashboard' },
  { path: '/admin/staff',     icon: '👥', label: 'Staff' },
  { path: '/admin/students',  icon: '🧒', label: 'Students' },
  { path: '/admin/disciplines',icon: '🥋', label: 'Disciplines' },
  { path: '/admin/reports',   icon: '📊', label: 'Reports' },
  { path: '/admin/settings',  icon: '⚙',  label: 'Settings' },
  { path: '/admin/profile',   icon: '👤', label: 'My Profile' },
];

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AvatarComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar__logo">🥋 <span>Dojo Platform</span></div>
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
          <div class="nav-item" (click)="auth.logout()" style="cursor:pointer">
            <span class="nav-icon">🚪</span> Sign out
          </div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <span class="topbar__title">Admin Portal</span>
          <div class="topbar__right">
            <a routerLink="/admin/profile" title="My Profile" style="cursor:pointer">
              <dojo-avatar [name]="user()?.displayName || 'A'" [src]="user()?.avatarUrl" size="sm"></dojo-avatar>
            </a>
          </div>
        </header>
        <div class="page"><router-outlet /></div>
      </div>
    </div>
  `
})
export class AdminShellComponent {
  auth = inject(AuthService);
  user = computed(() => this.auth.currentUser());
  nav  = NAV;
}
