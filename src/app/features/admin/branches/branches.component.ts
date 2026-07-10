import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { BranchService } from '../../../core/services/branch.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { Branch, Student, UserProfile } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [CommonModule, AsyncPipe, FormsModule, RouterLink,
            PageHeaderComponent, EmptyStateComponent, LoadingComponent, IconComponent, BadgeComponent, AvatarComponent],
  template: `
    <dojo-page-header title="Branches" subtitle="Manage your dojo's physical locations.">
      <button class="btn btn--primary" *ngIf="canManage()" (click)="startAdd()">
        <dojo-icon name="home" [size]="14"></dojo-icon> Add Branch
      </button>
    </dojo-page-header>

    <!-- Add / edit form -->
    <div class="card mb-4" *ngIf="formOpen() && canManage()">
      <div class="card__header">
        <span class="card__title">{{ editingId() ? 'Edit Branch' : 'New Branch' }}</span>
      </div>
      <div class="card__body">
        <div class="form-grid form-grid--2">
          <div class="form-group">
            <label>Name</label>
            <input class="input" [(ngModel)]="form.name" placeholder="e.g. Downtown, Riverside">
          </div>
          <div class="form-group">
            <label>Code <span class="text-muted text-sm">(optional, e.g. DTN)</span></label>
            <input class="input" [(ngModel)]="form.code" maxlength="20">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Address</label>
            <input class="input" [(ngModel)]="form.address" placeholder="Street, city">
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input class="input" [(ngModel)]="form.phone">
          </div>
        </div>
        <div class="form-error" *ngIf="formError()">{{ formError() }}</div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn--primary" (click)="save()" [disabled]="saving()">
            {{ saving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Create branch') }}
          </button>
          <button class="btn btn--secondary" (click)="cancelForm()">Cancel</button>
        </div>
      </div>
    </div>

    <ng-container *ngIf="branches$ | async as branches; else loadingTpl">
      <dojo-empty-state *ngIf="branches.length === 0"
        icon="home" title="No branches yet"
        subtitle="Every dojo needs at least one branch before students, classes, or sessions can be created.">
      </dojo-empty-state>

      <div class="form-grid form-grid--2" *ngIf="branches.length > 0">
        <div class="card" *ngFor="let b of branches">
          <div class="card__body" style="cursor:pointer" (click)="toggleExpand(b)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <div style="font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px">
                  <dojo-icon name="home" [size]="16"></dojo-icon> {{ b.name }}
                  <dojo-badge variant="info" *ngIf="b.code">{{ b.code }}</dojo-badge>
                </div>
                <div class="text-muted text-sm" style="margin-top:6px" *ngIf="b.address">{{ b.address }}</div>
                <div class="text-muted text-sm" *ngIf="b.phone">{{ b.phone }}</div>
              </div>
              <span class="text-muted" style="font-size:11px">{{ expandedId() === b.id ? '▴ less' : '▾ more' }}</span>
            </div>
            <div style="display:flex;gap:8px;margin-top:16px" *ngIf="canManage(); else readOnlyNote" (click)="$event.stopPropagation()">
              <button class="btn btn--secondary btn--sm" (click)="startEdit(b)">
                <dojo-icon name="edit" [size]="13"></dojo-icon> Edit
              </button>
              <button class="btn btn--secondary btn--sm" (click)="deactivate(b)" [disabled]="busy() === b.id">
                <dojo-icon name="trash" [size]="13"></dojo-icon> Deactivate
              </button>
            </div>
            <ng-template #readOnlyNote>
              <div class="text-muted text-sm" style="margin-top:16px">
                <dojo-icon name="users" [size]="13"></dojo-icon> {{ b.coachCount ?? 0 }} staff assigned here — click for details
              </div>
            </ng-template>
          </div>

          <!-- Drill-down: this branch's staff and student roster -->
          <div *ngIf="expandedId() === b.id" style="border-top:1px solid var(--border)" (click)="$event.stopPropagation()">
            <div style="padding:12px 16px">
              <div class="text-muted text-sm" style="font-weight:600;margin-bottom:8px">Staff at this branch</div>
              <div *ngIf="expandedCoaches() as coaches; else loadingExpand">
                <div *ngIf="coaches.length === 0" class="text-muted text-sm">No one assigned yet.</div>
                <div *ngFor="let c of coaches" style="display:flex;align-items:center;gap:8px;padding:4px 0">
                  <dojo-avatar [name]="c.displayName" size="sm"></dojo-avatar>
                  <span style="font-size:13px">{{ c.displayName }}</span>
                  <dojo-badge variant="gray">{{ c.role }}</dojo-badge>
                </div>
              </div>
              <ng-template #loadingExpand><div class="text-muted text-sm">Loading…</div></ng-template>
            </div>
            <div style="padding:12px 16px;border-top:1px solid var(--border)">
              <div class="text-muted text-sm" style="font-weight:600;margin-bottom:8px">Students at this branch</div>
              <div *ngIf="expandedStudents() as students; else loadingExpand">
                <dojo-empty-state *ngIf="students.length === 0" icon="child" title="No students yet" subtitle=""></dojo-empty-state>
                <a *ngFor="let s of students | slice:0:8" [routerLink]="['/admin/students', s.id]"
                   style="display:flex;align-items:center;gap:8px;padding:4px 0;color:var(--text);text-decoration:none">
                  <dojo-avatar [name]="s.firstName + ' ' + s.lastName" size="sm"></dojo-avatar>
                  <span style="font-size:13px">{{ s.firstName }} {{ s.lastName }}</span>
                  <span class="text-muted text-sm">{{ s.beltName || 'No belt' }}</span>
                </a>
                <div class="text-muted text-sm" *ngIf="students.length > 8" style="margin-top:6px">
                  + {{ students.length - 8 }} more
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ng-container>
    <ng-template #loadingTpl>
      <dojo-loading label="Loading branches…"></dojo-loading>
    </ng-template>
  `,
})
export class BranchesComponent implements OnInit {
  private bs      = inject(BranchService);
  private auth    = inject(AuthService);
  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);

  // Mirrors AuthMiddleware::requireHeadCoach on the backend -- admins and
  // Head Coaches can manage branches, everyone else gets a read-only view.
  canManage = (): boolean => {
    const user = this.auth.currentUser();
    return user?.role === 'admin' || !!user?.isHeadCoach;
  };

  branches$!: Observable<Branch[]>;
  formOpen   = signal(false);
  editingId  = signal<string | null>(null);
  saving     = signal(false);
  formError  = signal('');

  expandedId       = signal<string | null>(null);
  expandedCoaches  = signal<UserProfile[] | null>(null);
  expandedStudents = signal<Student[] | null>(null);

  toggleExpand(b: Branch): void {
    if (this.expandedId() === b.id) { this.expandedId.set(null); return; }
    this.expandedId.set(b.id);
    this.expandedCoaches.set(null);
    this.expandedStudents.set(null);
    this.bs.coaches$(b.id).subscribe({
      next: c => this.expandedCoaches.set(c),
      error: () => { this.expandedCoaches.set([]); this.toast.error('Could not load staff for this branch.'); },
    });
    this.bs.students$(b.id).subscribe({
      next: s => this.expandedStudents.set(s),
      error: () => { this.expandedStudents.set([]); this.toast.error('Could not load students for this branch.'); },
    });
  }
  busy       = signal<string | null>(null);

  form = { name: '', code: '', address: '', phone: '' };

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.branches$ = this.bs.list$();
  }

  startAdd(): void {
    this.editingId.set(null);
    this.form = { name: '', code: '', address: '', phone: '' };
    this.formError.set('');
    this.formOpen.set(true);
  }

  startEdit(b: Branch): void {
    this.editingId.set(b.id);
    this.form = { name: b.name, code: b.code ?? '', address: b.address ?? '', phone: b.phone ?? '' };
    this.formError.set('');
    this.formOpen.set(true);
  }

  cancelForm(): void {
    this.formOpen.set(false);
  }

  async save(): Promise<void> {
    if (!this.form.name.trim()) {
      this.formError.set('Name is required.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    try {
      const id = this.editingId();
      if (id) {
        await this.bs.update(id, this.form);
        this.toast.success('Branch updated.');
      } else {
        await this.bs.create(this.form);
        this.toast.success('Branch created.');
      }
      this.formOpen.set(false);
      this.load();
    } catch (e: any) {
      this.formError.set(e.message ?? 'Could not save branch.');
    } finally {
      this.saving.set(false);
    }
  }

  async deactivate(b: Branch): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Deactivate this branch?',
      message: `"${b.name}" will be hidden from the branch list. You'll need to move out any students, coaches, ` +
               `or staff still assigned there first — the server will tell you if any remain.`,
      confirmLabel: 'Deactivate', danger: true,
    });
    if (!ok) return;

    this.busy.set(b.id);
    try {
      await this.bs.deactivate(b.id);
      this.toast.success(`${b.name} deactivated.`);
      this.load();
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not deactivate this branch.');
    } finally {
      this.busy.set(null);
    }
  }
}
