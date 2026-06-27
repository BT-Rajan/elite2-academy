import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-parent-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AvatarComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar__logo">🥋 <span>Parent Portal</span></div>
        <nav class="sidebar__nav">
          <a routerLink="/parent/dashboard"     routerLinkActive="active" class="nav-item">
            <span class="nav-icon">⊞</span> Dashboard
          </a>
          <a routerLink="/parent/progress"      routerLinkActive="active" class="nav-item">
            <span class="nav-icon">📈</span> My Child
          </a>
          <a routerLink="/parent/messages"      routerLinkActive="active" class="nav-item">
            <span class="nav-icon">💬</span> Messages
            <span *ngIf="unreadMessages() > 0" class="nav-badge">{{ unreadMessages() }}</span>
          </a>
          <a routerLink="/parent/loyalty"       routerLinkActive="active" class="nav-item">
            <span class="nav-icon">⭐</span> Loyalty Points
          </a>
          <a routerLink="/parent/notifications" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">🔔</span> Notifications
            <span *ngIf="unreadNotifs() > 0" class="nav-badge">{{ unreadNotifs() }}</span>
          </a>
        </nav>
        <div class="sidebar__footer">
          <div class="sidebar-user">
            <dojo-avatar [name]="user()?.displayName || 'P'" size="sm"></dojo-avatar>
            <div style="flex:1;min-width:0;overflow:hidden">
              <div class="sidebar-user-name">{{ user()?.displayName }}</div>
              <div class="sidebar-user-role">Parent</div>
            </div>
          </div>
          <button class="sidebar-logout" (click)="auth.logout()">
            <span>🚪</span><span>Sign out</span>
          </button>
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
export class ParentShellComponent implements OnInit {
  auth = inject(AuthService);
  private ns = inject(NotificationService);

  user           = computed(() => this.auth.currentUser());
  unreadNotifs   = signal(0);
  unreadMessages = signal(0);

  ngOnInit() {
    const uid = this.auth.currentUser()?.uid;
    if (!uid) return;
    this.ns.forUser$(uid).subscribe(notifs => {
      this.unreadNotifs.set(notifs.filter(n => !n.isRead).length);
    });
  }
}
