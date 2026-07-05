import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { combineLatest, map, Observable, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService } from '../../../core/services/student.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { UserService } from '../../../core/services/user.service';
import { LoyaltyService } from '../../../core/services/loyalty.service';
import { Student, AttendanceRecord, UserProfile } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { IconComponent, IconName } from '../../../shared/components/icon/icon.component';

type ReportTab = 'overview' | 'attendance' | 'students' | 'loyalty';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, FormsModule, IconComponent,
            PageHeaderComponent, StatCardComponent, EmptyStateComponent],
  template: `
    <dojo-page-header title="Reports" subtitle="Business analytics and performance metrics">
      <button class="btn btn--secondary" (click)="exportCsv()">⬇ Export CSV</button>
    </dojo-page-header>

    <!-- Tab nav -->
    <div class="tabs mb-6">
      <button *ngFor="let t of tabs" class="tab-btn"
        [class.active]="activeTab() === t.key" (click)="activeTab.set(t.key)">
        <dojo-icon [name]="t.icon" [size]="16"></dojo-icon> {{ t.label }}
      </button>
    </div>

    <!-- Overview -->
    <ng-container *ngIf="activeTab() === 'overview'">
      <div class="stat-grid stat-grid--4 mb-6">
        <dojo-stat-card icon="child" [value]="stats().students"   label="Active Students"></dojo-stat-card>
        <dojo-stat-card icon="users" [value]="stats().coaches"    label="Coaches"></dojo-stat-card>
        <dojo-stat-card icon="calendar" [value]="stats().attendance" label="Sessions this month"></dojo-stat-card>
        <dojo-stat-card icon="star" [value]="stats().loyalty"    label="Points awarded total"></dojo-stat-card>
      </div>

      <!-- Belt distribution -->
      <div class="form-grid form-grid--2">
        <div class="card">
          <div class="card__header"><span class="card__title">Students by Belt</span></div>
          <div class="card__body">
            <div *ngIf="students$ | async as students">
              <dojo-empty-state *ngIf="students.length === 0" icon="belt" title="No data yet"></dojo-empty-state>
              <div *ngFor="let row of beltDistribution(students)"
                style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
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
          <div class="card__header"><span class="card__title">Enrolment Over Time</span></div>
          <div class="card__body">
            <div *ngIf="students$ | async as students">
              <dojo-empty-state *ngIf="students.length === 0" icon="trending" title="No data yet"></dojo-empty-state>
              <div *ngFor="let row of enrolmentByMonth(students)"
                style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
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
        </div>
      </div>

      <div class="card">
        <div class="card__header"><span class="card__title">Attendance Summary</span></div>
        <div *ngIf="students$ | async as students">
          <dojo-empty-state *ngIf="students.length === 0" icon="calendar" title="No data"></dojo-empty-state>
          <table *ngIf="students.length > 0">
            <thead>
              <tr><th>Student</th><th>Belt</th><th style="text-align:center">Present</th>
                  <th style="text-align:center">Late</th><th style="text-align:center">Absent</th>
                  <th style="text-align:right">Rate</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of students">
                <td><strong>{{ s.firstName }} {{ s.lastName }}</strong></td>
                <td><span class="badge badge--accent">{{ s.beltName || '—' }}</span></td>
                <td style="text-align:center;color:var(--success)">—</td>
                <td style="text-align:center;color:var(--warning)">—</td>
                <td style="text-align:center;color:var(--danger)">—</td>
                <td style="text-align:right;font-weight:600">—%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ng-container>

    <!-- Student report -->
    <ng-container *ngIf="activeTab() === 'students'">
      <div class="card">
        <div class="card__header">
          <span class="card__title">All Students</span>
          <span class="text-muted text-sm" *ngIf="students$ | async as s">{{ s.length }} total</span>
        </div>
        <div *ngIf="students$ | async as students">
          <dojo-empty-state *ngIf="students.length === 0" icon="child" title="No students"></dojo-empty-state>
          <table *ngIf="students.length > 0">
            <thead>
              <tr><th>Name</th><th>Discipline</th><th>Belt</th><th>Enrolled</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of students">
                <td><strong>{{ s.firstName }} {{ s.lastName }}</strong></td>
                <td class="text-muted">{{ s.disciplineName || '—' }}</td>
                <td><span class="badge badge--accent">{{ s.beltName || 'No belt' }}</span></td>
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
        <div class="card__header"><span class="card__title">Loyalty Tier Distribution</span></div>
        <div class="card__body">
          <div *ngFor="let tier of tierDistrib()"
            style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:80px;font-size:13px;font-weight:600">{{ tier.name }}</div>
            <div style="flex:1;height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden">
              <div style="height:100%;border-radius:5px" [style.background]="tier.color" [style.width.%]="tier.pct"></div>
            </div>
            <span style="font-size:13px;color:var(--text-muted);width:24px">{{ tier.count }}</span>
          </div>
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
export class ReportsComponent implements OnInit {
  private auth = inject(AuthService);
  private sts  = inject(StudentService);
  private us   = inject(UserService);

  students$!: Observable<Student[]>;
  coaches$!:  Observable<UserProfile[]>;

  activeTab  = signal<ReportTab>('overview');
  dateFrom   = new Date(new Date().setDate(1)).toISOString().split('T')[0];
  dateTo     = new Date().toISOString().split('T')[0];

  stats      = signal({ students: 0, coaches: 0, attendance: 0, loyalty: 0 });
  loyaltyStats = signal({ total: 0, redeemed: 0, members: 0 });

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

    this.students$.subscribe(s => this.stats.update(v => ({ ...v, students: s.length })));
    this.coaches$.subscribe(c => this.stats.update(v => ({ ...v, coaches: c.length })));
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
      color: belt === 'No belt' ? '#64748b' : '#6366f1',
    }));
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

  tierDistrib() {
    return [
      { name: 'Bronze',   color: '#cd7f32', count: 0, pct: 0 },
      { name: 'Silver',   color: '#c0c0c0', count: 0, pct: 0 },
      { name: 'Gold',     color: '#ffd700', count: 0, pct: 0 },
      { name: 'Platinum', color: '#e5e4e2', count: 0, pct: 0 },
    ];
  }

  exportCsv() {
    // Build CSV from students — real impl would fetch all data
    const header = 'Name,Discipline,Belt,Enrolled,Status\n';
    alert('CSV export coming in Phase 7 — will include all selected report data.');
  }
}
