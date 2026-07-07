import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { IconComponent, IconName } from '../../shared/components/icon/icon.component';

const NAV: { path: string; icon: IconName; label: string; badge?: number }[] = [
  { path: '/staff/dashboard', icon: 'home', label: 'Dashboard' },
  { path: '/staff/students',  icon: 'child', label: 'Students' },
  { path: '/staff/schedule',  icon: 'calendar', label: 'Schedule' },
  { path: '/staff/communication', icon: 'phone', label: 'Communication' },
  { path: '/staff/branches',  icon: 'pin', label: 'Branches' },
  { path: '/staff/approvals', icon: 'check-circle', label: 'Approvals' },
  { path: '/staff/notifications', icon: 'bell', label: 'Notifications' },
  { path: '/staff/profile',   icon: 'user', label: 'My Profile' },
];

@Component({
  selector: 'app-staff-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AvatarComponent, IconComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar__logo"><dojo-icon name="belt" [size]="20"></dojo-icon> <span>Staff Portal</span></div>
        <nav class="sidebar__nav">
          <a *ngFor="let item of nav"
             [routerLink]="item.path"
             routerLinkActive="active"
             class="nav-item">
            <span class="nav-icon"><dojo-icon [name]="item.icon"></dojo-icon></span>
            {{ item.label }}
            <span *ngIf="item.badge" class="nav-badge">{{ item.badge }}</span>
          </a>
        </nav>
        <div class="sidebar__footer">
          <div class="nav-item" (click)="auth.logout()">
            <span class="nav-icon"><dojo-icon name="log-out"></dojo-icon></span> Sign out
          </div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <span class="topbar__title">Staff Portal</span>
          <div class="topbar__right">
            <span class="text-muted text-sm">{{ user()?.displayName }}</span>
            <a routerLink="/staff/profile" title="My Profile" style="cursor:pointer">
              <dojo-avatar [name]="user()?.displayName || 'S'" [src]="user()?.avatarUrl" size="sm"></dojo-avatar>
            </a>
          </div>
        </header>
        <div class="page"><router-outlet /></div>
      </div>
    </div>
  `
})
export class StaffShellComponent {
  auth = inject(AuthService);
  user = computed(() => this.auth.currentUser());
  nav  = NAV;
}
