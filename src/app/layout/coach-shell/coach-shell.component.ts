import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

const NAV = [
  { path: '/coach/dashboard',  icon: '⊞', label: 'Dashboard' },
  { path: '/coach/attendance', icon: '✓',  label: 'Attendance' },
  { path: '/coach/students',   icon: '🧒', label: 'My Students' },
  { path: '/coach/messages',   icon: '💬', label: 'Messages' },
  { path: '/coach/profile',    icon: '👤', label: 'My Profile' },
];

@Component({
  selector: 'app-coach-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AvatarComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar__logo">🥋 <span>Coach Portal</span></div>
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
          <span class="topbar__title">Coach Portal</span>
          <div class="topbar__right">
            <span class="text-muted text-sm">{{ user()?.displayName }}</span>
            <a routerLink="/coach/profile" title="My Profile" style="cursor:pointer">
              <dojo-avatar [name]="user()?.displayName || 'C'" [src]="user()?.avatarUrl" size="sm"></dojo-avatar>
            </a>
          </div>
        </header>
        <div class="page"><router-outlet /></div>
      </div>
    </div>
  `
})
export class CoachShellComponent {
  auth = inject(AuthService);
  user = computed(() => this.auth.currentUser());
  nav  = NAV as any[];
}
