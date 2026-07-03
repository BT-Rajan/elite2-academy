import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Observable, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService } from '../../../core/services/student.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { BeltService } from '../../../core/services/belt.service';
import { EvaluationService } from '../../../core/services/evaluation.service';
import { Student, SessionComment, AttendanceRecord, BeltHistory, StudentObjective,
         Belt, PromotionReadiness, StudentEvaluation, CurriculumTrack } from '../../../core/models';
import { SKILL_KEYS, SKILL_LABELS, calcAge } from '../../../core/utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { SkillBarComponent } from '../../../shared/components/skill-bar/skill-bar.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { RoadmapComponent } from '../../../shared/components/roadmap/roadmap.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

type Tab = 'overview' | 'skills' | 'attendance' | 'belt' | 'roadmap' | 'comments';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, FormsModule, RouterLink,
            PageHeaderComponent, AvatarComponent, SkillBarComponent,
            BadgeComponent, EmptyStateComponent, RoadmapComponent, TimeAgoPipe],
  template: `
    <a [routerLink]="[basePath(), 'students']" class="btn btn--ghost btn--sm mb-4">← Back to students</a>

    <ng-container *ngIf="student$ | async as s">
      <!-- Header -->
      <div class="card mb-4">
        <div class="card__body" style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
          <dojo-avatar [name]="s.firstName + ' ' + s.lastName" size="xl"></dojo-avatar>
          <div style="flex:1">
            <h2 style="font-size:22px;font-weight:700;margin-bottom:4px">{{ s.firstName }} {{ s.lastName }}</h2>
            <div class="text-muted" style="margin-bottom:8px">{{ s.disciplineName || 'No discipline' }} · Age {{ age(s) }} · Enrolled {{ s.enrolledAt | date:'MMM y' }}</div>
            <span class="badge badge--accent" style="font-size:13px;padding:4px 12px">🥋 {{ s.beltName || 'No belt' }}</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs mb-4">
        <button *ngFor="let t of tabs" class="tab-btn"
          [class.active]="activeTab() === t.key" (click)="activeTab.set(t.key)">
          {{ t.icon }} {{ t.label }}
        </button>
      </div>

      <!-- Overview -->
      <ng-container *ngIf="activeTab() === 'overview'">
        <div class="form-grid form-grid--2">
          <div class="card">
            <div class="card__header"><span class="card__title">Recent Comments</span></div>
            <div *ngIf="comments$ | async as comments">
              <dojo-empty-state *ngIf="comments.length === 0" icon="💬" title="No comments yet"></dojo-empty-state>
              <div *ngFor="let c of comments | slice:0:3" style="padding:12px 16px;border-bottom:1px solid var(--border)">
                <div style="font-size:13px;margin-bottom:4px">{{ c.comment }}</div>
                <div class="text-muted text-sm">{{ c.coachName }} · {{ c.createdAt | timeAgo }}</div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card__header"><span class="card__title">Objectives</span></div>
            <div *ngIf="objectives$ | async as objs">
              <dojo-empty-state *ngIf="objs.length === 0" icon="🎯" title="No objectives set"></dojo-empty-state>
              <div *ngFor="let o of objs" style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border)">
                <button class="btn btn--sm" [class.btn--primary]="o.isComplete" [class.btn--secondary]="!o.isComplete"
                  (click)="!o.isComplete && completeObjective(s.id, o.id)">
                  {{ o.isComplete ? '✓' : '○' }}
                </button>
                <span [style.text-decoration]="o.isComplete ? 'line-through' : 'none'" style="font-size:13px">{{ o.description }}</span>
              </div>
              <div style="padding:12px 16px">
                <div style="display:flex;gap:8px">
                  <input class="input" [(ngModel)]="newObjective" placeholder="Add objective…" style="flex:1" (keyup.enter)="addObjective(s.id)">
                  <button class="btn btn--primary btn--sm" (click)="addObjective(s.id)">Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Skills Tab -->
      <ng-container *ngIf="activeTab() === 'skills'">
        <div class="card mb-4">
          <div class="card__header">
            <span class="card__title">Skill Assessment</span>
            <button class="btn btn--primary btn--sm" (click)="savingSkills.set(!savingSkills())">
              {{ savingSkills() ? 'Cancel' : '✏ Update Skills' }}
            </button>
          </div>
          <div class="card__body">
            <div *ngIf="!savingSkills()">
              <dojo-skill-bar *ngFor="let k of skillKeys"
                [label]="skillLabels[k]"
                [score]="currentSkills()[k] ?? 0"
                color="#6366f1">
              </dojo-skill-bar>
              <div *ngIf="avgScore() > 0" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
                <span class="text-muted">Overall average: </span>
                <strong style="color:var(--accent);font-size:18px">{{ avgScore() }}/10</strong>
              </div>
            </div>

            <!-- Edit mode -->
            <div *ngIf="savingSkills()">
              <div *ngFor="let k of skillKeys" style="margin-bottom:16px">
                <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px">
                  {{ skillLabels[k] }}: {{ editSkills[k] }}/10
                </label>
                <input type="range" min="1" max="10" [ngModel]="editSkills[k]"
                  (ngModelChange)="editSkills[k] = $event" style="width:100%;accent-color:var(--accent)">
              </div>
              <div style="display:flex;gap:8px;margin-top:8px">
                <input class="input" [(ngModel)]="skillComment" placeholder="Add a comment with this assessment (optional)" style="flex:1">
                <button class="btn btn--primary" (click)="saveSkills(s)">Save Assessment</button>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Attendance Tab -->
      <ng-container *ngIf="activeTab() === 'attendance'">
        <div class="card">
          <div class="card__header"><span class="card__title">Attendance History</span></div>
          <div *ngIf="attendance$ | async as records">
            <dojo-empty-state *ngIf="records.length === 0" icon="📅" title="No attendance records"></dojo-empty-state>
            <div *ngIf="records.length > 0">
              <div style="display:flex;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);flex-wrap:wrap">
                <div *ngFor="let stat of attendanceStats(records)"
                  style="display:flex;align-items:center;gap:6px;font-size:13px">
                  <div style="width:10px;height:10px;border-radius:50%" [style.background]="stat.color"></div>
                  <span>{{ stat.label }}: <strong>{{ stat.count }}</strong></span>
                </div>
                <div style="margin-left:auto;font-size:13px;color:var(--accent);font-weight:600">
                  {{ attendancePct(records) }}% attendance rate
                </div>
              </div>
              <table>
                <thead><tr><th>Date</th><th>Session</th><th>Status</th></tr></thead>
                <tbody>
                  <tr *ngFor="let r of records">
                    <td>{{ r.markedAt | date:'MMM d, y' }}</td>
                    <td>{{ r.sessionId }}</td>
                    <td>
                      <span class="badge"
                        [class.badge--success]="r.status === 'present'"
                        [class.badge--warning]="r.status === 'late'"
                        [class.badge--info]="r.status === 'excused'"
                        [class.badge--danger]="r.status === 'absent'">
                        {{ r.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Belt Tab -->
      <ng-container *ngIf="activeTab() === 'belt'">
        <div class="form-grid form-grid--2">
          <div class="card">
            <div class="card__header"><span class="card__title">Belt History</span></div>
            <div *ngIf="beltHistory$ | async as history">
              <dojo-empty-state *ngIf="history.length === 0" icon="🥋" title="No belt awards yet"></dojo-empty-state>
              <div *ngFor="let b of history" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border)">
                <div style="width:14px;height:14px;border-radius:50%;border:2px solid var(--border)" [style.background]="b.beltId"></div>
                <div style="flex:1">
                  <div style="font-weight:600;font-size:13px">{{ b.beltName }}</div>
                  <div class="text-muted text-sm">{{ b.awardedAt | date:'MMM d, y' }} · by {{ b.awardedBy }}</div>
                  <div *ngIf="b.notes" class="text-muted text-sm">{{ b.notes }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card__header"><span class="card__title">Award Belt</span></div>
            <div class="card__body">
              <div class="form-group">
                <label>Belt Name</label>
                <input class="input" [(ngModel)]="newBelt.name" placeholder="e.g. Yellow Belt">
              </div>
              <div class="form-group">
                <label>Belt Color</label>
                <input type="color" class="input" [(ngModel)]="newBelt.color" style="height:40px;padding:4px">
              </div>
              <div class="form-group">
                <label>Notes</label>
                <textarea class="textarea" [(ngModel)]="newBelt.notes" placeholder="Achievement notes…"></textarea>
              </div>
              <button class="btn btn--primary btn--full" (click)="awardBelt(s)">🥋 Award Belt</button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Roadmap Tab — evaluate tracks, award seminar points/stripes, promote -->
      <ng-container *ngIf="activeTab() === 'roadmap'">
        <div class="form-grid form-grid--2 mb-4" *ngIf="readiness$ | async as r">
          <div class="card">
            <div class="card__header"><span class="card__title">Promotion Readiness — {{ r.currentBelt.name }}</span></div>
            <div class="card__body">
              <div class="progress-grid">
                <div *ngFor="let t of trackOrder" class="progress-item">
                  <span class="text-muted text-sm">{{ trackLabel[t] }}</span>
                  <span class="badge" [class.badge--success]="r.tracks[t].effectiveResult === 'pass'"
                    [class.badge--warning]="r.tracks[t].effectiveResult === 'fail'"
                    [class.badge--gray]="!r.tracks[t].effectiveResult">
                    {{ r.tracks[t].effectiveResult ?? 'Not evaluated' }}
                  </span>
                </div>
                <div class="progress-item">
                  <span class="text-muted text-sm">Seminar Points</span>
                  <span class="badge" [class.badge--success]="r.seminarPoints >= r.seminarPointsRequired" [class.badge--gray]="r.seminarPoints < r.seminarPointsRequired">
                    {{ r.seminarPoints }} / {{ r.seminarPointsRequired }}
                  </span>
                </div>
                <div class="progress-item">
                  <span class="text-muted text-sm">BJJ Stripes ({{ r.bjjStripeLabel }})</span>
                  <span class="badge" [class.badge--success]="r.bjjStripes >= r.bjjStripesRequired" [class.badge--gray]="r.bjjStripes < r.bjjStripesRequired">
                    {{ r.bjjStripes }} / {{ r.bjjStripesRequired }}
                  </span>
                </div>
              </div>

              <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn--secondary btn--sm" (click)="awardStripe(s.id)">🥋 +1 BJJ Stripe</button>
                <input class="input" type="number" [(ngModel)]="seminarPointsToAward" style="width:80px" placeholder="Pts">
                <input class="input" [(ngModel)]="seminarPointsReason" placeholder="Reason (e.g. Weapons seminar)" style="flex:1;min-width:160px">
                <button class="btn btn--secondary btn--sm" (click)="awardSeminarPoints(s.id)">🎓 Award Points</button>
              </div>

              <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
                <button *ngIf="r.isReady" class="btn btn--primary btn--full" (click)="promote(s)">
                  🎉 Promote to Next Belt
                </button>
                <ng-container *ngIf="!r.isReady">
                  <div class="text-muted text-sm mb-2">Not all requirements are met yet.</div>
                  <ng-container *ngIf="canOverrule()">
                    <textarea class="textarea" [(ngModel)]="overrideNotes" rows="2"
                      placeholder="Reason for promoting despite unmet requirements (required)…"></textarea>
                    <button class="btn btn--danger btn--full mt-2" [disabled]="!overrideNotes.trim()" (click)="promote(s, true)">
                      ⚠️ Head Coach Override — Promote Anyway
                    </button>
                  </ng-container>
                </ng-container>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card__header"><span class="card__title">Evaluate — {{ r.currentBelt.name }}</span></div>
            <div class="card__body">
              <div class="form-group">
                <label>Track</label>
                <select class="input" [(ngModel)]="evalTrack">
                  <option *ngFor="let t of trackOrder" [value]="t">{{ trackLabel[t] }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Result</label>
                <div style="display:flex;gap:8px">
                  <button class="btn btn--sm" [class.btn--primary]="evalResult === 'pass'" [class.btn--secondary]="evalResult !== 'pass'" (click)="evalResult = 'pass'">✓ Pass</button>
                  <button class="btn btn--sm" [class.btn--primary]="evalResult === 'fail'" [class.btn--secondary]="evalResult !== 'fail'" (click)="evalResult = 'fail'">✗ Fail</button>
                </div>
              </div>
              <div class="form-group">
                <label>Notes</label>
                <textarea class="textarea" [(ngModel)]="evalNotes" rows="2" placeholder="What did you observe?"></textarea>
              </div>
              <button class="btn btn--primary btn--full" (click)="submitEvaluation(s.id)">Save Evaluation</button>

              <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
                <div *ngIf="evaluations$ | async as evals">
                  <dojo-empty-state *ngIf="evals.length === 0" icon="📋" title="No evaluations yet"></dojo-empty-state>
                  <div *ngFor="let e of evals" style="padding:10px 0;border-bottom:1px solid var(--border)">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                      <strong style="font-size:13px">{{ trackLabel[e.track] }} — {{ e.beltName }}</strong>
                      <span class="badge" [class.badge--success]="e.result === 'pass'" [class.badge--danger]="e.result === 'fail'">{{ e.result }}</span>
                    </div>
                    <div class="text-muted text-sm">{{ e.coachName }} · {{ e.evaluatedAt | timeAgo }}</div>
                    <div *ngIf="e.notes" class="text-muted text-sm" style="font-style:italic">"{{ e.notes }}"</div>

                    <div *ngIf="e.overruledBy" style="margin-top:6px;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-md);border-left:3px solid var(--accent)">
                      <div style="font-size:12px;font-weight:600">
                        Overruled to <span class="badge" [class.badge--success]="e.overruleResult === 'pass'" [class.badge--danger]="e.overruleResult === 'fail'">{{ e.overruleResult }}</span>
                        by {{ e.overruledByName }}
                      </div>
                      <div class="text-muted text-sm" style="font-style:italic">"{{ e.overruleNotes }}"</div>
                    </div>

                    <button *ngIf="!e.overruledBy && canOverrule()" class="btn btn--ghost btn--sm mt-2" (click)="openOverrule(e)">
                      Overrule
                    </button>

                    <div *ngIf="overruling()?.id === e.id" style="margin-top:8px">
                      <div style="display:flex;gap:6px;margin-bottom:6px">
                        <button class="btn btn--sm" [class.btn--primary]="overruleResult==='pass'" [class.btn--secondary]="overruleResult!=='pass'" (click)="overruleResult='pass'">✓ Pass</button>
                        <button class="btn btn--sm" [class.btn--primary]="overruleResult==='fail'" [class.btn--secondary]="overruleResult!=='fail'" (click)="overruleResult='fail'">✗ Fail</button>
                      </div>
                      <textarea class="textarea" [(ngModel)]="overruleNotes" rows="2" placeholder="Reason for overruling (required)…"></textarea>
                      <button class="btn btn--danger btn--sm mt-2" [disabled]="!overruleNotes.trim()" (click)="submitOverrule(e)">Confirm Overrule</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__header"><span class="card__title">Curriculum Roadmap</span></div>
          <div class="card__body" *ngIf="roadmap$ | async as roadmap">
            <dojo-empty-state *ngIf="roadmap.length === 0" icon="🗺️" title="No roadmap configured yet"
              subtitle="Set up belts and syllabus for this discipline under Admin → Curriculum."></dojo-empty-state>
            <dojo-roadmap *ngIf="roadmap.length" [belts]="roadmap" [currentBeltId]="s.currentBeltId"></dojo-roadmap>
          </div>
        </div>
      </ng-container>

      <!-- Comments Tab -->
      <ng-container *ngIf="activeTab() === 'comments'">
        <div class="card mb-4">
          <div class="card__header"><span class="card__title">Add Comment</span></div>
          <div class="card__body">
            <div class="form-group">
              <textarea class="textarea" [(ngModel)]="newComment" rows="3"
                placeholder="Write a session comment for this student…"></textarea>
            </div>
            <button class="btn btn--primary" (click)="addComment(s.id)" [disabled]="!newComment.trim()">
              Post Comment
            </button>
          </div>
        </div>
        <div class="card">
          <div class="card__header"><span class="card__title">All Comments</span></div>
          <div *ngIf="comments$ | async as comments">
            <dojo-empty-state *ngIf="comments.length === 0" icon="💬" title="No comments yet"
              subtitle="Comments you write here are visible to parents."></dojo-empty-state>
            <div *ngFor="let c of comments" style="padding:16px 20px;border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <dojo-avatar [name]="c.coachName" size="xs"></dojo-avatar>
                <strong style="font-size:13px">{{ c.coachName }}</strong>
                <span class="text-muted text-sm">{{ c.createdAt | timeAgo }}</span>
              </div>
              <div style="font-size:14px;line-height:1.6;margin-bottom:8px">{{ c.comment }}</div>
              <div *ngIf="hasSkills(c)" style="display:flex;flex-wrap:wrap;gap:6px">
                <ng-container *ngFor="let k of skillKeys">
                  <span *ngIf="getSkillScore(c, k)" class="badge badge--accent" style="font-size:11px">
                    {{ skillLabels[k] }}: {{ getSkillScore(c, k) }}/10
                  </span>
                </ng-container>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </ng-container>
  `,
  styles: [`
    .tabs { display:flex; gap:4px; border-bottom:1px solid var(--border); padding-bottom:0; }
    .tab-btn {
      padding:8px 14px; font-size:13px; font-weight:500; border:none; background:none;
      color:var(--text-muted); cursor:pointer; border-bottom:2px solid transparent;
      margin-bottom:-1px; transition:color .15s,border-color .15s;
      &:hover { color:var(--text); }
      &.active { color:var(--accent); border-bottom-color:var(--accent); }
    }
    .progress-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; }
    .progress-item  { display:flex; flex-direction:column; align-items:flex-start; gap:6px;
                       padding:10px; background:var(--surface-2); border-radius:var(--radius-md); }
  `]
})
export class StudentDetailComponent implements OnInit {
  private auth    = inject(AuthService);
  private route   = inject(ActivatedRoute);
  private sts     = inject(StudentService);
  private as_     = inject(AttendanceService);
  private bs      = inject(BeltService);
  private es      = inject(EvaluationService);

  student$!:    Observable<Student | undefined>;
  comments$!:   Observable<SessionComment[]>;
  attendance$!: Observable<AttendanceRecord[]>;
  beltHistory$!:Observable<BeltHistory[]>;
  objectives$!: Observable<StudentObjective[]>;
  roadmap$!:    Observable<Belt[]>;
  readiness$!:  Observable<PromotionReadiness>;
  evaluations$!:Observable<StudentEvaluation[]>;

  trackOrder: CurriculumTrack[] = ['striking', 'grappling', 'selfdefense'];
  trackLabel: Record<CurriculumTrack, string> = { striking: 'Striking', grappling: 'Grappling', selfdefense: 'Self-Defense' };

  evalTrack: CurriculumTrack = 'striking';
  evalResult: 'pass' | 'fail' = 'pass';
  evalNotes = '';

  seminarPointsToAward = 1;
  seminarPointsReason = '';

  overrideNotes = '';
  overruling = signal<StudentEvaluation | null>(null);
  overruleResult: 'pass' | 'fail' = 'pass';
  overruleNotes = '';

  activeTab   = signal<Tab>('overview');
  savingSkills = signal(false);
  currentSkills = signal<Partial<Record<string, number>>>({});
  editSkills: Record<string, number> = Object.fromEntries(
    ['technique','fitness','discipline','focus','attitude','balance','reflex','speed','flexibility'].map(k => [k, 5])
  );
  skillComment = '';
  newComment   = '';
  newObjective = '';
  newBelt      = { name: '', color: '#ffd700', notes: '' };

  skillKeys   = SKILL_KEYS;
  skillLabels = SKILL_LABELS;
  age = (s: Student) => s.dob ? calcAge(new Date(s.dob)) : '—';

  tabs = [
    { key: 'overview'   as Tab, icon: '⊞',  label: 'Overview' },
    { key: 'skills'     as Tab, icon: '📊',  label: 'Skills' },
    { key: 'attendance' as Tab, icon: '✓',   label: 'Attendance' },
    { key: 'belt'       as Tab, icon: '🥋',  label: 'Belt' },
    { key: 'roadmap'    as Tab, icon: '🗺️',  label: 'Roadmap' },
    { key: 'comments'   as Tab, icon: '💬',  label: 'Comments' },
  ];

  private studentId = '';

  // This detail page is mounted under both /coach/students/:id and
  // /admin/students/:id — link back to whichever list matches.
  basePath = () => this.auth.currentUser()?.role === 'admin' ? '/admin' : '/coach';

  ngOnInit() {
    this.student$ = this.route.params.pipe(
      switchMap(p => this.sts.get$(p['id']))
    );
    this.route.params.subscribe(p => {
      const sid = p['id'];
      this.studentId     = sid;
      this.comments$     = this.sts.comments$(sid);
      this.attendance$   = this.as_.byStudent$(sid);
      this.beltHistory$  = this.bs.history$(sid);
      this.objectives$   = this.bs.objectives$(sid);
      this.refreshEvaluationState(sid);
    });
    this.student$.subscribe(s => {
      if (s?.disciplineId) this.roadmap$ = this.bs.roadmap$(s.disciplineId);
    });
  }

  private refreshEvaluationState(studentId: string) {
    this.readiness$   = this.es.readiness$(studentId);
    this.evaluations$ = this.es.evaluations$(studentId);
  }

  avgScore(): number {
    const vals = Object.values(this.currentSkills()).filter((v): v is number => typeof v === 'number');
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0;
  }

  hasSkills(c: SessionComment): boolean {
    return Object.values(c.skills ?? {}).some(v => v !== undefined);
  }

  async saveSkills(student: Student) {
    const user = this.auth.currentUser()!;
    const studentId = String(student.id);

    await this.sts.addComment(studentId, {
      studentId,
      coachUid: user.uid, coachName: user.displayName,
      comment: this.skillComment || 'Skill assessment updated.',
      skills: { ...this.editSkills } as any,
      createdAt: new Date() as any,
    });

    this.currentSkills.set({ ...this.editSkills });
    this.savingSkills.set(false);
    this.skillComment = '';
  }

  async addComment(studentId: string) {
    if (!this.newComment.trim()) return;
    const user = this.auth.currentUser()!;
    await this.sts.addComment(studentId, {
      studentId,
      coachUid: user.uid, coachName: user.displayName,
      comment: this.newComment, skills: {},
      createdAt: new Date() as any,
    });
    this.newComment = '';
  }

  async addObjective(studentId: string) {
    if (!this.newObjective.trim()) return;
    const user = this.auth.currentUser()!;
    await this.bs.addObjective(studentId, {
      studentId, beltId: '', description: this.newObjective,
      isComplete: false, setBy: user.uid,
    });
    this.newObjective = '';
  }

  async completeObjective(studentId: string, objId: string) {
    await this.bs.completeObjective(studentId, objId);
  }

  async awardBelt(student: Student) {
    if (!this.newBelt.name) return;
    const user = this.auth.currentUser()!;
    await this.bs.award(student.id, {
      studentId: student.id, beltId: this.newBelt.color,
      beltName: this.newBelt.name, awardedBy: user.displayName,
      awardedAt: new Date() as any, notes: this.newBelt.notes,
    });
    this.newBelt = { name: '', color: '#ffd700', notes: '' };
  }

  attendanceStats(records: AttendanceRecord[]) {
    const counts = { present: 0, late: 0, excused: 0, absent: 0 };
    records.forEach(r => counts[r.status]++);
    return [
      { label: 'Present', count: counts.present, color: '#22c55e' },
      { label: 'Late',    count: counts.late,    color: '#f59e0b' },
      { label: 'Excused', count: counts.excused, color: '#3b82f6' },
      { label: 'Absent',  count: counts.absent,  color: '#ef4444' },
    ];
  }

  getSkillScore(c: SessionComment, k: string): number | undefined {
    return (c.skills as any)[k];
  }

  attendancePct(records: AttendanceRecord[]): number {
    if (!records.length) return 0;
    const counted = records.filter(r => r.status !== 'excused').length;
    const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
    return counted ? Math.round(present / counted * 100) : 0;
  }

  // ── Curriculum roadmap: evaluate / promote / seminar points / stripes ──────

  // A Head Coach or an Admin may overrule a coach's evaluation or force a
  // promotion. Plain coaches can evaluate and promote (when requirements
  // are met) but cannot overrule.
  canOverrule(): boolean {
    const user = this.auth.currentUser();
    return !!user && (user.role === 'admin' || (user.role === 'coach' && !!user.isHeadCoach));
  }

  async submitEvaluation(studentId: string) {
    const user = this.auth.currentUser()!;
    await this.es.evaluate(studentId, {
      track: this.evalTrack, result: this.evalResult,
      notes: this.evalNotes, coachName: user.displayName,
    });
    this.evalNotes = '';
    this.refreshEvaluationState(studentId);
  }

  openOverrule(evaluation: StudentEvaluation) {
    this.overruling.set(evaluation);
    this.overruleResult = 'pass';
    this.overruleNotes = '';
  }

  async submitOverrule(evaluation: StudentEvaluation) {
    if (!this.overruleNotes.trim()) return;
    const user = this.auth.currentUser()!;
    await this.es.overrule(evaluation.id, {
      result: this.overruleResult, notes: this.overruleNotes.trim(), overruledByName: user.displayName,
    });
    this.overruling.set(null);
    this.overruleNotes = '';
    this.refreshEvaluationState(this.studentId);
  }

  async awardStripe(studentId: string) {
    await this.es.awardStripe(studentId);
    this.refreshEvaluationState(studentId);
  }

  async awardSeminarPoints(studentId: string) {
    if (!this.seminarPointsToAward || !this.seminarPointsReason.trim()) return;
    const user = this.auth.currentUser()!;
    await this.es.awardSeminarPoints(studentId, this.seminarPointsToAward, this.seminarPointsReason.trim(), user.displayName);
    this.seminarPointsToAward = 1;
    this.seminarPointsReason = '';
    this.refreshEvaluationState(studentId);
  }

  // override=true is only reachable via the Head Coach / Admin override
  // button, which the template only renders when canOverrule() is true —
  // the API independently enforces this server-side either way.
  async promote(student: Student, override = false) {
    const user = this.auth.currentUser()!;
    await this.es.promote(student.id, {
      awardedBy: user.displayName,
      overrideNotes: override ? this.overrideNotes.trim() : undefined,
    });
    this.overrideNotes = '';
    this.beltHistory$ = this.bs.history$(student.id);
    this.refreshEvaluationState(student.id);
  }
}
