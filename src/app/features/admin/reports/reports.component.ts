import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { combineLatest, map, Observable, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService } from '../../../core/services/student.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { UserService } from '../../../core/services/user.service';
import { LoyaltyService } from '../../../core/services/loyalty.service';
import { ToastService } from '../../../core/services/toast.service';
import { Student, AttendanceRecord, UserProfile, LoyaltyAccount } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { IconComponent, IconName } from '../../../shared/components/icon/icon.component';

type ReportTab = 'overview' | 'attendance' | 'students' | 'loyalty';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, FormsModule, IconComponent, RouterLink,
            PageHeaderComponent, StatCardComponent, EmptyStateComponent],
  template: `
    <dojo-page-header title="Reports" subtitle="Business analytics and performance metrics">
      <button class="btn btn--secondary" (click)="exportCsv()">⬇ Export CSV</button>
    </dojo-page-header>

    <!-- Tab nav -->
    <div class="tabs mb-6">
      <button *ngFor="let t of tabs" class="tab-btn"
        [class.active]="activeTab() === t.key" (click)="activeTab.set(t.key); clearDrillDown()">
        <dojo-icon [name]="t.icon" [size]="16"></dojo-icon> {{ t.label }}
      </button>
    </div>

    <!-- Overview -->
    <ng-container *ngIf="activeTab() === 'overview'">
      <div class="stat-grid stat-grid--4 mb-6">
        <dojo-stat-card icon="child" [value]="stats().students"   label="Active Students" link="/admin/students"></dojo-stat-card>
        <dojo-stat-card icon="users" [value]="stats().coaches"    label="Coaches" link="/admin/staff"></dojo-stat-card>
        <dojo-stat-card icon="calendar" [value]="stats().attendance" label="Sessions this month"></dojo-stat-card>
        <dojo-stat-card icon="star" [value]="stats().loyalty"    label="Points awarded total"></dojo-stat-card>
      </div>

      <!-- Belt distribution -->
      <div class="form-grid form-grid--2">
        <div class="card">
          <div class="card__header">
            <span class="card__title">Students by Belt</span>
            <span class="text-muted text-sm">Click a belt to see who's on it</span>
          </div>
          <div class="card__body">
            <div *ngIf="students$ | async as students">
              <dojo-empty-state *ngIf="students.length === 0" icon="belt" title="No data yet"></dojo-empty-state>
              <div *ngFor="let row of beltDistribution(students)"
                (click)="drillBelt(students, row.belt)"
                [class.drill-row--active]="drillDown()?.type === 'belt' && drillDown()?.key === row.belt"
                class="drill-row"
                style="display:flex;align-items:center;gap:12px;margin-bottom:10px;cursor:pointer;padding:4px 6px;border-radius:6px">
                <div style="width:12px;height:12px;border-radius:50%;flex-shrink:0" [style.background]="row.color"></div>
                <div style="flex:1;font-size:13px">{{ row.belt }}</div>
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:100px;height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                    <div style="height:100%;border-radius:4px;background:var(--accent)"
                      [style.width.%]="row.pct"></div>
                  </div>
                  <span style="font-size:12px;color:var(--text-muted);width:24px">{{ row.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__header">
            <span class="card__title">Enrolment Over Time</span>
            <span class="text-muted text-sm">Click a month for the roster</span>
          </div>
          <div class="card__body">
            <div *ngIf="students$ | async as students">
              <dojo-empty-state *ngIf="students.length === 0" icon="trending" title="No data yet"></dojo-empty-state>
              <div *ngFor="let row of enrolmentByMonth(students)"
                (click)="drillMonth(students, row.month)"
                [class.drill-row--active]="drillDown()?.type === 'month' && drillDown()?.key === row.month"
                class="drill-row"
                style="display:flex;align-items:center;gap:12px;margin-bottom:10px;cursor:pointer;padding:4px 6px;border-radius:6px">
                <div style="width:60px;font-size:12px;color:var(--text-muted);flex-shrink:0">{{ row.month }}</div>
                <div style="flex:1;height:20px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                  <div style="height:100%;border-radius:4px;background:var(--accent);display:flex;align-items:center;padding-left:8px"
                    [style.width.%]="row.pct">
                    <span *ngIf="row.pct > 20" style="font-size:11px;color:#fff;font-weight:600">{{ row.count }}</span>
                  </div>
                </div>
                <span style="font-size:12px;color:var(--text-muted);width:20px">{{ row.count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Drill-down panel: shared by both overview charts -->
      <div class="card mt-4" *ngIf="drillDown() as d">
        <div class="card__header">
          <span class="card__title">{{ d.title }}</span>
          <button class="btn btn--ghost btn--sm" (click)="clearDrillDown()">
            <dojo-icon name="close" [size]="13"></dojo-icon> Close
          </button>
        </div>
        <dojo-empty-state *ngIf="d.students.length === 0" icon="child" title="No students match"></dojo-empty-state>
        <table *ngIf="d.students.length > 0">
          <thead><tr><th>Student</th><th>Discipline</th><th>Belt</th><th>Enrolled</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let s of d.students">
              <td><strong>{{ s.firstName }} {{ s.lastName }}</strong></td>
              <td class="text-muted">{{ s.disciplineName || '—' }}</td>
              <td>
                <span class="badge badge--accent" style="display:inline-flex;align-items:center;gap:6px">
                  <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0" [style.background]="s.colorHex || 'var(--accent)'"></span>
                  {{ s.beltName || '—' }}
                </span>
              </td>
              <td class="text-muted">{{ s.enrolledAt | date:'MMM d, y' }}</td>
              <td><a [routerLink]="['/admin/students', s.id]" class="btn btn--ghost btn--sm">View →</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-container>

    <!-- Attendance report -->
    <ng-container *ngIf="activeTab() === 'attendance'">
      <div class="card mb-4" style="padding:12px 16px">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div class="form-group" style="margin:0">
            <label style="margin-right:8px">From</label>
            <input type="date" class="input" [(ngModel)]="dateFrom" style="width:auto;display:inline-block">
          </div>
          <div class="form-group" style="margin:0">
            <label style="margin-right:8px">To</label>
            <input type="date" class="input" [(ngModel)]="dateTo" style="width:auto;display:inline-block">
          </div>
          <span class="text-muted text-sm">Showing the most recent 200 attendance marks dojo-wide, filtered to this range.</span>
        </div>
      </div>

      <div class="card">
        <div class="card__header"><span class="card__title">Attendance Summary</span></div>
        <div *ngIf="attendanceSummary() as rows">
          <dojo-empty-state *ngIf="rows.length === 0" icon="calendar" title="No attendance in this range"></dojo-empty-state>
          <table *ngIf="rows.length > 0">
            <thead>
              <tr><th>Student</th><th>Belt</th><th style="text-align:center">Present</th>
                  <th style="text-align:center">Late</th><th style="text-align:center">Absent</th>
                  <th style="text-align:right">Rate</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of rows" (click)="drillStudentAttendance(row)"
                  class="drill-row" [class.drill-row--active]="isDrilledStudent(row.student)"
                  style="cursor:pointer">
                <td><strong>{{ row.student.firstName }} {{ row.student.lastName }}</strong></td>
                <td>
                  <span class="badge badge--accent" style="display:inline-flex;align-items:center;gap:6px">
                    <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0" [style.background]="row.student.colorHex || 'var(--accent)'"></span>
                    {{ row.student.beltName || '—' }}
                  </span>
                </td>
                <td style="text-align:center;color:var(--success)">{{ row.present }}</td>
                <td style="text-align:center;color:var(--warning)">{{ row.late }}</td>
                <td style="text-align:center;color:var(--danger)">{{ row.absent }}</td>
                <td style="text-align:right;font-weight:600">{{ row.rate }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Per-student drill-down: the actual marked records behind the summary row -->
      <div class="card mt-4" *ngIf="drillStudent() as d">
        <div class="card__header">
          <span class="card__title">{{ d.student.firstName }} {{ d.student.lastName }} — attendance detail</span>
          <button class="btn btn--ghost btn--sm" (click)="drillStudent.set(null)">
            <dojo-icon name="close" [size]="13"></dojo-icon> Close
          </button>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Class</th><th>Status</th></tr></thead>
          <tbody>
            <tr *ngFor="let r of d.records">
              <td class="text-muted">{{ r.date | date:'MMM d, y' }}</td>
              <td>{{ r.className || '—' }}</td>
              <td>
                <span class="badge"
                  [class.badge--success]="r.status === 'present'"
                  [class.badge--warning]="r.status === 'late'"
                  [class.badge--danger]="r.status === 'absent'"
                  [class.badge--gray]="r.status === 'excused'">
                  {{ r.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-container>

    <!-- Student report -->
    <ng-container *ngIf="activeTab() === 'students'">
      <div class="card">
        <div class="card__header">
          <span class="card__title">All Students</span>
          <span class="text-muted text-sm" *ngIf="students$ | async as s">{{ s.length }} total · click a row for full profile</span>
        </div>
        <div *ngIf="students$ | async as students">
          <dojo-empty-state *ngIf="students.length === 0" icon="child" title="No students"></dojo-empty-state>
          <table *ngIf="students.length > 0">
            <thead>
              <tr><th>Name</th><th>Discipline</th><th>Belt</th><th>Enrolled</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of students" [routerLink]="['/admin/students', s.id]" class="drill-row" style="cursor:pointer">
                <td><strong>{{ s.firstName }} {{ s.lastName }}</strong></td>
                <td class="text-muted">{{ s.disciplineName || '—' }}</td>
                <td><span class="badge badge--accent" style="display:inline-flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;flex-shrink:0" [style.background]="s.colorHex || 'var(--accent)'"></span>{{ s.beltName || 'No belt' }}</span></td>
                <td class="text-muted">{{ s.enrolledAt | date:'MMM d, y' }}</td>
                <td>
                  <span class="badge" [class.badge--success]="s.isActive" [class.badge--gray]="!s.isActive">
                    {{ s.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ng-container>

    <!-- Loyalty report -->
    <ng-container *ngIf="activeTab() === 'loyalty'">
      <div class="stat-grid stat-grid--3 mb-6">
        <dojo-stat-card icon="star" [value]="loyaltyStats().total"    label="Total Points Awarded"></dojo-stat-card>
        <dojo-stat-card icon="money" [value]="loyaltyStats().redeemed" label="Points Redeemed"></dojo-stat-card>
        <dojo-stat-card icon="users" [value]="loyaltyStats().members"  label="Active Members"></dojo-stat-card>
      </div>
      <div class="card">
        <div class="card__header">
          <span class="card__title">Loyalty Tier Distribution</span>
          <span class="text-muted text-sm">Click a tier to see those families</span>
        </div>
        <div class="card__body">
          <div *ngFor="let tier of tierDistrib()"
            (click)="drillTier(tier.name)"
            [class.drill-row--active]="drillDownTier() === tier.name"
            class="drill-row"
            style="display:flex;align-items:center;gap:12px;margin-bottom:12px;cursor:pointer;padding:4px 6px;border-radius:6px">
            <div style="width:80px;font-size:13px;font-weight:600">{{ tier.name }}</div>
            <div style="flex:1;height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden">
              <div style="height:100%;border-radius:5px" [style.background]="tier.color" [style.width.%]="tier.pct"></div>
            </div>
            <span style="font-size:13px;color:var(--text-muted);width:24px">{{ tier.count }}</span>
          </div>
        </div>
      </div>

      <div class="card mt-4" *ngIf="drillDownTier() as tierName">
        <div class="card__header">
          <span class="card__title">{{ tierName }} families</span>
          <button class="btn btn--ghost btn--sm" (click)="drillDownTier.set(null)">
            <dojo-icon name="close" [size]="13"></dojo-icon> Close
          </button>
        </div>
        <dojo-empty-state *ngIf="tierMembers(tierName).length === 0" icon="users" title="No families in this tier"></dojo-empty-state>
        <table *ngIf="tierMembers(tierName).length > 0">
          <thead><tr><th>Family</th><th style="text-align:right">Points</th><th style="text-align:right">Lifetime</th></tr></thead>
          <tbody>
            <tr *ngFor="let a of tierMembers(tierName)">
              <td><strong>{{ a.parentName || a.parentUid }}</strong></td>
              <td style="text-align:right">{{ a.points }}</td>
              <td style="text-align:right" class="text-muted">{{ a.lifetimePoints }}</td>
            </tr>
          </tbody>
        </table>
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
    .drill-row:hover { background:var(--surface-2); }
    .drill-row--active { background:var(--accent-dim); }
  `]
})
export class ReportsComponent implements OnInit {
  private auth  = inject(AuthService);
  private sts   = inject(StudentService);
  private us    = inject(UserService);
  private as    = inject(AttendanceService);
  private ls    = inject(LoyaltyService);
  private toast = inject(ToastService);

  students$!: Observable<Student[]>;
  coaches$!:  Observable<UserProfile[]>;
  private attendance: AttendanceRecord[] = [];
  private loyaltyAccounts: LoyaltyAccount[] = [];
  private allStudents: Student[] = [];

  activeTab  = signal<ReportTab>('overview');
  dateFrom   = new Date(new Date().setDate(1)).toISOString().split('T')[0];
  dateTo     = new Date().toISOString().split('T')[0];

  stats      = signal({ students: 0, coaches: 0, attendance: 0, loyalty: 0 });
  loyaltyStats = signal({ total: 0, redeemed: 0, members: 0 });

  // Overview-tab drill-down (belt or enrolment month -> matching students)
  drillDown = signal<{ type: 'belt' | 'month'; key: string; title: string; students: Student[] } | null>(null);
  // Attendance-tab drill-down (a single student's underlying records)
  drillStudent = signal<{ student: Student; records: AttendanceRecord[] } | null>(null);
  // Loyalty-tab drill-down (just the selected tier name; membership computed on demand)
  drillDownTier = signal<string | null>(null);

  tabs: { key: ReportTab; icon: IconName; label: string }[] = [
    { key: 'overview'   as ReportTab, icon: 'home',     label: 'Overview' },
    { key: 'attendance' as ReportTab, icon: 'calendar', label: 'Attendance' },
    { key: 'students'   as ReportTab, icon: 'child',    label: 'Students' },
    { key: 'loyalty'    as ReportTab, icon: 'star',     label: 'Loyalty' },
  ];

  ngOnInit() {
    const dojoId = this.auth.currentUser()!.dojoId;
    this.students$ = this.sts.byDojo$(dojoId);
    this.coaches$  = this.us.coaches$(dojoId);

    this.students$.subscribe(s => { this.allStudents = s; this.stats.update(v => ({ ...v, students: s.length })); });
    this.coaches$.subscribe(c => this.stats.update(v => ({ ...v, coaches: c.length })));
    this.as.byDojo$().subscribe({
      next: records => {
        this.attendance = records;
        const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const sessionsThisMonth = new Set(
          records.filter(r => r.date?.startsWith(thisMonth)).map(r => r.sessionId)
        );
        this.stats.update(v => ({ ...v, attendance: sessionsThisMonth.size }));
      },
      error: () => this.toast.error('Could not load attendance data for this report.'),
    });
    this.ls.accounts$().subscribe({
      next: accounts => {
        this.loyaltyAccounts = accounts;
        const total = accounts.reduce((sum, a) => sum + a.lifetimePoints, 0);
        this.loyaltyStats.set({
          total,
          redeemed: accounts.reduce((sum, a) => sum + Math.max(0, a.lifetimePoints - a.points), 0),
          members: accounts.length,
        });
        this.stats.update(v => ({ ...v, loyalty: total }));
      },
      error: () => this.toast.error('Could not load loyalty data for this report.'),
    });
  }

  clearDrillDown(): void {
    this.drillDown.set(null);
    this.drillStudent.set(null);
    this.drillDownTier.set(null);
  }

  beltDistribution(students: Student[]) {
    const map = new Map<string, number>();
    students.forEach(s => {
      const b = s.beltName || 'No belt';
      map.set(b, (map.get(b) ?? 0) + 1);
    });
    const max = Math.max(...map.values(), 1);
    return Array.from(map.entries()).map(([belt, count]) => ({
      belt, count, pct: Math.round(count / max * 100),
      color: belt === 'No belt' ? 'var(--text-dim)' : 'var(--accent)',
    }));
  }

  drillBelt(students: Student[], belt: string): void {
    if (this.drillDown()?.type === 'belt' && this.drillDown()?.key === belt) { this.drillDown.set(null); return; }
    const matches = students.filter(s => (s.beltName || 'No belt') === belt);
    this.drillDown.set({ type: 'belt', key: belt, title: `Students on ${belt}`, students: matches });
  }

  enrolmentByMonth(students: Student[]) {
    const map = new Map<string, number>();
    students.forEach(s => {
      if (!s.enrolledAt) return;
      const d = new Date(s.enrolledAt as any);
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    const max = Math.max(...map.values(), 1);
    return Array.from(map.entries()).slice(-6).map(([month, count]) => ({
      month, count, pct: Math.round(count / max * 100),
    }));
  }

  drillMonth(students: Student[], month: string): void {
    if (this.drillDown()?.type === 'month' && this.drillDown()?.key === month) { this.drillDown.set(null); return; }
    const matches = students.filter(s => {
      if (!s.enrolledAt) return false;
      const key = new Date(s.enrolledAt as any).toLocaleString('default', { month: 'short', year: '2-digit' });
      return key === month;
    });
    this.drillDown.set({ type: 'month', key: month, title: `Enrolled in ${month}`, students: matches });
  }

  // Real per-student attendance stats for the selected date range -- this
  // used to be a table of literal "—" placeholders with no data behind it.
  attendanceSummary(): { student: Student; present: number; late: number; absent: number; rate: number }[] {
    const from = this.dateFrom, to = this.dateTo;
    const inRange = this.attendance.filter(r => r.date && r.date >= from && r.date <= to);
    const byStudent = new Map<string, AttendanceRecord[]>();
    inRange.forEach(r => {
      const list = byStudent.get(String(r.studentId)) ?? [];
      list.push(r);
      byStudent.set(String(r.studentId), list);
    });
    const rows: { student: Student; present: number; late: number; absent: number; rate: number }[] = [];
    for (const [studentId, records] of byStudent.entries()) {
      const student = this.allStudents.find(s => String(s.id) === studentId);
      if (!student) continue;
      const present = records.filter(r => r.status === 'present').length;
      const late    = records.filter(r => r.status === 'late').length;
      const absent  = records.filter(r => r.status === 'absent').length;
      const total   = records.length;
      const rate    = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
      rows.push({ student, present, late, absent, rate });
    }
    return rows.sort((a, b) => b.rate - a.rate);
  }

  isDrilledStudent(student: Student): boolean {
    return this.drillStudent()?.student.id === student.id;
  }

  drillStudentAttendance(row: { student: Student }): void {
    if (this.drillStudent()?.student.id === row.student.id) { this.drillStudent.set(null); return; }
    const from = this.dateFrom, to = this.dateTo;
    const records = this.attendance
      .filter(r => String(r.studentId) === String(row.student.id) && r.date && r.date >= from && r.date <= to)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    this.drillStudent.set({ student: row.student, records });
  }

  tierDistrib() {
    const counts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    this.loyaltyAccounts.forEach(a => { if (a.tier in counts) counts[a.tier]++; });
    const max = Math.max(...Object.values(counts), 1);
    return [
      { name: 'Bronze',   color: '#cd7f32', count: counts.bronze,   pct: Math.round(counts.bronze   / max * 100) },
      { name: 'Silver',   color: '#c0c0c0', count: counts.silver,   pct: Math.round(counts.silver   / max * 100) },
      { name: 'Gold',     color: '#ffd700', count: counts.gold,     pct: Math.round(counts.gold     / max * 100) },
      { name: 'Platinum', color: '#e5e4e2', count: counts.platinum, pct: Math.round(counts.platinum / max * 100) },
    ];
  }

  drillTier(tierName: string): void {
    this.drillDownTier.set(this.drillDownTier() === tierName ? null : tierName);
  }

  tierMembers(tierName: string): LoyaltyAccount[] {
    return this.loyaltyAccounts
      .filter(a => a.tier === tierName.toLowerCase())
      .sort((a, b) => b.points - a.points);
  }

  exportCsv() {
    this.toast.info('CSV export is coming soon — will include all selected report data.');
  }
}
