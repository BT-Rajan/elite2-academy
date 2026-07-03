import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService } from '../../../core/services/student.service';
import { UserService } from '../../../core/services/user.service';
import { SessionService } from '../../../core/services/session.service';
import { Student, UserProfile, ClassSession } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, RouterLink,
            PageHeaderComponent, StatCardComponent, AvatarComponent, EmptyStateComponent],
  template: `
    <dojo-page-header
      [title]="greeting()"
      subtitle="Business overview">
    </dojo-page-header>

    <!-- Stats — every card goes somewhere or does something -->
    <div class="stat-grid stat-grid--4 mb-6">
      <dojo-stat-card icon="🧒" [value]="stats().students" label="Active Students" link="/admin/students"></dojo-stat-card>
      <dojo-stat-card icon="👥" [value]="stats().coaches"  label="Coaches" link="/admin/staff"></dojo-stat-card>
      <dojo-stat-card icon="📅" [value]="stats().sessions" label="Open Sessions" link="/coach/attendance"></dojo-stat-card>
      <dojo-stat-card icon="🆔" [value]="dojoId()" label="Dojo ID" sub="Click to copy — share with new members" [copy]="true"></dojo-stat-card>
    </div>

    <div class="form-grid form-grid--2">
      <!-- Recent students -->
      <div class="card">
        <div class="card__header">
          <span class="card__title">Recent Students</span>
          <a routerLink="/admin/students" class="btn btn--ghost btn--sm">View all</a>
        </div>
        <div *ngIf="students$ | async as students">
          <dojo-empty-state *ngIf="students.length === 0"
            icon="🧒" title="No students yet" subtitle="Parents enrol children after signing up.">
          </dojo-empty-state>
          <a *ngFor="let s of students | slice:0:5" [routerLink]="['/admin/students', s.id]" class="row-link">
            <dojo-avatar [name]="s.firstName + ' ' + s.lastName" size="sm"></dojo-avatar>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600">{{ s.firstName }} {{ s.lastName }}</div>
              <div class="text-muted text-sm">{{ s.disciplineName || 'No discipline' }}</div>
            </div>
            <span class="badge badge--accent" style="font-size:11px">{{ s.beltName || 'No belt' }}</span>
          </a>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="card">
        <div class="card__header"><span class="card__title">Quick Actions</span></div>
        <div class="card__body" style="display:flex;flex-direction:column;gap:8px">
          <a routerLink="/admin/students"    class="btn btn--secondary btn--full" style="justify-content:flex-start">
            🧒 &nbsp; View All Students
          </a>
          <a routerLink="/admin/staff"       class="btn btn--secondary btn--full" style="justify-content:flex-start">
            👥 &nbsp; Manage Staff & Parents
          </a>
          <a routerLink="/admin/disciplines" class="btn btn--secondary btn--full" style="justify-content:flex-start">
            🥋 &nbsp; Disciplines & Belts
          </a>
          <a routerLink="/admin/reports"     class="btn btn--secondary btn--full" style="justify-content:flex-start">
            📊 &nbsp; Reports & Analytics
          </a>
          <a routerLink="/admin/settings"    class="btn btn--secondary btn--full" style="justify-content:flex-start">
            ⚙ &nbsp; Platform Settings
          </a>
          <a routerLink="/coach/dashboard"   class="btn btn--secondary btn--full" style="justify-content:flex-start">
            🔄 &nbsp; Switch to Coach View
          </a>
        </div>
      </div>

      <!-- Recent sessions -->
      <div class="card">
        <div class="card__header">
          <span class="card__title">Recent Sessions</span>
          <a routerLink="/coach/attendance" class="btn btn--primary btn--sm">+ New</a>
        </div>
        <div *ngIf="sessions$ | async as sessions">
          <dojo-empty-state *ngIf="sessions.length === 0"
            icon="📅" title="No sessions" subtitle="Sessions appear here as coaches take attendance.">
          </dojo-empty-state>
          <table *ngIf="sessions.length > 0">
            <thead><tr><th>Class</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let s of sessions | slice:0:5" class="clickable-row"
                [routerLink]="['/coach/attendance']" [queryParams]="{ sessionId: s.id }">
                <td><strong>{{ s.className }}</strong></td>
                <td class="text-muted">{{ s.date | date:'MMM d' }}</td>
                <td>
                  <span class="badge" [class]="s.isClosed ? 'badge--gray' : 'badge--success'">
                    {{ s.isClosed ? 'Closed' : 'Open' }}
                  </span>
                </td>
                <td class="text-muted" style="text-align:right">View →</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Getting started checklist -->
      <div class="card">
        <div class="card__header"><span class="card__title">Setup Checklist</span></div>
        <div class="card__body" style="padding:0">
          <ng-container *ngFor="let step of setupSteps">
            <a *ngIf="!step.done" [routerLink]="step.link" class="row-link">
              <ng-container *ngTemplateOutlet="stepBody; context: { step: step }"></ng-container>
              <span class="text-muted text-sm">Go →</span>
            </a>
            <div *ngIf="step.done" class="row-link row-link--static">
              <ng-container *ngTemplateOutlet="stepBody; context: { step: step }"></ng-container>
            </div>
          </ng-container>
        </div>
      </div>

      <ng-template #stepBody let-step="step">
        <div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0"
          [style.background]="step.done ? 'var(--success)' : 'var(--surface-2)'"
          [style.color]="step.done ? '#fff' : 'var(--text-muted)'">
          {{ step.done ? '✓' : step.num }}
        </div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500"
            [style.text-decoration]="step.done ? 'line-through' : 'none'"
            [style.color]="step.done ? 'var(--text-muted)' : 'var(--text)'">
            {{ step.label }}
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .row-link {
      display:flex; align-items:center; gap:12px; padding:10px 16px;
      border-bottom:1px solid var(--border); text-decoration:none; color:inherit;
      transition:background .1s;
      &:hover  { background:var(--surface-2); }
      &:last-child { border-bottom:none; }
    }
    .row-link--static { cursor:default; &:hover { background:none; } }
    .clickable-row { cursor:pointer; transition:background .1s; }
    .clickable-row:hover { background:var(--surface-2); }
  `]
})
export class AdminDashboardComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  auth = inject(AuthService);
  private sts  = inject(StudentService);
  private us   = inject(UserService);
  private ss   = inject(SessionService);

  students$!: Observable<Student[]>;
  coaches$!:  Observable<UserProfile[]>;
  sessions$!: Observable<ClassSession[]>;

  stats  = signal({ students: 0, coaches: 0, sessions: 0 });
  dojoId  = () => this.auth.currentUser()?.dojoId ?? '—';
  greeting = () => 'Welcome, ' + (this.auth.currentUser()?.displayName?.split(' ')[0] ?? 'Admin');

  setupSteps = [
    { num: '1', label: 'Add disciplines and belt levels', link: '/admin/disciplines', done: false },
    { num: '2', label: 'Invite coaches to the platform',  link: '/admin/staff',       done: false },
    { num: '3', label: 'Configure loyalty rewards',       link: '/admin/settings',    done: false },
    { num: '4', label: 'Share Dojo ID with parents',      link: '/admin/settings',    done: false },
    { num: '5', label: 'Take first attendance session',   link: '/coach/attendance',  done: false },
  ];

  ngOnInit() {
    const dojoId = this.auth.currentUser()!.dojoId;
    this.students$ = this.sts.byDojo$(dojoId);
    this.coaches$  = this.us.coaches$(dojoId);
    this.sessions$ = this.ss.byDojo$(dojoId);

    this.students$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(s => {
      this.stats.update(v => ({ ...v, students: s.length }));
      this.setupSteps[3].done = s.length > 0;
    });
    this.coaches$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(c => {
      this.stats.update(v => ({ ...v, coaches: c.length }));
      this.setupSteps[1].done = c.length > 0;
    });
    this.sessions$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(s => {
      this.stats.update(v => ({ ...v, sessions: s.filter(x => !x.isClosed).length }));
      this.setupSteps[4].done = s.length > 0;
    });
  }
}
