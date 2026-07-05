import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService } from '../../../core/services/student.service';
import { LoyaltyService } from '../../../core/services/loyalty.service';
import { Student, LoyaltyAccount } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LOYALTY_TIER_COLORS } from '../../../core/utils';

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, TitleCasePipe,
            PageHeaderComponent, AvatarComponent, EmptyStateComponent, LoadingComponent, IconComponent],
  template: `
    <dojo-page-header
      [title]="greeting"
      subtitle="Your child's progress at a glance">
    </dojo-page-header>

    <ng-container *ngIf="students$ | async as students; else loadingChildren">
      <dojo-empty-state *ngIf="students.length === 0"
        icon="child" title="No children linked yet"
        subtitle="Contact your dojo admin to link your child's profile.">
      </dojo-empty-state>

      <div class="form-grid form-grid--2 mb-6" *ngIf="students.length > 0">
        <div *ngFor="let s of students" class="card"
             style="cursor:pointer" [routerLink]="['/parent/progress', s.id]">
          <div class="card__body" style="display:flex;align-items:center;gap:16px">
            <dojo-avatar [name]="s.firstName + ' ' + s.lastName" size="lg"></dojo-avatar>
            <div>
              <div style="font-size:16px;font-weight:700">{{ s.firstName }} {{ s.lastName }}</div>
              <div class="text-muted text-sm" style="margin-top:4px">{{ s.disciplineName || 'No discipline' }}</div>
              <div class="badge badge--accent" style="margin-top:8px">Belt: {{ s.beltName || 'No belt' }}</div>
            </div>
          </div>
        </div>
      </div>
    </ng-container>
    <ng-template #loadingChildren><dojo-loading label="Loading your children…"></dojo-loading></ng-template>

    <ng-container *ngIf="loyalty$ | async as loyalty">
      <div class="card mb-4" *ngIf="loyalty">
        <div class="card__body" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:28px;font-weight:700;color:var(--accent)">{{ loyalty.points }} pts</div>
            <div class="text-muted">Loyalty balance</div>
          </div>
          <div>
            <div class="badge" [style.background]="tierColor(loyalty.tier)" style="font-size:13px;padding:4px 12px">
              <dojo-icon name="star" [size]="14"></dojo-icon> {{ loyalty.tier | titlecase }} Member
            </div>
            <div class="text-muted text-sm" style="margin-top:6px">{{ loyalty.lifetimePoints }} lifetime points</div>
          </div>
          <a routerLink="/parent/loyalty" class="btn btn--primary btn--sm">View rewards →</a>
        </div>
      </div>
    </ng-container>
  `
})
export class ParentDashboardComponent implements OnInit {
  auth       = inject(AuthService);
  private ss = inject(StudentService);
  private ls = inject(LoyaltyService);

  students$!: Observable<Student[]>;
  loyalty$!:  Observable<LoyaltyAccount | undefined>;
  greeting    = 'Hello!';

  tierColor = (t: string) => LOYALTY_TIER_COLORS[t] ?? '#888';

  ngOnInit() {
    const user = this.auth.currentUser();
    if (!user) return;
    const firstName = user.displayName?.split(' ')[0] ?? 'there';
    this.greeting   = `Hello, ${firstName}!`;
    this.students$ = this.ss.byParent$(user.uid);
    this.loyalty$  = this.ls.account$(user.uid);
  }
}
