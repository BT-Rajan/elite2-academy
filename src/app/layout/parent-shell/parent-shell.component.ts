import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { MessageService } from '../../core/services/message.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-parent-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AvatarComponent, IconComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar__logo"><dojo-icon name="belt" [size]="20"></dojo-icon> <span>Parent Portal</span></div>
        <nav class="sidebar__nav">
          <a routerLink="/parent/dashboard"     routerLinkActive="active" class="nav-item">
            <span class="nav-icon"><dojo-icon name="home"></dojo-icon></span> Dashboard
          </a>
          <a routerLink="/parent/progress"      routerLinkActive="active" class="nav-item">
            <span class="nav-icon"><dojo-icon name="trending"></dojo-icon></span> My Child
          </a>
          <a routerLink="/parent/messages"      routerLinkActive="active" class="nav-item">
            <span class="nav-icon"><dojo-icon name="message"></dojo-icon></span> Messages
            <span *ngIf="unreadMessages() > 0" class="nav-badge">{{ unreadMessages() }}</span>
          </a>
          <a routerLink="/parent/loyalty"       routerLinkActive="active" class="nav-item">
            <span class="nav-icon"><dojo-icon name="star"></dojo-icon></span> Loyalty Points
          </a>
          <a routerLink="/parent/notifications" routerLinkActive="active" class="nav-item">
            <span class="nav-icon"><dojo-icon name="bell"></dojo-icon></span> Notifications
            <span *ngIf="unreadNotifs() > 0" class="nav-badge">{{ unreadNotifs() }}</span>
          </a>
          <a routerLink="/parent/profile" routerLinkActive="active" class="nav-item">
            <span class="nav-icon"><dojo-icon name="user"></dojo-icon></span> My Profile
          </a>
        </nav>
        <div class="sidebar__footer">
          <div class="sidebar-user">
            <a routerLink="/parent/profile" title="My Profile">
              <dojo-avatar [name]="user()?.displayName || 'P'" [src]="user()?.avatarUrl" size="sm"></dojo-avatar>
            </a>
            <div style="flex:1;min-width:0;overflow:hidden">
              <div class="sidebar-user-name">{{ user()?.displayName }}</div>
              <div class="sidebar-user-role">Parent</div>
            </div>
          </div>
          <button class="sidebar-logout" (click)="auth.logout()">
            <dojo-icon name="log-out"></dojo-icon><span>Sign out</span>
          </button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <span class="topbar__title">Parent Portal</span>
          <div class="topbar__right">
            <a routerLink="/parent/profile" title="My Profile">
              <dojo-avatar [name]="user()?.displayName || 'P'" [src]="user()?.avatarUrl" size="sm"></dojo-avatar>
            </a>
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
  private ms = inject(MessageService);

  user           = computed(() => this.auth.currentUser());
  unreadNotifs   = signal(0);
  unreadMessages = signal(0);

  ngOnInit() {
    const uid = this.auth.currentUser()?.uid;
    if (!uid) return;
    this.ns.forUser$(uid).subscribe(notifs => {
      this.unreadNotifs.set(notifs.filter(n => !n.isRead).length);
    });
    this.ms.threadsForParent$(uid).subscribe(threads => {
      this.unreadMessages.set(threads.reduce((sum, t) => sum + (t.unreadParent ?? 0), 0));
    });
  }
}
