import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { StudentService } from '../../../core/services/student.service';
import { UserProfile, Student } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

type View = 'coaches' | 'staff' | 'parents' | 'invite';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, FormsModule,
            PageHeaderComponent, AvatarComponent, BadgeComponent,
            EmptyStateComponent, TimeAgoPipe],
  template: `
    <dojo-page-header title="Staff & Members" subtitle="Manage coaches, parents and access">
      <button class="btn btn--primary" (click)="activeView.set('invite')">+ Invite User</button>
    </dojo-page-header>

    <!-- Tab switcher -->
    <div class="tabs mb-4">
      <button class="tab-btn" [class.active]="activeView() === 'coaches'" (click)="activeView.set('coaches')">
        👥 Coaches ({{ (coaches$ | async)?.length ?? 0 }})
      </button>
      <button class="tab-btn" [class.active]="activeView() === 'staff'" (click)="activeView.set('staff')">
        🗂️ Staff ({{ (staff$ | async)?.length ?? 0 }})
      </button>
      <button class="tab-btn" [class.active]="activeView() === 'parents'" (click)="activeView.set('parents')">
        👨‍👩‍👧 Parents ({{ (parents$ | async)?.length ?? 0 }})
      </button>
    </div>

    <!-- Coaches -->
    <ng-container *ngIf="activeView() === 'coaches'">
      <div class="card mb-4" style="padding:12px 16px">
        <input class="input" [(ngModel)]="search" placeholder="🔍 Search coaches…" style="max-width:320px">
      </div>
      <div class="card">
        <div *ngIf="coaches$ | async as coaches">
          <dojo-empty-state *ngIf="coaches.length === 0"
            icon="👥" title="No coaches yet"
            subtitle="Invite coaches using the button above.">
          </dojo-empty-state>
          <table *ngIf="coaches.length > 0">
            <thead><tr><th>Coach</th><th>Email</th><th>Joined</th><th>Students</th><th></th></tr></thead>
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
                  <span class="badge badge--accent">{{ studentCount(c.uid) }} students</span>
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
          <button class="btn btn--ghost btn--sm" (click)="selectedCoach.set(null)">✕ Close</button>
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
              <div class="text-muted text-sm mb-1">Students assigned</div>
              <div style="font-weight:600;color:var(--accent)">{{ studentCount(coach.uid) }}</div>
            </div>
          </div>

          <div style="margin-top:16px">
            <div class="text-muted text-sm mb-2">Assigned Students</div>
            <div *ngIf="students$ | async as all">
              <div *ngFor="let s of coachStudents(all, coach.uid)"
                style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                <dojo-avatar [name]="s.firstName + ' ' + s.lastName" size="xs"></dojo-avatar>
                <div style="font-size:13px">{{ s.firstName }} {{ s.lastName }}</div>
                <span class="badge badge--accent" style="margin-left:auto">{{ s.currentBeltId || 'No belt' }}</span>
              </div>
              <dojo-empty-state *ngIf="coachStudents(all, coach.uid).length === 0"
                icon="🧒" title="No students assigned yet" subtitle="">
              </dojo-empty-state>
            </div>
          </div>
        </div>
      </div>
    </ng-container>

    <!-- Staff -->
    <ng-container *ngIf="activeView() === 'staff'">
      <div class="card mb-4" style="padding:12px 16px">
        <input class="input" [(ngModel)]="search" placeholder="🔍 Search staff…" style="max-width:320px">
      </div>
      <div class="card">
        <div *ngIf="staff$ | async as staff">
          <dojo-empty-state *ngIf="staff.length === 0"
            icon="🗂️" title="No staff yet"
            subtitle="Invite front-desk or office staff using the button above.">
          </dojo-empty-state>
          <table *ngIf="staff.length > 0">
            <thead><tr><th>Staff Member</th><th>Email</th><th>Joined</th></tr></thead>
            <tbody>
              <tr *ngFor="let s of filterUsers(staff)">
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <dojo-avatar [name]="s.displayName" size="sm"></dojo-avatar>
                    <div style="font-weight:600">{{ s.displayName }}</div>
                  </div>
                </td>
                <td class="text-muted">{{ s.email }}</td>
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
        <input class="input" [(ngModel)]="search" placeholder="🔍 Search parents…" style="max-width:320px">
      </div>
      <div class="card">
        <div *ngIf="parents$ | async as parents">
          <dojo-empty-state *ngIf="parents.length === 0"
            icon="👨‍👩‍👧" title="No parents registered"
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

  private _studentList: Student[] = [];

  ngOnInit() {
    const dojoId = this.auth.currentUser()!.dojoId;
    this.coaches$  = this.us.coaches$(dojoId);
    this.staff$    = this.us.staff$(dojoId);
    this.parents$  = this.us.parents$(dojoId);
    this.students$ = this.sts.byDojo$(dojoId);
    this.students$.subscribe(s => this._studentList = s);
  }

  filterUsers(users: UserProfile[]): UserProfile[] {
    const q = this.search.toLowerCase();
    return q ? users.filter(u =>
      u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    ) : users;
  }

  studentCount(coachUid: string): number {
    return this._studentList.length; // simplified — full impl uses coach-student mapping
  }

  coachStudents(all: Student[], coachUid: string): Student[] {
    return all.slice(0, 5); // simplified — real impl filters by coach assignment
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
