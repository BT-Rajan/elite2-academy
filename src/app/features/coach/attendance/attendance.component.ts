import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Observable, switchMap, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { StudentService } from '../../../core/services/student.service';
import { LoyaltyService } from '../../../core/services/loyalty.service';
import { ClassSession, AttendanceRecord, Student, AttendanceStatus } from '../../../core/models';
import { ATTENDANCE_LABELS } from '../../../core/utils';
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
      <button class="btn btn--danger" (click)="closeSession()" *ngIf="activeSession()">
        ✓ Close Session
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

    <!-- Active session — take attendance -->
    <div class="card mb-4" *ngIf="activeSession() as session">
      <div class="card__header">
        <div>
          <span class="card__title">{{ session.className }}</span>
          <div class="text-muted text-sm" style="margin-top:2px">
            {{ session.date | date:'EEE, MMM d' }} · {{ session.startTime }}–{{ session.endTime }} · {{ session.location }}
          </div>
        </div>
        <span class="badge badge--success">Open</span>
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
              <div class="text-muted text-sm">{{ s.disciplineId }}</div>
            </div>
            <div class="status-btns">
              <button *ngFor="let opt of statusOpts"
                class="btn btn--sm"
                [class.btn--primary]="getStatus(s.id) === opt.value"
                [class.btn--secondary]="getStatus(s.id) !== opt.value"
                (click)="setStatus(session.id, s, opt.value)">
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Past sessions -->
    <div class="card">
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
            <tr *ngFor="let s of sessions">
              <td><strong>{{ s.className }}</strong></td>
              <td>{{ s.date | date:'MMM d, y' }}</td>
              <td class="text-muted">{{ s.startTime }}–{{ s.endTime }}</td>
              <td>
                <span class="badge" [class]="s.isClosed ? 'badge--gray' : 'badge--success'">
                  {{ s.isClosed ? 'Closed' : 'Open' }}
                </span>
              </td>
              <td>
                <button class="btn btn--ghost btn--sm" (click)="viewSession(s)">View</button>
              </td>
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
  `]
})
export class AttendanceComponent implements OnInit {
  private auth    = inject(AuthService);
  private ss      = inject(SessionService);
  private as_     = inject(AttendanceService);
  private sts     = inject(StudentService);
  private ls      = inject(LoyaltyService);

  sessions$!:  Observable<ClassSession[]>;
  students$!:  Observable<Student[]>;

  activeSession  = signal<ClassSession | null>(null);
  showNewForm    = signal(false);
  saving         = signal(false);
  formError      = signal('');

  // Map studentId → status for the active session
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
  }

  openNewSession() { this.showNewForm.set(true); this.formError.set(''); }

  async createSession() {
    if (!this.newSession.className) { this.formError.set('Class name is required.'); return; }
    this.saving.set(true);
    const user = this.auth.currentUser()!;
    const id = await this.ss.add({
      dojoId: user.dojoId, coachUid: user.uid,
      classId: '', disciplineId: '',
      className: this.newSession.className,
      date: new Date(this.newSession.date) as any,
      startTime: this.newSession.startTime,
      endTime: this.newSession.endTime,
      location: this.newSession.location,
      isClosed: false,
    });
    const session = await this.ss.get$(id).pipe().toPromise();
    this.activeSession.set({ ...this.newSession, id, isClosed: false,
      dojoId: user.dojoId, coachUid: user.uid, classId: '', disciplineId: '',
      date: new Date(this.newSession.date) } as ClassSession);
    this.showNewForm.set(false);
    this.saving.set(false);
  }

  async closeSession() {
    const s = this.activeSession();
    if (!s) return;
    await this.ss.update(s.id, { isClosed: true } as any);
    this.activeSession.set(null);
    this.statusMap.set({});
  }

  getStatus(studentId: string): AttendanceStatus | null {
    return this.statusMap()[studentId] ?? null;
  }

  async setStatus(sessionId: string, student: Student, status: AttendanceStatus) {
    const prev = this.statusMap();
    this.statusMap.set({ ...prev, [student.id]: status });

    const user = this.auth.currentUser()!;
    await this.as_.add({
      sessionId, studentId: student.id, status,
      markedBy: user.uid, markedAt: new Date() as any,
    });

    // Award loyalty points for attendance
    if (status === 'present' || status === 'late') {
      const pts = status === 'present' ? 10 : 5;
      await this.ls.award(student.parentUid, user.dojoId, pts, 'attendance',
        `${status === 'present' ? 'Present' : 'Late'} at ${this.activeSession()?.className}`);
    }
  }

  viewSession(s: ClassSession) {
    if (!s.isClosed) this.activeSession.set(s);
  }
}
