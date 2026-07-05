import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { IconComponent, IconName } from '../../shared/components/icon/icon.component';

const NAV: { path: string; icon: IconName; label: string }[] = [
  { path: '/admin/dashboard', icon: 'home', label: 'Dashboard' },
  { path: '/admin/staff',     icon: 'users', label: 'Staff' },
  { path: '/admin/students',  icon: 'child', label: 'Students' },
  { path: '/admin/disciplines',icon: 'belt', label: 'Disciplines' },
  { path: '/admin/reports',   icon: 'chart', label: 'Reports' },
  { path: '/admin/settings',  icon: 'settings',  label: 'Settings' },
  { path: '/admin/profile',   icon: 'user', label: 'My Profile' },
];

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AvatarComponent, IconComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar__logo"><dojo-icon name="belt" [size]="20"></dojo-icon> <span>Dojo Platform</span></div>
        <nav class="sidebar__nav">
          <a *ngFor="let item of nav"
             [routerLink]="item.path"
             routerLinkActive="active"
             class="nav-item">
            <span class="nav-icon"><dojo-icon [name]="item.icon"></dojo-icon></span>
            {{ item.label }}
          </a>
        </nav>
        <div class="sidebar__footer">
          <div class="nav-item" (click)="auth.logout()" style="cursor:pointer">
            <span class="nav-icon"><dojo-icon name="log-out"></dojo-icon></span> Sign out
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
