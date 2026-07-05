import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Belt, CurriculumTrack } from '../../../core/models';
import { IconComponent, IconName } from '../icon/icon.component';

// ─────────────────────────────────────────────────────────────────────────────
//  RoadmapComponent — presentational curriculum roadmap table. Shows every
//  belt in order with its Striking / Grappling / Self-Defense track
//  requirements, and highlights the student's current position when
//  [currentBeltId] is provided. Used on both the parent's "My Child's
//  Progress" page and the coach's student-detail page, so the roadmap only
//  needs to be built once and stays visually consistent everywhere.
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'dojo-roadmap',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="roadmap">
      <div *ngFor="let b of belts; let last = last" class="roadmap-row"
        [class.current]="b.id === currentBeltId">
        <div class="roadmap-connector">
          <div class="roadmap-dot" [style.background]="b.colorHex" [style.border-color]="b.colorHex"></div>
          <div *ngIf="!last" class="roadmap-line"></div>
        </div>

        <div class="roadmap-content">
          <button class="roadmap-header" (click)="toggle(b.id)">
            <span class="roadmap-name">
              {{ b.name }}
              <span *ngIf="b.id === currentBeltId" class="here-badge">You are here</span>
            </span>
            <span class="roadmap-meta">
              <span *ngIf="b.kickboxingLevel"><dojo-icon name="training" [size]="13"></dojo-icon> {{ b.kickboxingLevel }}</span>
              <span *ngIf="b.bjjStripeLabel"><dojo-icon name="belt" [size]="13"></dojo-icon> {{ b.bjjStripeLabel }}</span>
              <span *ngIf="b.seminarPointsRequired"><dojo-icon name="graduation" [size]="13"></dojo-icon> {{ b.seminarPointsRequired }} seminar pts</span>
              <span class="expand-icon">{{ expanded.has(b.id) ? '▾' : '▸' }}</span>
            </span>
          </button>

          <div *ngIf="expanded.has(b.id) && b.syllabus?.length" class="roadmap-syllabus">
            <div *ngFor="let track of trackOrder" class="syllabus-track">
              <ng-container *ngIf="itemFor(b, track) as item">
                <div class="syllabus-icon"><dojo-icon [name]="trackIcon[track]" [size]="16"></dojo-icon></div>
                <div>
                  <div class="syllabus-title">{{ trackLabel[track] }} — {{ item.title }}</div>
                  <div class="syllabus-desc">{{ item.description }}</div>
                </div>
              </ng-container>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .roadmap-row      { display:flex; gap:16px; }
    .roadmap-connector{ display:flex; flex-direction:column; align-items:center; }
    .roadmap-dot      { width:16px; height:16px; border-radius:50%; border:2px solid; flex-shrink:0; box-shadow:0 0 0 3px var(--surface); }
    .roadmap-line     { width:2px; flex:1; background:var(--border); margin-top:4px; min-height:24px; }
    .roadmap-content  { flex:1; padding-bottom:20px; }
    .roadmap-header   { width:100%; display:flex; align-items:center; justify-content:space-between;
                         gap:12px; flex-wrap:wrap; background:none; border:none; cursor:pointer;
                         text-align:left; padding:0; }
    .roadmap-name     { font-weight:700; font-size:15px; display:flex; align-items:center; gap:8px; }
    .here-badge       { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em;
                         background:var(--accent); color:#fff; padding:2px 8px; border-radius:10px; }
    .roadmap-meta     { display:flex; align-items:center; gap:12px; font-size:12px; color:var(--text-muted); flex-wrap:wrap; }
    .expand-icon      { color:var(--text-muted); }
    .roadmap-row.current .roadmap-name { color:var(--accent); }
    .roadmap-syllabus { margin-top:12px; display:flex; flex-direction:column; gap:10px;
                         background:var(--surface-2); border-radius:var(--radius-md); padding:12px 16px; }
    .syllabus-track   { display:flex; gap:10px; align-items:flex-start; }
    .syllabus-icon    { font-size:15px; margin-top:1px; }
    .syllabus-title   { font-size:12px; font-weight:600; margin-bottom:2px; }
    .syllabus-desc    { font-size:12px; color:var(--text-muted); line-height:1.5; }
  `]
})
export class RoadmapComponent {
  @Input() belts: Belt[] = [];
  @Input() currentBeltId?: string;

  expanded = new Set<string>();
  trackOrder: CurriculumTrack[] = ['striking', 'grappling', 'selfdefense'];
  trackIcon: Record<CurriculumTrack, IconName> = { striking: 'training', grappling: 'belt', selfdefense: 'shield' };
  trackLabel: Record<CurriculumTrack, string> = { striking: 'Striking', grappling: 'Grappling', selfdefense: 'Self-Defense' };

  toggle(beltId: string) {
    this.expanded.has(beltId) ? this.expanded.delete(beltId) : this.expanded.add(beltId);
  }

  itemFor(belt: Belt, track: CurriculumTrack) {
    return belt.syllabus?.find(s => s.track === track);
  }
}
