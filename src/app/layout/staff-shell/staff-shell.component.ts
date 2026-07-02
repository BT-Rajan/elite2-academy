import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

const NAV = [
  { path: '/staff/dashboard', icon: '⊞', label: 'Dashboard' },
  { path: '/staff/students',  icon: '🧒', label: 'Students' },
  { path: '/staff/schedule',  icon: '📅', label: 'Schedule' },
  { path: '/staff/notifications', icon: '🔔', label: 'Notifications' },
];

@Component({
  selector: 'app-staff-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AvatarComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar__logo">🥋 <span>Staff Portal</span></div>
        <nav class="sidebar__nav">
          <a *ngFor="let item of nav"
             [routerLink]="item.path"
             routerLinkActive="active"
             class="nav-item">
            <span class="nav-icon">{{ item.icon }}</span>
            {{ item.label }}
            <span *ngIf="item.badge" class="nav-badge">{{ item.badge }}</span>
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
          <span class="topbar__title">Staff Portal</span>
          <div class="topbar__right">
            <span class="text-muted text-sm">{{ user()?.displayName }}</span>
            <dojo-avatar [name]="user()?.displayName || 'S'" size="sm"></dojo-avatar>
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
  nav  = NAV as any[];
}
