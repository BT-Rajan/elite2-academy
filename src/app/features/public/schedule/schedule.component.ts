import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ScheduleService } from '../../../core/services/schedule.service';
import { DisciplineService } from '../../../core/services/discipline.service';
import { ClassSchedule, Discipline } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'app-public-schedule',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, FormsModule, PageHeaderComponent, EmptyStateComponent, IconComponent],
  template: `
    <!-- Page header -->
    <div class="sched-hero">
      <div class="sched-hero__inner">
        <div class="section-tag">Class Schedule</div>
        <h1 style="font-size:clamp(28px,4vw,44px);font-weight:800;margin:12px 0">
          Find the right class for your child
        </h1>
        <p style="font-size:16px;color:var(--text-muted);max-width:520px;margin:0 auto">
          Classes run weekly. Filter by day or discipline to find what works for you.
        </p>
      </div>
    </div>

    <div class="sched-body">
      <!-- Filters -->
      <div class="sched-filters card mb-6">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:160px">
            <select class="select" [(ngModel)]="filterDay">
              <option value="">All days</option>
              <option *ngFor="let d of days; let i = index" [value]="i">{{ d }}</option>
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:160px">
            <select class="select" [(ngModel)]="filterDisc">
              <option value="">All disciplines</option>
              <option *ngFor="let d of disciplines$ | async" [value]="d.id">{{ d.name }}</option>
            </select>
          </div>
          <button class="btn btn--ghost btn--sm" (click)="filterDay=''; filterDisc=''">
            <dojo-icon name="close" [size]="14"></dojo-icon> Clear filters
          </button>
          <span class="text-muted text-sm" style="margin-left:auto">
            {{ filtered(allClasses()).length }} class(es) shown
          </span>
        </div>
      </div>

      <!-- Week grid view -->
      <div class="week-grid">
        <div *ngFor="let day of days; let i = index" class="week-col"
          [class.hidden]="filterDay !== '' && +filterDay !== i">
          <div class="week-col__header">
            <div class="week-col__day">{{ dayShort[i] }}</div>
            <div class="week-col__full">{{ day }}</div>
          </div>
          <div class="week-col__body">
            <ng-container *ngFor="let c of classesForDay(filtered(allClasses()), i)">
              <div class="class-card" [style.border-left-color]="discColor(c.disciplineId)"
                (click)="selected.set(c)">
                <div class="class-card__time">{{ c.startTime }} – {{ c.endTime }}</div>
                <div class="class-card__name">{{ c.name }}</div>
                <div class="class-card__loc" *ngIf="c.location"><dojo-icon name="pin" [size]="13"></dojo-icon> {{ c.location }}</div>
              </div>
            </ng-container>
            <div *ngIf="classesForDay(filtered(allClasses()), i).length === 0"
              style="padding:16px 12px;font-size:12px;color:var(--text-dim);text-align:center">
              No classes
            </div>
          </div>
        </div>
      </div>

      <!-- List fallback for mobile -->
      <div class="class-list-mobile">
        <ng-container *ngIf="filtered(allClasses()).length === 0">
          <dojo-empty-state icon="calendar" title="No classes found" subtitle="Try adjusting your filters."></dojo-empty-state>
        </ng-container>
        <div *ngFor="let c of filtered(allClasses())" class="class-list-item"
          [style.border-left-color]="discColor(c.disciplineId)" (click)="selected.set(c)">
          <div style="display:flex;align-items:center;gap:12px">
            <div>
              <div style="font-weight:600;font-size:14px">{{ c.name }}</div>
              <div style="font-size:13px;color:var(--text-muted)">
                {{ days[c.dayOfWeek] }} · {{ c.startTime }}–{{ c.endTime }}
                <span *ngIf="c.location"> · <dojo-icon name="pin" [size]="13"></dojo-icon> {{ c.location }}</span>
              </div>
            </div>
            <a routerLink="/auth/signup" class="btn btn--primary btn--sm" style="margin-left:auto"
              (click)="$event.stopPropagation()">
              Book →
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Class detail modal overlay -->
    <div class="modal-overlay" *ngIf="selected()" (click)="selected.set(null)">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
          <div>
            <div style="font-size:20px;font-weight:700">{{ selected()!.name }}</div>
            <div style="font-size:14px;color:var(--text-muted);margin-top:4px">
              {{ days[selected()!.dayOfWeek] }} · {{ selected()!.startTime }} – {{ selected()!.endTime }}
            </div>
          </div>
          <button class="btn btn--ghost btn--sm" (click)="selected.set(null)"><dojo-icon name="close" [size]="14"></dojo-icon></button>
        </div>
        <div class="form-grid form-grid--2" style="gap:12px;margin-bottom:20px">
          <div>
            <div class="text-muted text-sm mb-1">Discipline</div>
            <div style="font-weight:600">{{ discName(selected()!.disciplineId) }}</div>
          </div>
          <div *ngIf="selected()!.location">
            <div class="text-muted text-sm mb-1">Location</div>
            <div style="font-weight:600">{{ selected()!.location }}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <a routerLink="/auth/signup" class="btn btn--primary btn--full">
            <dojo-icon name="belt" [size]="14"></dojo-icon> Enrol now — it's free
          </a>
        </div>
        <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:10px">
          Already enrolled? <a routerLink="/auth/login">Sign in →</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sched-hero { background:radial-gradient(ellipse at center top,rgba(99,102,241,.1) 0%,transparent 60%);
                  padding:60px 24px 40px; text-align:center;
      &__inner { max-width:680px; margin:0 auto; } }
    .sched-body { max-width:1200px; margin:0 auto; padding:0 24px 80px; }

    /* Week grid */
    .week-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; }
    .week-col { min-width:0;
      &.hidden { display:none; }
      &__header { text-align:center; padding:8px 4px; background:var(--surface);
                  border:1px solid var(--border); border-radius:8px 8px 0 0;
                  border-bottom:2px solid var(--accent); }
      &__day    { font-size:11px; font-weight:700; text-transform:uppercase;
                  letter-spacing:.06em; color:var(--text-muted); }
      &__full   { font-size:11px; color:var(--text-dim); margin-top:2px; }
      &__body   { background:var(--surface); border:1px solid var(--border);
                  border-top:none; border-radius:0 0 8px 8px; min-height:120px; }
    }
    .class-card { padding:10px 10px; border-left:3px solid var(--accent);
                  margin:6px; border-radius:6px; background:var(--surface-2);
                  cursor:pointer; transition:filter .15s;
                  &:hover { filter:brightness(1.15); }
      &__time { font-size:10px; font-family:var(--font-mono); color:var(--text-muted); }
      &__name { font-size:12px; font-weight:600; margin-top:2px; }
      &__loc  { font-size:10px; color:var(--text-dim); margin-top:2px; }
    }

    /* List view for mobile */
    .class-list-mobile { display:none; flex-direction:column; gap:8px; }
    .class-list-item   { background:var(--surface); border:1px solid var(--border);
                         border-left:4px solid var(--accent); border-radius:10px;
                         padding:14px 16px; cursor:pointer; transition:background .15s;
                         &:hover { background:var(--surface-2); } }

    /* Modal */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6);
                     display:flex; align-items:center; justify-content:center;
                     z-index:1000; padding:24px; }
    .modal-box     { background:var(--surface); border:1px solid var(--border);
                     border-radius:16px; padding:28px; width:100%; max-width:480px;
                     box-shadow:0 20px 60px rgba(0,0,0,.5); }

    .sched-filters { padding:16px 20px !important; }

    @media (max-width: 768px) {
      .week-grid         { display:none; }
      .class-list-mobile { display:flex; }
    }
  `]
})
export class PublicScheduleComponent implements OnInit {
  private ss  = inject(ScheduleService);
  private ds  = inject(DisciplineService);
  private route = inject(ActivatedRoute);

  disciplines$!: Observable<Discipline[]>;

  allClasses  = signal<ClassSchedule[]>([]);
  selected    = signal<ClassSchedule | null>(null);
  filterDay   = '';
  filterDisc  = '';
  days        = DAYS;
  dayShort    = DAY_SHORT;

  private discColors = new Map<string, string>();
  private discNames  = new Map<string, string>();

  ngOnInit() {
    // Use dojoId from query param or a default; real impl reads from route/env
    const dojoId = this.route.snapshot.queryParamMap.get('dojo') ?? 'default';
    this.ss.public$(dojoId).subscribe(c => this.allClasses.set(c));
    this.disciplines$ = this.ds.byDojo$(dojoId);
    this.disciplines$.subscribe(discs => {
      discs.forEach(d => { this.discColors.set(d.id, d.color); this.discNames.set(d.id, d.name); });
    });
  }

  classesForDay(classes: ClassSchedule[], day: number): ClassSchedule[] {
    return classes.filter(c => c.dayOfWeek === day);
  }

  filtered(classes: ClassSchedule[]): ClassSchedule[] {
    return classes.filter(c => {
      const dayOk  = this.filterDay  === '' || c.dayOfWeek === +this.filterDay;
      const discOk = this.filterDisc === '' || c.disciplineId === this.filterDisc;
      return dayOk && discOk;
    });
  }

  discColor(discId: string): string {
    return this.discColors.get(discId) ?? 'var(--accent)';
  }

  discName(discId: string): string {
    return this.discNames.get(discId) ?? 'General';
  }
}
