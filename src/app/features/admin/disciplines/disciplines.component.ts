import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, switchMap, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { DisciplineService } from '../../../core/services/discipline.service';
import { Discipline, Belt } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-disciplines',
  standalone: true,
  imports: [CommonModule, AsyncPipe, FormsModule, PageHeaderComponent, EmptyStateComponent],
  template: `
    <dojo-page-header title="Disciplines & Belts" subtitle="Configure martial arts programs and belt progressions">
      <button class="btn btn--primary" (click)="showAddDisc.set(true)">+ Add Discipline</button>
    </dojo-page-header>

    <!-- Add discipline form -->
    <div class="card mb-4" *ngIf="showAddDisc()">
      <div class="card__header"><span class="card__title">New Discipline</span></div>
      <div class="card__body">
        <div class="form-grid form-grid--2">
          <div class="form-group">
            <label>Name</label>
            <input class="input" [(ngModel)]="newDisc.name" placeholder="e.g. Kickboxing, BJJ, Karate">
          </div>
          <div class="form-group">
            <label>Colour</label>
            <input type="color" class="input" [(ngModel)]="newDisc.color" style="height:40px;padding:4px">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Description</label>
            <input class="input" [(ngModel)]="newDisc.description" placeholder="Brief description…">
          </div>
        </div>
        <div class="form-error" *ngIf="discError()">{{ discError() }}</div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn--primary" (click)="addDiscipline()" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Create' }}
          </button>
          <button class="btn btn--secondary" (click)="showAddDisc.set(false)">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Discipline list -->
    <div *ngIf="disciplines$ | async as discs">
      <dojo-empty-state *ngIf="discs.length === 0"
        icon="🥋" title="No disciplines yet"
        subtitle="Add your first discipline to start configuring belt progressions.">
      </dojo-empty-state>

      <div class="form-grid form-grid--2">
        <div *ngFor="let d of discs" class="card">
          <div class="card__header">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:16px;height:16px;border-radius:50%" [style.background]="d.color"></div>
              <span class="card__title">{{ d.name }}</span>
            </div>
            <button class="btn btn--primary btn--sm" (click)="selectDisc(d)">
              {{ selectedDisc()?.id === d.id ? '✓ Selected' : '+ Add Belt' }}
            </button>
          </div>
          <div class="card__body" style="padding:0">
            <div *ngIf="getBelts(d.id) | async as belts">
              <dojo-empty-state *ngIf="belts.length === 0"
                icon="🎽" title="No belts configured" subtitle="Add belts to this discipline.">
              </dojo-empty-state>
              <div *ngFor="let b of belts; let i = index"
                style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border)">
                <div style="width:24px;height:8px;border-radius:4px;flex-shrink:0" [style.background]="b.colorHex"></div>
                <div style="flex:1">
                  <div style="font-weight:600;font-size:13px">{{ b.name }}</div>
                  <div class="text-muted text-sm">
                    {{ b.minClasses }} classes · Score {{ b.minScore }}/10 min
                  </div>
                </div>
                <span class="badge badge--gray" style="font-size:11px">Level {{ b.sortOrder }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add belt panel -->
    <div *ngIf="selectedDisc() as disc" class="card mt-4" style="max-width:520px">
      <div class="card__header">
        <span class="card__title">Add Belt — {{ disc.name }}</span>
        <button class="btn btn--ghost btn--sm" (click)="selectedDisc.set(null)">✕</button>
      </div>
      <div class="card__body">
        <div class="form-grid form-grid--2">
          <div class="form-group">
            <label>Belt Name</label>
            <input class="input" [(ngModel)]="newBelt.name" placeholder="e.g. White, Yellow, Black">
          </div>
          <div class="form-group">
            <label>Belt Colour</label>
            <input type="color" class="input" [(ngModel)]="newBelt.colorHex" style="height:40px;padding:4px">
          </div>
          <div class="form-group">
            <label>Sort Order</label>
            <input type="number" class="input" [(ngModel)]="newBelt.sortOrder" min="1">
          </div>
          <div class="form-group">
            <label>Min Classes</label>
            <input type="number" class="input" [(ngModel)]="newBelt.minClasses" min="0">
          </div>
          <div class="form-group">
            <label>Min Score (1–10)</label>
            <input type="number" class="input" [(ngModel)]="newBelt.minScore" min="1" max="10">
          </div>
        </div>
        <div class="form-error" *ngIf="beltError()">{{ beltError() }}</div>
        <button class="btn btn--primary btn--full" (click)="addBelt(disc.id)" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Add Belt' }}
        </button>
      </div>
    </div>
  `
})
export class DisciplinesComponent implements OnInit {
  private auth = inject(AuthService);
  private ds   = inject(DisciplineService);

  disciplines$!: Observable<Discipline[]>;
  private beltCache = new Map<string, Observable<Belt[]>>();

  showAddDisc  = signal(false);
  selectedDisc = signal<Discipline | null>(null);
  saving       = signal(false);
  discError    = signal('');
  beltError    = signal('');

  newDisc = { name: '', color: '#3b82f6', description: '' };
  newBelt = { name: '', colorHex: '#ffffff', sortOrder: 1, minClasses: 10, minScore: 5 };

  ngOnInit() {
    this.disciplines$ = this.ds.byDojo$(this.auth.currentUser()!.dojoId);
  }

  getBelts(discId: string): Observable<Belt[]> {
    if (!this.beltCache.has(discId)) {
      this.beltCache.set(discId, this.ds.belts$(discId));
    }
    return this.beltCache.get(discId)!;
  }

  selectDisc(d: Discipline) {
    this.selectedDisc.set(this.selectedDisc()?.id === d.id ? null : d);
    this.beltError.set('');
  }

  async addDiscipline() {
    if (!this.newDisc.name) { this.discError.set('Name is required.'); return; }
    this.saving.set(true); this.discError.set('');
    await this.ds.create({
      dojoId: this.auth.currentUser()!.dojoId,
      name: this.newDisc.name,
      color: this.newDisc.color,
      description: this.newDisc.description,
    });
    this.newDisc = { name: '', color: '#3b82f6', description: '' };
    this.showAddDisc.set(false);
    this.saving.set(false);
  }

  async addBelt(discId: string) {
    if (!this.newBelt.name) { this.beltError.set('Belt name is required.'); return; }
    this.saving.set(true); this.beltError.set('');
    await this.ds.addBelt(discId, {
      disciplineId: discId,
      name: this.newBelt.name,
      colorHex: this.newBelt.colorHex,
      sortOrder: this.newBelt.sortOrder,
      minClasses: this.newBelt.minClasses,
      minScore: this.newBelt.minScore,
    });
    this.newBelt = { name: '', colorHex: '#ffffff', sortOrder: 1, minClasses: 10, minScore: 5 };
    this.saving.set(false);
  }
}
