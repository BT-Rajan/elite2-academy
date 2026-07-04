import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { StudentService } from '../../../core/services/student.service';
import { ToastService } from '../../../core/services/toast.service';
import { ClassSession, AttendanceRecord, Student, AttendanceStatus } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, FormsModule, RouterLink,
            PageHeaderComponent, AvatarComponent, BadgeComponent, EmptyStateComponent],
  template: `
    <dojo-page-header title="Attendance" subtitle="Mark and manage class sessions">
      <button class="btn btn--primary" (click)="openNewSession()" *ngIf="!activeSession()">
        + Open Session
      </button>
      <button class="btn btn--danger" (click)="closeSession()" *ngIf="activeSession() && !activeSession()!.isClosed">
        ✓ Close Session
      </button>
      <button class="btn btn--secondary" (click)="activeSession.set(null)" *ngIf="activeSession()?.isClosed">
        ← Back to list
      </button>
    </dojo-page-header>

    <!-- New session form -->
    <div class="card mb-4" *ngIf="showNewForm()">
      <div class="card__header"><span class="card__title">Open New Session</span></div>
      <div class="card__body">
        <div class="form-grid form-grid--2">
          <div class="form-group">
            <label>Class Name</label>
            <input class="input" [(ngModel)]="newSession.className" placeholder="e.g. Kickboxing Beginners">
          </div>
          <div class="form-group">
            <label>Date</label>
            <input class="input" type="date" [(ngModel)]="newSession.date">
          </div>
          <div class="form-group">
            <label>Start Time</label>
            <input class="input" type="time" [(ngModel)]="newSession.startTime">
          </div>
          <div class="form-group">
            <label>End Time</label>
            <input class="input" type="time" [(ngModel)]="newSession.endTime">
          </div>
          <div class="form-group">
            <label>Location</label>
            <input class="input" [(ngModel)]="newSession.location" placeholder="Ring A, Mat Room…">
          </div>
        </div>
        <div class="form-error" *ngIf="formError()">{{ formError() }}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn btn--primary" (click)="createSession()" [disabled]="saving()">
            {{ saving() ? 'Opening…' : 'Open Session' }}
          </button>
          <button class="btn btn--secondary" (click)="showNewForm.set(false)">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Active / viewed session — take attendance, or review if closed -->
    <div class="card mb-4" *ngIf="activeSession() as session">
      <div class="card__header">
        <div>
          <span class="card__title">{{ session.className }}</span>
          <div class="text-muted text-sm" style="margin-top:2px">
            {{ session.date | date:'EEE, MMM d' }} · {{ session.startTime }}–{{ session.endTime }} · {{ session.location }}
          </div>
        </div>
        <span class="badge" [class]="session.isClosed ? 'badge--gray' : 'badge--success'">
          {{ session.isClosed ? 'Closed — read only' : 'Open' }}
        </span>
      </div>
      <div class="card__body" style="padding:0">
        <div *ngIf="students$ | async as students">
          <dojo-empty-state *ngIf="students.length === 0"
            icon="🧒" title="No students found"
            subtitle="Students assigned to your dojo will appear here.">
          </dojo-empty-state>
          <div *ngFor="let s of students" class="attendance-row">
            <dojo-avatar [name]="s.firstName + ' ' + s.lastName" size="sm"></dojo-avatar>
            <div style="flex:1;min-width:0">
              <div class="font-bold" style="font-size:13px">{{ s.firstName }} {{ s.lastName }}</div>
              <div class="text-muted text-sm">{{ s.disciplineName || 'No discipline' }}</div>
            </div>
            <div class="status-btns" *ngIf="!session.isClosed">
              <button *ngFor="let opt of statusOpts"
                class="btn btn--sm"
                [class.btn--primary]="getStatus(s.id) === opt.value"
                [class.btn--secondary]="getStatus(s.id) !== opt.value"
                (click)="setStatus(session.id, s, opt.value)">
                {{ opt.label }}
              </button>
            </div>
            <!-- Closed session: show the recorded status only, nothing to click -->
            <span *ngIf="session.isClosed" class="badge" [class]="statusBadgeClass(getStatus(s.id))">
              {{ statusLabel(getStatus(s.id)) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Past sessions -->
    <div class="card" *ngIf="!activeSession()">
      <div class="card__header"><span class="card__title">Past Sessions</span></div>
      <div *ngIf="sessions$ | async as sessions">
        <dojo-empty-state *ngIf="sessions.length === 0"
          icon="📅" title="No sessions yet" subtitle="Open a session above to start.">
        </dojo-empty-state>
        <table *ngIf="sessions.length > 0">
          <thead>
            <tr><th>Class</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of sessions" class="clickable-row" (click)="viewSession(s)">
              <td><strong>{{ s.className }}</strong></td>
              <td>{{ s.date | date:'MMM d, y' }}</td>
              <td class="text-muted">{{ s.startTime }}–{{ s.endTime }}</td>
              <td>
                <span class="badge" [class]="s.isClosed ? 'badge--gray' : 'badge--success'">
                  {{ s.isClosed ? 'Closed' : 'Open' }}
                </span>
              </td>
              <td class="text-muted" style="text-align:right">{{ s.isClosed ? 'Review →' : 'Continue →' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .attendance-row {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 20px; border-bottom: 1px solid var(--border);
      &:last-child { border-bottom: none; }
    }
    .status-btns { display: flex; gap: 4px; flex-wrap: wrap; }
    .clickable-row { cursor: pointer; transition: background .1s; }
    .clickable-row:hover { background: var(--surface-2); }
  `]
})
export class AttendanceComponent implements OnInit {
  private auth    = inject(AuthService);
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private ss      = inject(SessionService);
  private as_     = inject(AttendanceService);
  private sts     = inject(StudentService);
  private toast   = inject(ToastService);

  sessions$!:  Observable<ClassSession[]>;
  students$!:  Observable<Student[]>;

  activeSession  = signal<ClassSession | null>(null);
  showNewForm    = signal(false);
  saving         = signal(false);
  formError      = signal('');

  // Map studentId → status for the currently viewed/active session
  private statusMap = signal<Record<string, AttendanceStatus>>({});

  readonly statusOpts = [
    { value: 'present' as AttendanceStatus, label: '✓ Present' },
    { value: 'late'    as AttendanceStatus, label: '⏱ Late' },
    { value: 'excused' as AttendanceStatus, label: '📋 Excused' },
    { value: 'absent'  as AttendanceStatus, label: '✗ Absent' },
  ];

  newSession = { className: '', date: new Date().toISOString().split('T')[0],
                 startTime: '17:00', endTime: '18:30', location: '' };

  ngOnInit() {
    const coachUid = this.auth.currentUser()!.uid;
    const dojoId   = this.auth.currentUser()!.dojoId;
    this.sessions$ = this.ss.byCoach$(coachUid);
    this.students$ = this.sts.byDojo$(dojoId);

    // Deep link support — e.g. from the admin dashboard's Recent Sessions.
    const sessionId = this.route.snapshot.queryParamMap.get('sessionId');
    if (sessionId) {
      this.ss.get$(sessionId).subscribe(s => this.viewSession(s));
    }
  }

  openNewSession() { this.showNewForm.set(true); this.formError.set(''); }

  async createSession() {
    if (!this.newSession.className) { this.formError.set('Class name is required.'); return; }
    this.saving.set(true);
    const user = this.auth.currentUser()!;
    try {
      const session = await this.ss.create({
        dojoId: user.dojoId, coachUid: user.uid,
        classId: '', disciplineId: '',
        className: this.newSession.className,
        date: new Date(this.newSession.date) as any,
        startTime: this.newSession.startTime,
        endTime: this.newSession.endTime,
        location: this.newSession.location,
        isClosed: false,
      });
      this.statusMap.set({});
      this.activeSession.set(session);
      this.showNewForm.set(false);
    } catch (e: any) {
      this.formError.set(e.message ?? 'Could not create session.');
    } finally {
      this.saving.set(false);
    }
  }

  async closeSession() {
    const s = this.activeSession();
    if (!s) return;
    try {
      await this.ss.update(String(s.id), { isClosed: true } as any);
      this.activeSession.set(null);
      this.statusMap.set({});
      this.toast.success('Session closed.');
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not close the session.');
    }
  }

  getStatus(studentId: string): AttendanceStatus | null {
    return this.statusMap()[studentId] ?? null;
  }

  async setStatus(sessionId: string, student: Student, status: AttendanceStatus) {
    const prev = this.statusMap();
    this.statusMap.set({ ...prev, [student.id]: status });

    const user = this.auth.currentUser()!;
    try {
      await this.as_.create({
        sessionId, studentId: String(student.id), status,
        markedBy: user.uid, markedAt: new Date() as any,
      });
      // Loyalty points are awarded server-side by AttendanceController::markAttendance()
      // — do not award again here to avoid double-counting.
    } catch (e: any) {
      // Roll back the optimistic UI update -- the backend never recorded
      // this, so showing it as marked would be lying to the coach.
      this.statusMap.set(prev);
      this.toast.error(e.message ?? `Could not mark ${student.firstName} ${status}. Try again.`);
    }
  }

  statusBadgeClass(status: AttendanceStatus | null): string {
    switch (status) {
      case 'present': return 'badge--success';
      case 'late':     return 'badge--warning';
      case 'excused':  return 'badge--info';
      case 'absent':   return 'badge--danger';
      default:         return 'badge--gray';
    }
  }

  statusLabel(status: AttendanceStatus | null): string {
    return this.statusOpts.find(o => o.value === status)?.label ?? 'Not marked';
  }

  // Open any session for viewing — editable if still open, read-only once
  // closed. Also preloads whatever attendance was already recorded so the
  // roster reflects reality instead of resetting to blank.
  viewSession(s: ClassSession) {
    this.activeSession.set(s);
    this.as_.bySession$(String(s.id)).subscribe(records => {
      const map: Record<string, AttendanceStatus> = {};
      for (const r of records) { map[String(r.studentId)] = r.status; }
      this.statusMap.set(map);
    });
    // Reflect the deep link in the URL without a full navigation, so a
    // refresh or share of the link lands back on the same session.
    this.router.navigate([], { relativeTo: this.route, queryParams: { sessionId: s.id }, replaceUrl: true });
  }
}
