import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { IconComponent, IconName } from '../../shared/components/icon/icon.component';

const NAV: { path: string; icon: IconName; label: string; badge?: number }[] = [
  { path: '/coach/dashboard',  icon: 'home', label: 'Dashboard' },
  { path: '/coach/attendance', icon: 'check',  label: 'Attendance' },
  { path: '/coach/students',   icon: 'child', label: 'My Students' },
  { path: '/coach/messages',   icon: 'message', label: 'Messages' },
  { path: '/coach/communication', icon: 'phone', label: 'Communication' },
  { path: '/coach/profile',    icon: 'user', label: 'My Profile' },
];

@Component({
  selector: 'app-coach-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AvatarComponent, IconComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar__logo"><dojo-icon name="belt" [size]="20"></dojo-icon> <span>Coach Portal</span></div>
        <nav class="sidebar__nav">
          <a *ngFor="let item of nav()"
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
  // Only Head Coaches can approve pending admin sign-ups (see
  // AuthMiddleware::requireHeadCoach on the backend) -- regular coaches
  // don't get the nav item since the page would just 403 for them.
  nav  = computed(() => this.user()?.isHeadCoach
    ? [...NAV.slice(0, -1), { path: '/coach/approvals', icon: 'check-circle' as IconName, label: 'Approvals' }, NAV[NAV.length - 1]]
    : NAV);
}
