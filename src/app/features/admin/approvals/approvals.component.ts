import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import { PendingUser } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-pending-approvals',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, TitleCasePipe,
            PageHeaderComponent, EmptyStateComponent, LoadingComponent,
            IconComponent, BadgeComponent, TimeAgoPipe],
  template: `
    <dojo-page-header
      title="Pending Approvals"
      subtitle="New sign-ups need approval before they can access the dojo.">
    </dojo-page-header>

    <ng-container *ngIf="pending$ | async as list; else loadingTpl">
      <dojo-empty-state *ngIf="list.length === 0"
        icon="check-circle" title="All caught up"
        subtitle="No accounts are waiting for approval right now.">
      </dojo-empty-state>

      <div class="card" *ngIf="list.length > 0">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Requested role</th>
              <th>Requested</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of list">
              <td style="font-weight:600">{{ u.displayName }}</td>
              <td class="text-muted">{{ u.email }}</td>
              <td>
                <dojo-badge [variant]="u.role === 'admin' ? 'warning' : 'info'">
                  {{ u.role | titlecase }}
                </dojo-badge>
                <span *ngIf="u.role === 'admin'" class="text-muted text-sm" style="margin-left:8px">
                  Needs Head Coach approval
                </span>
              </td>
              <td class="text-muted" [title]="u.createdAt | date:'medium'">{{ u.createdAt | timeAgo }}</td>
              <td style="text-align:right;white-space:nowrap">
                <ng-container *ngIf="canActOn(u); else noPermission">
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
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-container>
    <ng-template #loadingTpl>
      <dojo-loading label="Loading pending accounts…"></dojo-loading>
    </ng-template>
  `,
  styles: [`
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); font-size: 13px; }
    th { color: var(--text-muted); font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
    tr:last-child td { border-bottom: none; }
  `],
})
export class PendingApprovalsComponent implements OnInit {
  private auth  = inject(AuthService);
  private us    = inject(UserService);
  private toast = inject(ToastService);

  pending$!: Observable<PendingUser[]>;
  busy = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.pending$ = this.us.pending$(this.auth.currentUser()!.dojoId);
  }

  // Mirrors the server-side rule in AuthMiddleware::requireHeadCoach /
  // GenericController::approveUser -- shown here so the buttons aren't
  // offered when they'd just come back as a 403. The server independently
  // enforces this regardless of what the UI shows.
  canActOn(u: PendingUser): boolean {
    const user = this.auth.currentUser();
    if (!user) return false;
    if (u.role === 'admin') return user.role === 'admin' || !!user.isHeadCoach;
    return user.role === 'admin' || user.role === 'staff';
  }

  async approve(u: PendingUser) {
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

  async reject(u: PendingUser) {
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
}
