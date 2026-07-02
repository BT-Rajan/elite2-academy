import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ScheduleService } from '../../../core/services/schedule.service';
import { StudentService } from '../../../core/services/student.service';
import { SessionService } from '../../../core/services/session.service';
import { ClassSchedule, Student, ClassSession } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, PageHeaderComponent, EmptyStateComponent],
  template: `
    <dojo-page-header
      [title]="'Welcome, ' + (auth.currentUser()?.displayName || 'Staff')"
      subtitle="Front desk overview">
    </dojo-page-header>

    <div class="form-grid form-grid--3 mb-4">
      <div class="card" style="padding:20px">
        <div class="text-muted text-sm mb-1">Students on roster</div>
        <div style="font-size:28px;font-weight:700">{{ (students$ | async)?.length ?? 0 }}</div>
      </div>
      <div class="card" style="padding:20px">
        <div class="text-muted text-sm mb-1">Classes today</div>
        <div style="font-size:28px;font-weight:700">{{ todaysClasses(schedules$ | async).length }}</div>
      </div>
      <div class="card" style="padding:20px">
        <div class="text-muted text-sm mb-1">Recent sessions</div>
        <div style="font-size:28px;font-weight:700">{{ (sessions$ | async)?.length ?? 0 }}</div>
      </div>
    </div>

    <div class="form-grid form-grid--2">
      <!-- Today's schedule -->
      <div class="card">
        <div class="card__header">
          <span class="card__title">Today's Schedule</span>
          <a routerLink="/staff/schedule" class="btn btn--secondary btn--sm">View all</a>
        </div>
        <div *ngIf="schedules$ | async as schedules">
          <dojo-empty-state *ngIf="todaysClasses(schedules).length === 0"
            icon="📅" title="No classes today" subtitle="Check back on a class day.">
          </dojo-empty-state>
          <table *ngIf="todaysClasses(schedules).length > 0">
            <thead><tr><th>Class</th><th>Time</th><th>Location</th></tr></thead>
            <tbody>
              <tr *ngFor="let s of todaysClasses(schedules)">
                <td>{{ s.name }}</td>
                <td class="text-muted">{{ s.startTime }} – {{ s.endTime }}</td>
                <td class="text-muted">{{ s.location }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recent sessions -->
      <div class="card">
        <div class="card__header"><span class="card__title">Recent Sessions</span></div>
        <div *ngIf="sessions$ | async as sessions">
          <dojo-empty-state *ngIf="sessions.length === 0"
            icon="🥋" title="No sessions logged yet" subtitle="">
          </dojo-empty-state>
          <table *ngIf="sessions.length > 0">
            <thead><tr><th>Class</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              <tr *ngFor="let s of sessions | slice:0:6">
                <td>{{ s.className }}</td>
                <td class="text-muted">{{ s.date | date:'MMM d' }}</td>
                <td><span class="badge" [class]="s.isClosed ? 'badge--gray' : 'badge--success'">
                  {{ s.isClosed ? 'Closed' : 'Open' }}
                </span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class StaffDashboardComponent implements OnInit {
  auth        = inject(AuthService);
  private sc  = inject(ScheduleService);
  private sts = inject(StudentService);
  private ss  = inject(SessionService);

  students$!:  Observable<Student[]>;
  schedules$!: Observable<ClassSchedule[]>;
  sessions$!:  Observable<ClassSession[]>;

  ngOnInit() {
    const dojoId = this.auth.currentUser()!.dojoId;
    this.students$  = this.sts.byDojo$(dojoId);
    this.schedules$ = this.sc.byDojo$(dojoId);
    this.sessions$  = this.ss.byDojo$(dojoId);
  }

  todaysClasses(schedules: ClassSchedule[] | null): ClassSchedule[] {
    if (!schedules) return [];
    const today = new Date().getDay();
    return schedules.filter(s => s.dayOfWeek === today && s.isActive);
  }
}
