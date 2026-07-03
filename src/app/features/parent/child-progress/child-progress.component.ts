import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Observable, switchMap, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService } from '../../../core/services/student.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { BeltService } from '../../../core/services/belt.service';
import { EvaluationService } from '../../../core/services/evaluation.service';
import { Student, SessionComment, AttendanceRecord, BeltHistory, StudentObjective, Belt, PromotionReadiness } from '../../../core/models';
import { SKILL_KEYS, SKILL_LABELS, calcAge } from '../../../core/utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { SkillBarComponent } from '../../../shared/components/skill-bar/skill-bar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { RoadmapComponent } from '../../../shared/components/roadmap/roadmap.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

type Tab = 'overview' | 'skills' | 'attendance' | 'belt' | 'roadmap' | 'comments';

@Component({
  selector: 'app-child-progress',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, RouterLink,
            PageHeaderComponent, AvatarComponent, SkillBarComponent,
            EmptyStateComponent, RoadmapComponent, TimeAgoPipe],
  template: `
    <dojo-page-header title="My Child's Progress" subtitle="Skill development and achievements"></dojo-page-header>

    <!-- Child selector (if multiple children) -->
    <div *ngIf="(children$ | async)?.length! > 1" class="card mb-4" style="padding:12px 16px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button *ngFor="let c of children$ | async"
          class="btn" [class.btn--primary]="selectedId() === c.id"
          [class.btn--secondary]="selectedId() !== c.id"
          (click)="selectChild(c.id)">
          {{ c.firstName }} {{ c.lastName }}
        </button>
      </div>
    </div>

    <ng-container *ngIf="student$ | async as s">
      <!-- Profile card -->
      <div class="card mb-4">
        <div class="card__body" style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
          <dojo-avatar [name]="s.firstName + ' ' + s.lastName" size="xl"></dojo-avatar>
          <div style="flex:1">
            <h2 style="font-size:22px;font-weight:700;margin-bottom:4px">{{ s.firstName }} {{ s.lastName }}</h2>
            <div class="text-muted" style="margin-bottom:8px">
              {{ s.disciplineId }} · Age {{ age(s) }} · Enrolled {{ s.enrolledAt | date:'MMM y' }}
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span class="badge badge--accent" style="font-size:13px;padding:4px 12px">
                🥋 {{ s.currentBeltId || 'No belt yet' }}
              </span>
              <span *ngIf="attPct() !== null" class="badge"
                [class.badge--success]="attPct()! >= 80"
                [class.badge--warning]="attPct()! >= 60 && attPct()! < 80"
                [class.badge--danger]="attPct()! < 60"
                style="font-size:13px;padding:4px 12px">
                {{ attPct() }}% Attendance
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs mb-4">
        <button *ngFor="let t of tabs" class="tab-btn"
          [class.active]="activeTab() === t.key"
          (click)="activeTab.set(t.key)">
          {{ t.icon }} {{ t.label }}
        </button>
      </div>

      <!-- Overview -->
      <ng-container *ngIf="activeTab() === 'overview'">
        <div class="form-grid form-grid--2">
          <!-- Quick skill snapshot -->
          <div class="card">
            <div class="card__header"><span class="card__title">Skill Snapshot</span></div>
            <div class="card__body">
              <ng-container *ngIf="latestSkills() as ls">
                <div *ngIf="!hasAnySkill(ls)">
                  <dojo-empty-state icon="📊" title="No skill data yet"
                    subtitle="Your coach will update skills after sessions.">
                  </dojo-empty-state>
                </div>
                <ng-container *ngIf="hasAnySkill(ls)">
                  <dojo-skill-bar *ngFor="let k of skillKeys"
                    [label]="skillLabels[k]" [score]="getScore(ls, k)" color="#6366f1">
                  </dojo-skill-bar>
                  <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
                    <span class="text-muted">Overall: </span>
                    <strong style="color:var(--accent);font-size:18px">{{ overallScore(ls) }}/10</strong>
                  </div>
                </ng-container>
              </ng-container>
            </div>
          </div>

          <!-- Objectives -->
          <div class="card">
            <div class="card__header"><span class="card__title">Current Objectives</span></div>
            <div *ngIf="objectives$ | async as objs">
              <dojo-empty-state *ngIf="objs.length === 0" icon="🎯" title="No objectives set yet"
                subtitle="Your coach will set objectives to work toward.">
              </dojo-empty-state>
              <div *ngFor="let o of objs"
                style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border)">
                <span style="font-size:16px;margin-top:2px">{{ o.isComplete ? '✅' : '🎯' }}</span>
                <div style="flex:1">
                  <div style="font-size:13px" [style.text-decoration]="o.isComplete ? 'line-through' : 'none'"
                    [style.color]="o.isComplete ? 'var(--text-muted)' : 'var(--text)'">
                    {{ o.description }}
                  </div>
                  <div *ngIf="o.completedAt" class="text-muted text-sm">
                    Completed {{ o.completedAt | date:'MMM d' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Skills tab — full history -->
      <ng-container *ngIf="activeTab() === 'skills'">
        <div class="card">
          <div class="card__header"><span class="card__title">Skill Assessments Over Time</span></div>
          <div *ngIf="comments$ | async as comments">
            <dojo-empty-state *ngIf="skillComments(comments).length === 0"
              icon="📊" title="No skill data yet"
              subtitle="Skill scores will appear here after coach assessments.">
            </dojo-empty-state>
            <div *ngFor="let c of skillComments(comments)" style="padding:16px 20px;border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <div style="font-weight:600;font-size:13px">{{ c.coachName }}</div>
                <div class="text-muted text-sm">{{ c.createdAt | timeAgo }}</div>
              </div>
              <div *ngFor="let k of skillKeys">
                <dojo-skill-bar *ngIf="getScore(c.skills, k) > 0"
                  [label]="skillLabels[k]" [score]="getScore(c.skills, k)" color="#6366f1">
                </dojo-skill-bar>
              </div>
              <div *ngIf="c.comment" style="margin-top:8px;font-size:13px;color:var(--text-muted);font-style:italic">
                "{{ c.comment }}"
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Attendance tab -->
      <ng-container *ngIf="activeTab() === 'attendance'">
        <div class="card">
          <div class="card__header">
            <span class="card__title">Attendance History</span>
            <span *ngIf="attPct() !== null" class="badge"
              [class.badge--success]="attPct()! >= 80"
              [class.badge--warning]="attPct()! >= 60 && attPct()! < 80"
              [class.badge--danger]="attPct()! < 60">
              {{ attPct() }}% rate
            </span>
          </div>
          <div *ngIf="attendance$ | async as records">
            <dojo-empty-state *ngIf="records.length === 0" icon="📅" title="No attendance records yet"></dojo-empty-state>
            <div *ngIf="records.length > 0">
              <!-- Stats bar -->
              <div style="display:flex;gap:16px;padding:12px 20px;border-bottom:1px solid var(--border);flex-wrap:wrap">
                <div *ngFor="let stat of attStats(records)"
                  style="display:flex;align-items:center;gap:6px;font-size:13px">
                  <div style="width:10px;height:10px;border-radius:50%" [style.background]="stat.color"></div>
                  <span>{{ stat.label }}: <strong>{{ stat.count }}</strong></span>
                </div>
              </div>
              <!-- Monthly breakdown -->
              <div style="padding:16px 20px">
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                  <div *ngFor="let r of records"
                    style="width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600"
                    [style.background]="attColor(r.status)"
                    [title]="r.markedAt | date:'MMM d'">
                    {{ r.markedAt | date:'d' }}
                  </div>
                </div>
                <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap">
                  <div *ngFor="let item of attLegend" style="display:flex;align-items:center;gap:6px;font-size:12px">
                    <div style="width:12px;height:12px;border-radius:3px" [style.background]="item.color"></div>
                    {{ item.label }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Belt tab -->
      <ng-container *ngIf="activeTab() === 'belt'">
        <div class="card">
          <div class="card__header"><span class="card__title">Belt Journey</span></div>
          <div *ngIf="beltHistory$ | async as history">
            <dojo-empty-state *ngIf="history.length === 0" icon="🥋" title="Belt journey starts here"
              subtitle="Your first belt promotion will appear here.">
            </dojo-empty-state>
            <div *ngFor="let b of history; let last = last" style="display:flex;gap:16px;padding:16px 20px;position:relative">
              <!-- Timeline connector -->
              <div style="display:flex;flex-direction:column;align-items:center">
                <div style="width:14px;height:14px;border-radius:50%;border:2px solid var(--border);flex-shrink:0"
                  [style.background]="b.beltId">
                </div>
                <div *ngIf="!last" style="width:2px;flex:1;background:var(--border);margin-top:4px"></div>
              </div>
              <div style="flex:1;padding-bottom:16px">
                <div style="font-weight:700;font-size:15px">🥋 {{ b.beltName }}</div>
                <div class="text-muted text-sm" style="margin-top:2px">
                  Awarded {{ b.awardedAt | date:'MMMM d, y' }} by {{ b.awardedBy }}
                </div>
                <div *ngIf="b.notes" style="margin-top:6px;font-size:13px;color:var(--text-muted);font-style:italic">
                  "{{ b.notes }}"
                </div>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Roadmap tab — the curriculum roadmap with your child's current position -->
      <ng-container *ngIf="activeTab() === 'roadmap'">
        <div class="card mb-4" *ngIf="readiness$ | async as r">
          <div class="card__header"><span class="card__title">Progress Toward Next Belt</span></div>
          <div class="card__body">
            <div class="progress-grid">
              <div *ngFor="let t of trackOrder" class="progress-item">
                <span class="progress-icon">{{ trackIcon[t] }}</span>
                <span class="text-muted text-sm">{{ trackLabel[t] }}</span>
                <span class="badge" [class.badge--success]="r.tracks[t].effectiveResult === 'pass'"
                  [class.badge--warning]="r.tracks[t].effectiveResult === 'fail'"
                  [class.badge--gray]="!r.tracks[t].effectiveResult">
                  {{ r.tracks[t].effectiveResult ?? 'Not yet evaluated' }}
                </span>
              </div>
              <div class="progress-item">
                <span class="progress-icon">🎓</span>
                <span class="text-muted text-sm">Seminar Points</span>
                <span class="badge" [class.badge--success]="r.seminarPoints >= r.seminarPointsRequired" [class.badge--gray]="r.seminarPoints < r.seminarPointsRequired">
                  {{ r.seminarPoints }} / {{ r.seminarPointsRequired }}
                </span>
              </div>
              <div class="progress-item">
                <span class="progress-icon">🥋</span>
                <span class="text-muted text-sm">BJJ Stripes ({{ r.bjjStripeLabel }})</span>
                <span class="badge" [class.badge--success]="r.bjjStripes >= r.bjjStripesRequired" [class.badge--gray]="r.bjjStripes < r.bjjStripesRequired">
                  {{ r.bjjStripes }} / {{ r.bjjStripesRequired }}
                </span>
              </div>
            </div>
            <div *ngIf="r.isReady" class="ready-banner">🎉 All requirements met — ready for promotion!</div>
          </div>
        </div>
        <div class="card" *ngIf="roadmap$ | async as roadmap">
          <div class="card__header"><span class="card__title">Curriculum Roadmap</span></div>
          <div class="card__body">
            <dojo-empty-state *ngIf="roadmap.length === 0" icon="🗺️" title="No roadmap configured yet"
              subtitle="Your dojo hasn't set up a curriculum roadmap for this discipline."></dojo-empty-state>
            <dojo-roadmap *ngIf="roadmap.length" [belts]="roadmap" [currentBeltId]="s.currentBeltId"></dojo-roadmap>
          </div>
        </div>
      </ng-container>

      <!-- Comments tab -->
      <ng-container *ngIf="activeTab() === 'comments'">
        <div class="card">
          <div class="card__header"><span class="card__title">Coach Comments</span></div>
          <div *ngIf="comments$ | async as comments">
            <dojo-empty-state *ngIf="comments.length === 0" icon="💬" title="No comments yet"
              subtitle="Your coach will post session notes and feedback here.">
            </dojo-empty-state>
            <div *ngFor="let c of textComments(comments)" style="padding:16px 20px;border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <dojo-avatar [name]="c.coachName" size="xs"></dojo-avatar>
                <strong style="font-size:13px">{{ c.coachName }}</strong>
                <span class="text-muted text-sm">{{ c.createdAt | timeAgo }}</span>
              </div>
              <div style="font-size:14px;line-height:1.7;background:var(--surface-2);
                          border-radius:var(--radius-md);padding:12px 16px;border-left:3px solid var(--accent)">
                {{ c.comment }}
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </ng-container>
  `,
  styles: [`
    .tabs     { display:flex; gap:4px; border-bottom:1px solid var(--border); }
    .tab-btn  { padding:8px 14px; font-size:13px; font-weight:500; border:none; background:none;
                color:var(--text-muted); cursor:pointer; border-bottom:2px solid transparent;
                margin-bottom:-1px; transition:color .15s,border-color .15s;
                &:hover { color:var(--text); }
                &.active { color:var(--accent); border-bottom-color:var(--accent); } }
    .progress-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
    .progress-item  { display:flex; flex-direction:column; align-items:flex-start; gap:6px;
                       padding:12px; background:var(--surface-2); border-radius:var(--radius-md); }
    .progress-icon  { font-size:18px; }
    .ready-banner   { margin-top:16px; padding:12px 16px; border-radius:var(--radius-md);
                       background:#dcfce7; color:#166534; font-weight:600; font-size:13px; }
  `]
})
export class ChildProgressComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private auth  = inject(AuthService);
  private route = inject(ActivatedRoute);
  private sts   = inject(StudentService);
  private as_   = inject(AttendanceService);
  private bs    = inject(BeltService);
  private es    = inject(EvaluationService);

  children$!:   Observable<Student[]>;
  student$!:    Observable<Student | undefined>;
  comments$!:   Observable<SessionComment[]>;
  attendance$!: Observable<AttendanceRecord[]>;
  beltHistory$!:Observable<BeltHistory[]>;
  objectives$!: Observable<StudentObjective[]>;
  roadmap$!:    Observable<Belt[]>;
  readiness$!:  Observable<PromotionReadiness>;

  trackOrder = ['striking', 'grappling', 'selfdefense'] as const;
  trackIcon: Record<string, string>  = { striking: '🥊', grappling: '🤼', selfdefense: '🛡️' };
  trackLabel: Record<string, string> = { striking: 'Striking', grappling: 'Grappling', selfdefense: 'Self-Defense' };

  activeTab  = signal<Tab>('overview');
  selectedId = signal<string>('');
  attPct     = signal<number | null>(null);

  skillKeys   = SKILL_KEYS;
  skillLabels = SKILL_LABELS;
  age = (s: Student) => s.dob ? calcAge(new Date(s.dob)) : '—';

  attLegend = [
    { label: 'Present', color: '#22c55e' }, { label: 'Late',    color: '#f59e0b' },
    { label: 'Excused', color: '#3b82f6' }, { label: 'Absent',  color: '#ef4444' },
  ];

  tabs = [
    { key: 'overview'   as Tab, icon: '⊞',  label: 'Overview' },
    { key: 'skills'     as Tab, icon: '📊',  label: 'Skills' },
    { key: 'attendance' as Tab, icon: '✓',   label: 'Attendance' },
    { key: 'belt'       as Tab, icon: '🥋',  label: 'Belt Journey' },
    { key: 'roadmap'    as Tab, icon: '🗺️',  label: 'Roadmap' },
    { key: 'comments'   as Tab, icon: '💬',  label: 'Coach Notes' },
  ];

  ngOnInit() {
    const uid = this.auth.currentUser()!.uid;
    this.children$ = this.sts.byParent$(uid);

    // Use route param if present, else first child
    this.route.params.subscribe(p => {
      const id = p['id'];
      if (id) { this.selectChild(id); return; }
      this.children$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(list => {
        if (list.length > 0 && !this.selectedId()) this.selectChild(list[0].id);
      });
    });
  }

  selectChild(id: string) {
    this.selectedId.set(id);
    this.student$     = this.sts.get$(id);
    this.comments$    = this.sts.comments$(id);
    this.attendance$  = this.as_.byStudent$(id);
    this.beltHistory$ = this.bs.history$(id);
    this.objectives$  = this.bs.objectives$(id);
    this.readiness$   = this.es.readiness$(id);
    this.attendance$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(r => this.attPct.set(this.calcAttPct(r)));
    this.student$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(s => {
      this.roadmap$ = s?.disciplineId ? this.bs.roadmap$(s.disciplineId) : of([]);
    });
  }

  // ── Helpers ─────────────────────────────────────────────────
  latestSkills(): Partial<Record<string, number>> {
    return {}; // populated by async in template via skillComments
  }

  getScore(skills: any, k: string): number {
    return skills?.[k] ?? 0;
  }

  hasAnySkill(skills: any): boolean {
    return Object.values(skills ?? {}).some((v: any) => v > 0);
  }

  overallScore(skills: any): number {
    const vals = this.skillKeys.map(k => skills?.[k] ?? 0).filter(v => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0;
  }

  skillComments(all: SessionComment[]): SessionComment[] {
    return all.filter(c => this.hasAnySkill(c.skills));
  }

  textComments(all: SessionComment[]): SessionComment[] {
    return all.filter(c => c.comment?.trim());
  }

  attStats(r: AttendanceRecord[]) {
    const c = { present: 0, late: 0, excused: 0, absent: 0 };
    r.forEach(x => c[x.status]++);
    return [
      { label: 'Present', count: c.present, color: '#22c55e' },
      { label: 'Late',    count: c.late,    color: '#f59e0b' },
      { label: 'Excused', count: c.excused, color: '#3b82f6' },
      { label: 'Absent',  count: c.absent,  color: '#ef4444' },
    ];
  }

  attColor(status: string): string {
    const map: Record<string, string> = {
      present: '#22c55e22', late: '#f59e0b22', excused: '#3b82f622', absent: '#ef444422',
    };
    return map[status] ?? '#ffffff11';
  }

  calcAttPct(r: AttendanceRecord[]): number {
    if (!r.length) return 0;
    const counted = r.filter(x => x.status !== 'excused').length;
    const present = r.filter(x => x.status === 'present' || x.status === 'late').length;
    return counted ? Math.round(present / counted * 100) : 0;
  }
}
