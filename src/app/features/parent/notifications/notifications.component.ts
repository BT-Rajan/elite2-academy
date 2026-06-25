import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Notification } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

const NOTIF_ICONS: Record<string, string> = {
  message: '💬', attendance: '✓', belt: '🥋', loyalty: '⭐', system: '🔔',
};

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, PageHeaderComponent, EmptyStateComponent, TimeAgoPipe],
  template: `
    <dojo-page-header title="Notifications">
      <button class="btn btn--secondary btn--sm" (click)="markAll()">Mark all read</button>
    </dojo-page-header>

    <div class="card">
      <div *ngIf="notifs$ | async as notifs">
        <dojo-empty-state *ngIf="notifs.length === 0"
          icon="🔔" title="All caught up!" subtitle="No notifications yet.">
        </dojo-empty-state>
        <div *ngFor="let n of notifs"
          class="notif-row" [class.unread]="!n.isRead"
          (click)="read(n)">
          <div class="notif-icon">{{ icon(n.type) }}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px">{{ n.title }}</div>
            <div class="text-muted text-sm" style="margin-top:2px">{{ n.body }}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
            <div class="text-dim text-sm">{{ n.createdAt | timeAgo }}</div>
            <div *ngIf="!n.isRead" style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notif-row  { display:flex; align-items:flex-start; gap:12px; padding:14px 20px;
                  border-bottom:1px solid var(--border); cursor:pointer;
                  transition:background .15s;
                  &:hover { background:var(--surface-2); }
                  &.unread { background:var(--accent-dim); }
                  &:last-child { border-bottom:none; } }
    .notif-icon { font-size:20px; width:36px; height:36px; display:flex; align-items:center;
                  justify-content:center; background:var(--surface-2);
                  border-radius:50%; flex-shrink:0; }
  `]
})
export class NotificationsComponent implements OnInit {
  private auth = inject(AuthService);
  private ns   = inject(NotificationService);

  notifs$!: Observable<Notification[]>;
  icon = (type: string) => NOTIF_ICONS[type] ?? '🔔';

  ngOnInit() {
    this.notifs$ = this.ns.forUser$(this.auth.currentUser()!.uid);
  }

  async read(n: Notification) {
    if (!n.isRead) await this.ns.markRead(n.id);
  }

  async markAll() {
    await this.ns.markAllRead(this.auth.currentUser()!.uid);
  }
}
