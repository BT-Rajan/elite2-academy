import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { StudentService } from '../../../core/services/student.service';
import { ToastService } from '../../../core/services/toast.service';
import { BranchService } from '../../../core/services/branch.service';
import { UserProfile, Student, Branch } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

type View = 'coaches' | 'staff' | 'parents' | 'invite';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, FormsModule,
            PageHeaderComponent, AvatarComponent, BadgeComponent,
            EmptyStateComponent, TimeAgoPipe, IconComponent],
  template: `
    <dojo-page-header title="Staff & Members" subtitle="Manage coaches, parents and access">
      <button class="btn btn--primary" (click)="activeView.set('invite')">+ Invite User</button>
    </dojo-page-header>

    <!-- Tab switcher -->
    <div class="tabs mb-4">
      <button class="tab-btn" [class.active]="activeView() === 'coaches'" (click)="activeView.set('coaches')">
        <dojo-icon name="users" [size]="14"></dojo-icon> Coaches ({{ (coaches$ | async)?.length ?? 0 }})
      </button>
      <button class="tab-btn" [class.active]="activeView() === 'staff'" (click)="activeView.set('staff')">
        <dojo-icon name="folder" [size]="14"></dojo-icon> Staff ({{ (staff$ | async)?.length ?? 0 }})
      </button>
      <button class="tab-btn" [class.active]="activeView() === 'parents'" (click)="activeView.set('parents')">
        <dojo-icon name="child" [size]="14"></dojo-icon> Parents ({{ (parents$ | async)?.length ?? 0 }})
      </button>
    </div>

    <!-- Coaches -->
    <ng-container *ngIf="activeView() === 'coaches'">
      <div class="card mb-4" style="padding:12px 16px">
        <input class="input" [(ngModel)]="search" placeholder="Search coaches…" style="max-width:320px">
      </div>
      <div class="card">
        <div *ngIf="coaches$ | async as coaches">
          <dojo-empty-state *ngIf="coaches.length === 0"
            icon="users" title="No coaches yet"
            subtitle="Invite coaches using the button above.">
          </dojo-empty-state>
          <table *ngIf="coaches.length > 0">
            <thead><tr><th>Coach</th><th>Email</th><th>Joined</th><th>Students</th><th>Head Coach</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let c of filterUsers(coaches)">
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <dojo-avatar [name]="c.displayName" size="sm"></dojo-avatar>
                    <div style="font-weight:600">{{ c.displayName }}</div>
                  </div>
                </td>
                <td class="text-muted">{{ c.email }}</td>
                <td class="text-muted">{{ c.createdAt | date:'MMM y' }}</td>
                <td>
                  <span class="badge badge--accent">{{ studentCount(c) }} students</span>
                </td>
                <td>
                  <span *ngIf="c.isHeadCoach" class="badge badge--success"><dojo-icon name="star" [size]="12"></dojo-icon> Head Coach</span>
                  <span *ngIf="!c.isHeadCoach" class="badge badge--gray">Coach</span>
                </td>
                <td>
                  <button class="btn btn--ghost btn--sm" (click)="selectedCoach.set(c)">View</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Coach detail panel -->
      <div *ngIf="selectedCoach() as coach" class="card mt-4">
        <div class="card__header">
          <div style="display:flex;align-items:center;gap:12px">
            <dojo-avatar [name]="coach.displayName" size="md"></dojo-avatar>
            <div>
              <div class="card__title">{{ coach.displayName }}</div>
              <div class="text-muted text-sm">{{ coach.email }}</div>
            </div>
          </div>
          <button class="btn btn--ghost btn--sm" (click)="selectedCoach.set(null)"><dojo-icon name="close" [size]="14"></dojo-icon> Close</button>
        </div>
        <div class="card__body">
          <div class="form-grid form-grid--3">
            <div>
              <div class="text-muted text-sm mb-1">Role</div>
              <span class="badge badge--info">Coach</span>
            </div>
            <div>
              <div class="text-muted text-sm mb-1">Joined</div>
              <div style="font-weight:600">{{ coach.createdAt | date:'MMMM d, y' }}</div>
            </div>
            <div>
              <div class="text-muted text-sm mb-1">Students at their branch</div>
              <div style="font-weight:600;color:var(--accent)">{{ studentCount(coach) }}</div>
            </div>
          </div>

          <div style="margin-top:16px;padding:12px 16px;background:var(--surface-2);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <div style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px"><dojo-icon name="pin" [size]="14"></dojo-icon> Branch</div>
              <div class="text-muted text-sm">Which location this coach is based at.</div>
            </div>
            <select class="input" style="max-width:220px" [ngModel]="coach.branchId" (ngModelChange)="assignBranch(coach, $event)">
              <option [ngValue]="null">Unassigned</option>
              <option *ngFor="let b of branches()" [ngValue]="b.id">{{ b.name }}</option>
            </select>
          </div>

          <div style="margin-top:16px;padding:12px 16px;background:var(--surface-2);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <div style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px"><dojo-icon name="star" [size]="14"></dojo-icon> Head Coach</div>
              <div class="text-muted text-sm">Can overrule other coaches' evaluations and force promotions.</div>
            </div>
            <button class="btn btn--sm" [class.btn--primary]="coach.isHeadCoach" [class.btn--secondary]="!coach.isHeadCoach"
              (click)="toggleHeadCoach(coach)">
              <dojo-icon *ngIf="coach.isHeadCoach" name="check" [size]="14"></dojo-icon>
              {{ coach.isHeadCoach ? 'Head Coach' : 'Make Head Coach' }}
            </button>
          </div>

          <div style="margin-top:16px">
            <div class="text-muted text-sm mb-2">Students at their branch</div>
            <div *ngIf="students$ | async as all">
              <div *ngFor="let s of coachStudents(all, coach)"
                style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                <dojo-avatar [name]="s.firstName + ' ' + s.lastName" size="xs"></dojo-avatar>
                <div style="font-size:13px">{{ s.firstName }} {{ s.lastName }}</div>
                <span class="badge badge--accent" style="margin-left:auto;display:inline-flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;flex-shrink:0" [style.background]="s.colorHex || 'var(--accent)'"></span>{{ s.beltName || 'No belt' }}</span>
              </div>
              <dojo-empty-state *ngIf="coachStudents(all, coach).length === 0"
                icon="child" title="No students assigned yet" subtitle="">
              </dojo-empty-state>
            </div>
          </div>
        </div>
      </div>
    </ng-container>

    <!-- Staff -->
    <ng-container *ngIf="activeView() === 'staff'">
      <div class="card mb-4" style="padding:12px 16px">
        <input class="input" [(ngModel)]="search" placeholder="Search staff…" style="max-width:320px">
      </div>
      <div class="card">
        <div *ngIf="staff$ | async as staff">
          <dojo-empty-state *ngIf="staff.length === 0"
            icon="folder" title="No staff yet"
            subtitle="Invite front-desk or office staff using the button above.">
          </dojo-empty-state>
          <table *ngIf="staff.length > 0">
            <thead><tr><th>Staff Member</th><th>Email</th><th>Branch</th><th>Joined</th></tr></thead>
            <tbody>
              <tr *ngFor="let s of filterUsers(staff)">
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <dojo-avatar [name]="s.displayName" size="sm"></dojo-avatar>
                    <div style="font-weight:600">{{ s.displayName }}</div>
                  </div>
                </td>
                <td class="text-muted">{{ s.email }}</td>
                <td>
                  <select class="input" style="font-size:12px;padding:6px 8px" [ngModel]="s.branchId" (ngModelChange)="assignBranch(s, $event)">
                    <option [ngValue]="null">Unassigned</option>
                    <option *ngFor="let b of branches()" [ngValue]="b.id">{{ b.name }}</option>
                  </select>
                </td>
                <td class="text-muted">{{ s.createdAt | date:'MMM y' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ng-container>

    <!-- Parents -->
    <ng-container *ngIf="activeView() === 'parents'">
      <div class="card mb-4" style="padding:12px 16px">
        <input class="input" [(ngModel)]="search" placeholder="Search parents…" style="max-width:320px">
      </div>
      <div class="card">
        <div *ngIf="parents$ | async as parents">
          <dojo-empty-state *ngIf="parents.length === 0"
            icon="users" title="No parents registered"
            subtitle="Parents register themselves and enrol their children.">
          </dojo-empty-state>
          <table *ngIf="parents.length > 0">
            <thead><tr><th>Parent</th><th>Email</th><th>Children</th><th>Joined</th></tr></thead>
            <tbody>
              <tr *ngFor="let p of filterUsers(parents)">
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <dojo-avatar [name]="p.displayName" size="sm"></dojo-avatar>
                    <div style="font-weight:600">{{ p.displayName }}</div>
                  </div>
                </td>
                <td class="text-muted">{{ p.email }}</td>
                <td>
                  <div *ngIf="students$ | async as all">
                    <span class="badge badge--gray">
                      {{ parentStudents(all, p.uid).length }} child(ren)
                    </span>
                  </div>
                </td>
                <td class="text-muted">{{ p.createdAt | date:'MMM y' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ng-container>

    <!-- Invite panel -->
    <ng-container *ngIf="activeView() === 'invite'">
      <div class="card" style="max-width:520px">
        <div class="card__header"><span class="card__title">Invite User</span></div>
        <div class="card__body">
          <p class="text-muted mb-4" style="font-size:14px">
            Share your Dojo ID with the person you want to invite.
            They enter it during signup to join your dojo automatically.
          </p>
          <div class="form-group">
            <label>Your Dojo ID</label>
            <div style="display:flex;gap:8px">
              <input class="input" [value]="dojoId()" readonly style="font-family:var(--font-mono);font-size:13px">
              <button class="btn btn--secondary" (click)="copyDojoId()">
                {{ copied() ? '✓ Copied' : 'Copy' }}
              </button>
            </div>
          </div>
          <div class="form-group">
            <label>Role to invite</label>
            <select class="select" [(ngModel)]="inviteRole">
              <option value="coach">Coach</option>
              <option value="staff">Staff</option>
              <option value="parent">Parent</option>
            </select>
          </div>
          <div style="background:var(--surface-2);border-radius:var(--radius-md);padding:16px;font-size:13px;line-height:1.7;color:var(--text-muted)">
            <strong style="color:var(--text)">Instructions to share:</strong><br>
            1. Go to <span style="color:var(--accent)">your-dojo-url/auth/signup</span><br>
            2. Select role: <strong>{{ inviteRole }}</strong><br>
            3. Enter Dojo ID: <strong style="color:var(--accent);font-family:var(--font-mono)">{{ dojoId() }}</strong><br>
            4. Complete signup
          </div>
          <button class="btn btn--secondary btn--full mt-4" (click)="activeView.set('coaches')">
            ← Back to Staff
          </button>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    .tabs     { display:flex; gap:4px; border-bottom:1px solid var(--border); }
    .tab-btn  { padding:8px 16px; font-size:13px; font-weight:500; border:none; background:none;
                color:var(--text-muted); cursor:pointer; border-bottom:2px solid transparent;
                margin-bottom:-1px; transition:color .15s,border-color .15s;
                &:hover { color:var(--text); }
                &.active { color:var(--accent); border-bottom-color:var(--accent); } }
  `]
})
export class StaffComponent implements OnInit {
  private auth  = inject(AuthService);
  private us    = inject(UserService);
  private sts   = inject(StudentService);
  private toast = inject(ToastService);
  private brs   = inject(BranchService);

  coaches$!: Observable<UserProfile[]>;
  staff$!: Observable<UserProfile[]>;
  parents$!: Observable<UserProfile[]>;
  students$!: Observable<Student[]>;

  activeView    = signal<View>('coaches');
  selectedCoach = signal<UserProfile | null>(null);
  search        = '';
  inviteRole    = 'coach';
  copied        = signal(false);
  dojoId        = () => this.auth.currentUser()?.dojoId ?? '';
  branches      = signal<Branch[]>([]);

  private _studentList: Student[] = [];

  ngOnInit() {
    const dojoId = this.auth.currentUser()!.dojoId;
    this.coaches$  = this.us.coaches$(dojoId);
    this.staff$    = this.us.staff$(dojoId);
    this.parents$  = this.us.parents$(dojoId);
    this.students$ = this.sts.byDojo$(dojoId);
    this.students$.subscribe(s => this._studentList = s);
    this.brs.list$().subscribe({ next: list => this.branches.set(list), error: () => {} });
  }

  async toggleHeadCoach(coach: UserProfile) {
    try {
      await this.us.setHeadCoach(coach.uid, !coach.isHeadCoach);
      coach.isHeadCoach = !coach.isHeadCoach;
      this.selectedCoach.set({ ...coach });
      this.coaches$ = this.us.coaches$(this.auth.currentUser()!.dojoId);
      this.toast.success(coach.isHeadCoach ? `${coach.displayName} is now Head Coach.` : `Head Coach designation removed.`);
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not update Head Coach status.');
    }
  }

  async assignBranch(user: UserProfile, branchId: string | null): Promise<void> {
    const prev = user.branchId;
    user.branchId = branchId ?? undefined; // optimistic -- the <select> already shows the new value
    try {
      await this.brs.assignUserBranch(user.uid, branchId);
      const dojoId = this.auth.currentUser()!.dojoId;
      this.coaches$ = this.us.coaches$(dojoId);
      this.staff$   = this.us.staff$(dojoId);
      this.toast.success(`${user.displayName}'s branch updated.`);
    } catch (e: any) {
      user.branchId = prev;
      this.toast.error(e.message ?? "Could not update this person's branch.");
    }
  }

  filterUsers(users: UserProfile[]): UserProfile[] {
    const q = this.search.toLowerCase();
    return q ? users.filter(u =>
      u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    ) : users;
  }

  // There's no direct coach<->student assignment in the data model --
  // branch is the best available signal (a coach based at a branch
  // teaches the students enrolled there). Previously this returned the
  // dojo-wide total / first 5 students for every coach regardless of who
  // was passed in, which was simply wrong.
  studentCount(coach: UserProfile): number {
    if (!coach.branchId) return 0;
    return this._studentList.filter(s => s.branchId === coach.branchId).length;
  }

  coachStudents(all: Student[], coach: UserProfile): Student[] {
    if (!coach.branchId) return [];
    return all.filter(s => s.branchId === coach.branchId).slice(0, 5);
  }

  parentStudents(all: Student[], parentUid: string): Student[] {
    return all.filter(s => s.parentUid === parentUid);
  }

  async copyDojoId() {
    await navigator.clipboard.writeText(this.dojoId());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
