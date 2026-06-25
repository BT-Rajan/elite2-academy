import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, map, combineLatest, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService } from '../../../core/services/student.service';
import { Student } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { calcAge } from '../../../core/utils';

@Component({
  selector: 'app-student-list',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, FormsModule,
            PageHeaderComponent, AvatarComponent, EmptyStateComponent],
  template: `
    <dojo-page-header title="My Students" subtitle="All students in your dojo"></dojo-page-header>

    <div class="card mb-4" style="padding:12px 16px">
      <input class="input" [(ngModel)]="search" placeholder="🔍  Search by name or discipline…" style="max-width:360px">
    </div>

    <div *ngIf="students$ | async as all">
      <dojo-empty-state *ngIf="all.length === 0"
        icon="🧒" title="No students yet" subtitle="Students will appear here once enrolled.">
      </dojo-empty-state>

      <div class="card" *ngIf="all.length > 0">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Age</th>
              <th>Discipline</th>
              <th>Belt</th>
              <th>Enrolled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of filtered(all)" style="cursor:pointer">
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <dojo-avatar [name]="s.firstName + ' ' + s.lastName" size="sm"></dojo-avatar>
                  <div>
                    <div style="font-weight:600">{{ s.firstName }} {{ s.lastName }}</div>
                  </div>
                </div>
              </td>
              <td>{{ age(s) }}</td>
              <td>{{ s.disciplineId }}</td>
              <td>
                <span class="badge badge--accent">{{ s.currentBeltId || '—' }}</span>
              </td>
              <td class="text-muted">{{ s.enrolledAt | date:'MMM y' }}</td>
              <td>
                <a [routerLink]="['/coach/students', s.id]" class="btn btn--ghost btn--sm">View →</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class StudentListComponent implements OnInit {
  private auth = inject(AuthService);
  private sts  = inject(StudentService);

  students$!: Observable<Student[]>;
  search = '';
  age = (s: Student) => s.dob ? calcAge(new Date(s.dob)) : '—';

  ngOnInit() {
    this.students$ = this.sts.byDojo$(this.auth.currentUser()!.dojoId);
  }

  filtered(all: Student[]): Student[] {
    const q = this.search.toLowerCase();
    if (!q) return all;
    return all.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.disciplineId?.toLowerCase().includes(q)
    );
  }
}
