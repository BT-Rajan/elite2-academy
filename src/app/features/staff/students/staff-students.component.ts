import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService } from '../../../core/services/student.service';
import { BranchService } from '../../../core/services/branch.service';
import { ToastService } from '../../../core/services/toast.service';
import { Student, Branch } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { calcAge } from '../../../core/utils';

@Component({
  selector: 'app-staff-students',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, FormsModule,
            PageHeaderComponent, AvatarComponent, EmptyStateComponent, LoadingComponent, IconComponent],
  template: `
    <dojo-page-header title="Students" subtitle="Roster directory"></dojo-page-header>

    <div class="card mb-4" style="padding:12px 16px">
      <input class="input" [(ngModel)]="search" placeholder="Search by name or discipline…" style="max-width:360px">
    </div>

    <!-- Transfer modal -->
    <div class="confirm-overlay" *ngIf="transferTarget() as t" (click)="cancelTransfer()">
      <div class="confirm-card" (click)="$event.stopPropagation()">
        <div class="confirm-title">Transfer {{ t.firstName }} {{ t.lastName }}</div>
        <div class="confirm-message">Move this student to a different branch. This is logged in their transfer history.</div>
        <div class="form-group">
          <label>Destination branch</label>
          <select class="input" [(ngModel)]="transferBranchId">
            <option [ngValue]="null" disabled>Select a branch…</option>
            <option *ngFor="let b of branches()" [ngValue]="b.id" [disabled]="b.id === t.branchId">
              {{ b.name }}{{ b.id === t.branchId ? ' (current)' : '' }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>Notes <span class="text-muted text-sm">(optional)</span></label>
          <input class="input" [(ngModel)]="transferNotes" placeholder="Reason for transfer…">
        </div>
        <div class="form-error" *ngIf="transferError()">{{ transferError() }}</div>
        <div class="confirm-actions">
          <button class="btn btn--secondary" (click)="cancelTransfer()">Cancel</button>
          <button class="btn btn--primary" [disabled]="transferBusy() || !transferBranchId"
                  (click)="confirmTransfer(t)">
            {{ transferBusy() ? 'Transferring…' : 'Transfer' }}
          </button>
        </div>
      </div>
    </div>

    <ng-container *ngIf="students$ | async as all; else loadingTpl">
      <dojo-empty-state *ngIf="all.length === 0"
        icon="child" title="No students yet" subtitle="Students will appear here once enrolled.">
      </dojo-empty-state>

      <div class="card" *ngIf="all.length > 0">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Age</th>
              <th>Discipline</th>
              <th>Belt</th>
              <th>Branch</th>
              <th>Enrolled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of filtered(all)">
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <dojo-avatar [name]="s.firstName + ' ' + s.lastName" size="sm"></dojo-avatar>
                  <div style="font-weight:600">{{ s.firstName }} {{ s.lastName }}</div>
                </div>
              </td>
              <td>{{ age(s) }}</td>
              <td>{{ s.disciplineName || '—' }}</td>
              <td><span class="badge badge--accent">{{ s.beltName || '—' }}</span></td>
              <td class="text-muted">{{ s.branchName || '—' }}</td>
              <td class="text-muted">{{ s.enrolledAt | date:'MMM y' }}</td>
              <td>
                <button class="btn btn--ghost btn--sm" (click)="startTransfer(s)">
                  <dojo-icon name="refresh" [size]="13"></dojo-icon> Transfer
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-container>
    <ng-template #loadingTpl>
      <dojo-loading label="Loading students…"></dojo-loading>
    </ng-template>
  `,
  styles: [`
    .confirm-overlay {
      position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,.5);
      display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .confirm-card {
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
      max-width: 420px; width: 100%; padding: 24px;
    }
    .confirm-title { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
    .confirm-message { font-size: 13px; line-height: 1.6; color: var(--text-muted); margin-bottom: 16px; }
    .confirm-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
  `],
})
export class StaffStudentsComponent implements OnInit {
  private auth  = inject(AuthService);
  private sts   = inject(StudentService);
  private bs    = inject(BranchService);
  private toast = inject(ToastService);

  students$!: Observable<Student[]>;
  search = '';
  age = (s: Student) => s.dob ? calcAge(new Date(s.dob)) : '—';

  branches = signal<Branch[]>([]);
  transferTarget  = signal<Student | null>(null);
  transferBranchId: string | null = null;
  transferNotes = '';
  transferBusy  = signal(false);
  transferError = signal('');

  ngOnInit() {
    const dojoId = this.auth.currentUser()!.dojoId;
    this.students$ = this.sts.byDojo$(dojoId);
    this.bs.list$().subscribe({
      next: list => this.branches.set(list),
      error: () => {}, // branch directory is a nice-to-have here; don't block the page on it
    });
  }

  filtered(all: Student[]): Student[] {
    const q = this.search.toLowerCase();
    if (!q) return all;
    return all.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.disciplineName?.toLowerCase().includes(q)
    );
  }

  startTransfer(s: Student): void {
    this.transferTarget.set(s);
    this.transferBranchId = null;
    this.transferNotes = '';
    this.transferError.set('');
  }

  cancelTransfer(): void {
    this.transferTarget.set(null);
  }

  async confirmTransfer(s: Student): Promise<void> {
    if (!this.transferBranchId) return;
    this.transferBusy.set(true);
    this.transferError.set('');
    try {
      await this.bs.transferStudent(s.id, this.transferBranchId, undefined, this.transferNotes || undefined);
      this.toast.success(`${s.firstName} transferred.`);
      this.transferTarget.set(null);
      this.students$ = this.sts.byDojo$(this.auth.currentUser()!.dojoId);
    } catch (e: any) {
      this.transferError.set(e.message ?? 'Could not transfer this student.');
    } finally {
      this.transferBusy.set(false);
    }
  }
}
