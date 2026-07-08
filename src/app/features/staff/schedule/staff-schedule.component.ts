import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ScheduleService } from '../../../core/services/schedule.service';
import { ClassSchedule } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

@Component({
  selector: 'app-staff-schedule',
  standalone: true,
  imports: [CommonModule, AsyncPipe, PageHeaderComponent, EmptyStateComponent],
  template: `
    <dojo-page-header title="Class Schedule" subtitle="Weekly recurring classes"></dojo-page-header>

    <div *ngIf="schedules$ | async as schedules">
      <dojo-empty-state *ngIf="schedules.length === 0"
        icon="calendar" title="No classes scheduled" subtitle="">
      </dojo-empty-state>

      <div class="card mb-4" *ngFor="let day of DAY_NAMES; let i = index">
        <div class="card__header"><span class="card__title">{{ day }}</span></div>
        <div *ngIf="byDay(schedules, i).length === 0" class="text-muted" style="padding:12px 20px;font-size:13px">
          No classes
        </div>
        <table *ngIf="byDay(schedules, i).length > 0">
          <thead><tr><th>Class</th><th>Discipline</th><th>Time</th><th>Location</th><th>Status</th></tr></thead>
          <tbody>
            <tr *ngFor="let s of byDay(schedules, i)">
              <td>{{ s.name }}</td>
              <td>
                <span style="display:inline-flex;align-items:center;gap:6px">
                  <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0" [style.background]="s.disciplineColor || 'var(--accent)'"></span>
                  {{ s.disciplineName || 'General' }}
                </span>
              </td>
              <td class="text-muted">{{ s.startTime }} – {{ s.endTime }}</td>
              <td class="text-muted">{{ s.location }}</td>
              <td><span class="badge" [class]="s.isActive ? 'badge--success' : 'badge--gray'">
                {{ s.isActive ? 'Active' : 'Inactive' }}
              </span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class StaffScheduleComponent implements OnInit {
  private auth = inject(AuthService);
  private sc   = inject(ScheduleService);

  schedules$!: Observable<ClassSchedule[]>;
  DAY_NAMES = DAY_NAMES;

  ngOnInit() {
    this.schedules$ = this.sc.byDojo$(this.auth.currentUser()!.dojoId);
  }

  byDay(schedules: ClassSchedule[], day: number): ClassSchedule[] {
    return schedules.filter(s => s.dayOfWeek === day);
  }
}
