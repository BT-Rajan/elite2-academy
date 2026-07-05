import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { StudentService } from '../../../core/services/student.service';
import { ClassSession, Student } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-coach-dashboard',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, PageHeaderComponent,
            AvatarComponent, EmptyStateComponent, LoadingComponent, TimeAgoPipe],
  template: `
    <dojo-page-header
      [title]="'Welcome, ' + (auth.currentUser()?.displayName || 'Coach')"
      subtitle="Today's overview">
    </dojo-page-header>

    <div class="form-grid form-grid--2">
      <!-- Recent sessions -->
      <div class="card">
        <div class="card__header">
          <span class="card__title">Recent Sessions</span>
          <a routerLink="/coach/attendance" class="btn btn--primary btn--sm">+ New Session</a>
        </div>
        <div *ngIf="sessions$ | async as sessions; else cardLoading">
          <div *ngIf="sessions.length === 0">
            <dojo-empty-state icon="calendar" title="No sessions yet" subtitle="Start taking attendance to see sessions here."></dojo-empty-state>
          </div>
          <table *ngIf="sessions.length > 0">
            <thead><tr><th>Class</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              <tr *ngFor="let s of sessions" style="cursor:pointer" [routerLink]="['/coach/attendance', s.id]">
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

      <!-- My students quick view -->
      <div class="card">
        <div class="card__header">
          <span class="card__title">My Students</span>
          <a routerLink="/coach/students" class="btn btn--secondary btn--sm">View all</a>
        </div>
        <div *ngIf="students$ | async as students; else cardLoading">
          <dojo-empty-state *ngIf="students.length === 0" icon="child" title="No students assigned" subtitle="Students are assigned by admin."></dojo-empty-state>
          <div *ngFor="let s of students | slice:0:6"
               style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer"
               [routerLink]="['/coach/students', s.id]">
            <dojo-avatar [name]="s.firstName + ' ' + s.lastName" size="sm"></dojo-avatar>
            <div>
              <div style="font-size:13px;font-weight:500">{{ s.firstName }} {{ s.lastName }}</div>
              <div class="text-muted text-sm">{{ s.disciplineName || 'No discipline' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ng-template #cardLoading><dojo-loading></dojo-loading></ng-template>
  `
})
export class CoachDashboardComponent implements OnInit {
  auth      = inject(AuthService);
  private ss = inject(SessionService);
  private sts = inject(StudentService);

  sessions$!: Observable<ClassSession[]>;
  students$!: Observable<Student[]>;

  ngOnInit() {
    const coachUid = this.auth.currentUser()!.uid;
    const dojoId   = this.auth.currentUser()!.dojoId;
    this.sessions$ = this.ss.byCoach$(coachUid);
    this.students$ = this.sts.byDojo$(dojoId);
  }
}
