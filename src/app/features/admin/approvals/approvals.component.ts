import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AccountRecord } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

type Tab = 'pending' | 'history';

@Component({
  selector: 'app-pending-approvals',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe,
            PageHeaderComponent, EmptyStateComponent, LoadingComponent,
            IconComponent, BadgeComponent, TimeAgoPipe],
  template: `
    <dojo-page-header
      title="Approvals"
      subtitle="New sign-ups, account history, and access control for the dojo.">
    </dojo-page-header>

    <div class="tabs">
      <button class="tab" [class.tab--active]="tab() === 'pending'" (click)="tab.set('pending')">
        Pending <span class="tab-count" *ngIf="pendingCount() > 0">{{ pendingCount() }}</span>
      </button>
      <button class="tab" [class.tab--active]="tab() === 'history'" (click)="tab.set('history')">
        Full History
      </button>
    </div>

    <dojo-loading *ngIf="loading()" label="Loading accounts…"></dojo-loading>

    <ng-container *ngIf="!loading()">
      <dojo-empty-state *ngIf="visibleRows().length === 0"
        icon="check-circle"
        [title]="tab() === 'pending' ? 'All caught up' : 'No accounts yet'"
        [subtitle]="tab() === 'pending' ? 'No accounts are waiting for approval right now.' : 'Nothing to show here yet.'">
      </dojo-empty-state>

      <div class="card" *ngIf="visibleRows().length > 0">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>{{ tab() === 'pending' ? 'Requested' : 'Created' }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of visibleRows()">
              <td style="font-weight:600">{{ u.displayName }}</td>
              <td class="text-muted">{{ u.email }}</td>
              <td>
                <dojo-badge [variant]="u.role === 'admin' ? 'warning' : 'info'">
                  {{ u.role | titlecase }}
                </dojo-badge>
                <span *ngIf="u.isHeadCoach" class="text-muted text-sm" style="margin-left:6px">Head Coach</span>
              </td>
              <td>
                <dojo-badge [variant]="statusVariant(u)">{{ statusLabel(u) }}</dojo-badge>
                <span *ngIf="u.role === 'admin' && u.approvalStatus === 'pending'"
                      class="text-muted text-sm" style="margin-left:8px">
                  Needs Head Coach approval
                </span>
              </td>
              <td class="text-muted" [title]="u.createdAt | date:'medium'">{{ u.createdAt | timeAgo }}</td>
              <td style="text-align:right;white-space:nowrap">
                <ng-container *ngIf="u.approvalStatus === 'pending'; else lifecycleActions">
                  <ng-container *ngIf="canActOnPending(u); else noPermission">
                    <button class="btn btn--secondary btn--sm" [disabled]="busy() === u.uid"
                            (click)="reject(u)">
                      <dojo-icon name="close" [size]="14"></dojo-icon> Reject
                    </button>
                    <button class="btn btn--primary btn--sm" style="margin-left:8px" [disabled]="busy() === u.uid"
                            (click)="approve(u)">
                      <dojo-icon name="check" [size]="14"></dojo-icon> Approve
                    </button>
                  </ng-container>
                  <ng-template #noPermission>
                    <span class="text-muted text-sm">Head Coach or Admin required</span>
                  </ng-template>
                </ng-container>

                <ng-template #lifecycleActions>
                  <ng-container *ngIf="canManage(u); else noManagePermission">
                    <button *ngIf="u.role === 'coach' && u.approvalStatus === 'approved'"
                            class="btn btn--secondary btn--sm" [disabled]="busy() === u.uid"
                            (click)="downgrade(u)">
                      <dojo-icon name="trending" [size]="14"></dojo-icon> Downgrade to Staff
                    </button>
                    <button *ngIf="u.isActive === false"
                            class="btn btn--primary btn--sm" style="margin-left:8px" [disabled]="busy() === u.uid"
                            (click)="unblock(u)">
                      <dojo-icon name="check-circle" [size]="14"></dojo-icon> Unblock
                    </button>
                    <button *ngIf="u.isActive !== false && u.approvalStatus !== 'rejected'"
                            class="btn btn--secondary btn--sm" style="margin-left:8px" [disabled]="busy() === u.uid"
                            (click)="block(u)">
                      <dojo-icon name="warning" [size]="14"></dojo-icon> Block
                    </button>
                  </ng-container>
                  <ng-template #noManagePermission>
                    <span class="text-muted text-sm">Head Coach or Admin required</span>
                  </ng-template>
                </ng-template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-container>
  `,
  styles: [`
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); font-size: 13px; }
    th { color: var(--text-muted); font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
    tr:last-child td { border-bottom: none; }
    .tabs { display:flex; gap:4px; margin-bottom:16px; border-bottom:1px solid var(--border); }
    .tab {
      background:none; border:none; cursor:pointer; padding:10px 16px; font-size:13px; font-weight:600;
      color:var(--text-muted); border-bottom:2px solid transparent; display:flex; align-items:center; gap:6px;
    }
    .tab--active { color:var(--text); border-bottom-color:var(--accent); }
    .tab-count {
      background:var(--accent); color:#fff; border-radius:10px; font-size:11px;
      padding:1px 7px; font-weight:700;
    }
  `],
})
export class PendingApprovalsComponent implements OnInit {
  private auth    = inject(AuthService);
  private us      = inject(UserService);
  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);

  tab     = signal<Tab>('pending');
  busy    = signal<string | null>(null);
  loading = signal(true);

  private pending = signal<AccountRecord[]>([]);
  private history = signal<AccountRecord[]>([]);

  pendingCount = computed(() => this.pending().length);
  visibleRows  = computed(() => this.tab() === 'pending' ? this.pending() : this.history());

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    const dojoId = this.auth.currentUser()!.dojoId;
    this.us.pending$(dojoId).subscribe(rows => {
      this.pending.set(rows);
      this.loading.set(false);
    });
    this.us.history$(dojoId).subscribe(rows => this.history.set(rows));
  }

  statusLabel(u: AccountRecord): string {
    if (u.isActive === false) return 'Blocked';
    if (!u.approvalStatus) return 'Approved';
    return u.approvalStatus[0].toUpperCase() + u.approvalStatus.slice(1);
  }

  statusVariant(u: AccountRecord): 'success' | 'warning' | 'danger' | 'gray' {
    if (u.isActive === false) return 'danger';
    switch (u.approvalStatus) {
      case 'pending':  return 'warning';
      case 'rejected': return 'gray';
      default:         return 'success';
    }
  }

  // Mirrors the server-side rule in AuthMiddleware::requireHeadCoach /
  // GenericController::approveUser -- shown here so the buttons aren't
  // offered when they'd just come back as a 403. The server independently
  // enforces this regardless of what the UI shows.
  canActOnPending(u: AccountRecord): boolean {
    const user = this.auth.currentUser();
    if (!user) return false;
    if (u.role === 'admin') return user.role === 'admin' || !!user.isHeadCoach;
    return user.role === 'admin' || user.role === 'staff';
  }

  // Block/unblock/downgrade are Head Coach or Admin only -- a step up from
  // approve/reject, which staff can also do (see GenericController::blockUser
  // / unblockUser / downgradeCoachToStaff). Head Coach can act on anyone,
  // including an Admin account.
  canManage(u: AccountRecord): boolean {
    const user = this.auth.currentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'coach' && user.isHeadCoach) return true;
    return false;
  }

  async approve(u: AccountRecord) {
    this.busy.set(u.uid);
    try {
      await this.us.approve(u.uid);
      this.toast.success(`${u.displayName} approved.`);
      this.load();
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not approve this account.');
    } finally {
      this.busy.set(null);
    }
  }

  async reject(u: AccountRecord) {
    const ok = await this.confirm.ask({
      title: 'Reject this request?',
      message: `${u.displayName}'s (${u.email}) account request will be rejected. They will not be able to sign in.`,
      confirmLabel: 'Reject', danger: true,
    });
    if (!ok) return;

    this.busy.set(u.uid);
    try {
      await this.us.reject(u.uid);
      this.toast.info(`${u.displayName}'s request was rejected.`);
      this.load();
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not reject this account.');
    } finally {
      this.busy.set(null);
    }
  }

  async block(u: AccountRecord) {
    const ok = await this.confirm.ask({
      title: 'Block this account?',
      message: `${u.displayName} will be signed out immediately and won't be able to log back in until unblocked.`,
      confirmLabel: 'Block', danger: true,
    });
    if (!ok) return;

    this.busy.set(u.uid);
    try {
      await this.us.block(u.uid);
      this.toast.info(`${u.displayName} has been blocked.`);
      this.load();
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not block this account.');
    } finally {
      this.busy.set(null);
    }
  }

  async unblock(u: AccountRecord) {
    this.busy.set(u.uid);
    try {
      await this.us.unblock(u.uid);
      this.toast.success(`${u.displayName} has been unblocked.`);
      this.load();
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not unblock this account.');
    } finally {
      this.busy.set(null);
    }
  }

  async downgrade(u: AccountRecord) {
    const ok = await this.confirm.ask({
      title: 'Downgrade to Staff?',
      message: `${u.displayName} will lose coaching permissions (attendance, evaluations, curriculum) and become a Staff member instead.`,
      confirmLabel: 'Downgrade', danger: true,
    });
    if (!ok) return;

    this.busy.set(u.uid);
    try {
      await this.us.downgradeToStaff(u.uid);
      this.toast.success(`${u.displayName} is now Staff.`);
      this.load();
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not downgrade this account.');
    } finally {
      this.busy.set(null);
    }
  }
}
