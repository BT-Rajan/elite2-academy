import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { AuthService } from '../../../core/services/auth.service';
import { LoyaltyService } from '../../../core/services/loyalty.service';
import { LoyaltyReward } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

type SettingsTab = 'dojo' | 'loyalty' | 'notifications';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, AsyncPipe, FormsModule, PageHeaderComponent, EmptyStateComponent],
  template: `
    <dojo-page-header title="Settings" subtitle="Configure your dojo's platform settings"></dojo-page-header>

    <div class="tabs mb-6">
      <button *ngFor="let t of tabs" class="tab-btn"
        [class.active]="activeTab() === t.key" (click)="activeTab.set(t.key)">
        {{ t.icon }} {{ t.label }}
      </button>
    </div>

    <!-- Dojo settings -->
    <ng-container *ngIf="activeTab() === 'dojo'">
      <div class="card" style="max-width:600px">
        <div class="card__header"><span class="card__title">Dojo Information</span></div>
        <div class="card__body">
          <div class="form-group">
            <label>Dojo Name</label>
            <input class="input" [(ngModel)]="dojo.name" placeholder="e.g. Elite Martial Arts">
          </div>
          <div class="form-grid form-grid--2">
            <div class="form-group">
              <label>Email</label>
              <input class="input" type="email" [(ngModel)]="dojo.email" placeholder="info@yourdojo.com">
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input class="input" [(ngModel)]="dojo.phone" placeholder="+1 234 567 8900">
            </div>
          </div>
          <div class="form-group">
            <label>Address</label>
            <input class="input" [(ngModel)]="dojo.address" placeholder="123 Main St, City, State">
          </div>
          <div class="form-group">
            <label>Timezone</label>
            <select class="select" [(ngModel)]="dojo.timezone">
              <option *ngFor="let tz of timezones" [value]="tz.value">{{ tz.label }}</option>
            </select>
          </div>
          <div class="form-error" *ngIf="saveError()">{{ saveError() }}</div>
          <button class="btn btn--primary" (click)="saveDojo()" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save Changes' }}
          </button>
          <span *ngIf="saved()" style="color:var(--success);font-size:13px;margin-left:12px">✓ Saved</span>
        </div>
      </div>

      <!-- Dojo ID box -->
      <div class="card mt-4" style="max-width:600px">
        <div class="card__header"><span class="card__title">Dojo ID</span></div>
        <div class="card__body">
          <p class="text-muted mb-3" style="font-size:13px">
            Share this ID with coaches and parents when they sign up.
          </p>
          <div style="display:flex;gap:8px">
            <input class="input" [value]="dojoId()" readonly
              style="font-family:var(--font-mono);font-size:14px;font-weight:600">
            <button class="btn btn--secondary" (click)="copyId()">
              {{ copied() ? '✓ Copied!' : 'Copy' }}
            </button>
          </div>
        </div>
      </div>
    </ng-container>

    <!-- Loyalty settings -->
    <ng-container *ngIf="activeTab() === 'loyalty'">
      <!-- Earning rules -->
      <div class="card mb-4" style="max-width:600px">
        <div class="card__header"><span class="card__title">Point Earning Rules</span></div>
        <div class="card__body">
          <div *ngFor="let rule of pointRules" style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:28px;font-size:18px;text-align:center">{{ rule.icon }}</div>
            <div style="flex:1;font-size:13px;font-weight:500">{{ rule.label }}</div>
            <div style="display:flex;align-items:center;gap:6px">
              <input type="number" class="input" [(ngModel)]="rule.points"
                style="width:70px;text-align:center" min="0">
              <span class="text-muted text-sm">pts</span>
            </div>
          </div>
          <button class="btn btn--primary" (click)="savePointRules()" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save Rules' }}
          </button>
          <span *ngIf="saved()" style="color:var(--success);font-size:13px;margin-left:12px">✓ Saved</span>
        </div>
      </div>

      <!-- Tier thresholds -->
      <div class="card mb-4" style="max-width:600px">
        <div class="card__header"><span class="card__title">Tier Thresholds (Lifetime Points)</span></div>
        <div class="card__body">
          <div *ngFor="let tier of tiers" style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:20px;height:20px;border-radius:50%" [style.background]="tier.color"></div>
            <div style="flex:1;font-size:13px;font-weight:600">{{ tier.name }}</div>
            <div style="display:flex;align-items:center;gap:6px">
              <input type="number" class="input" [(ngModel)]="tier.threshold"
                [disabled]="tier.name === 'Bronze'" style="width:80px;text-align:center" min="0">
              <span class="text-muted text-sm">pts</span>
            </div>
          </div>
          <button class="btn btn--primary" (click)="saveTiers()" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save Tiers' }}
          </button>
        </div>
      </div>

      <!-- Rewards catalogue management -->
      <div class="card" style="max-width:600px">
        <div class="card__header">
          <span class="card__title">Rewards Catalogue</span>
          <button class="btn btn--primary btn--sm" (click)="showAddReward.set(true)">+ Add Reward</button>
        </div>

        <div *ngIf="showAddReward()" style="padding:16px;border-bottom:1px solid var(--border)">
          <div class="form-grid form-grid--2">
            <div class="form-group">
              <label>Name</label>
              <input class="input" [(ngModel)]="newReward.name" placeholder="e.g. Free Class">
            </div>
            <div class="form-group">
              <label>Type</label>
              <select class="select" [(ngModel)]="newReward.type">
                <option value="discount">Discount</option>
                <option value="free_class">Free Class</option>
                <option value="merchandise">Merchandise</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div class="form-group">
              <label>Points Cost</label>
              <input type="number" class="input" [(ngModel)]="newReward.pointsCost" min="1">
            </div>
            <div class="form-group" *ngIf="newReward.type === 'discount'">
              <label>Discount %</label>
              <input type="number" class="input" [(ngModel)]="newReward.discountPct" min="1" max="100">
            </div>
            <div class="form-group" style="grid-column:1/-1">
              <label>Description</label>
              <input class="input" [(ngModel)]="newReward.description" placeholder="What does the member get?">
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn--primary" (click)="addReward()" [disabled]="saving()">Add</button>
            <button class="btn btn--secondary" (click)="showAddReward.set(false)">Cancel</button>
          </div>
        </div>

        <div *ngIf="rewards$ | async as rewards">
          <dojo-empty-state *ngIf="rewards.length === 0"
            icon="🎁" title="No rewards yet" subtitle="Add your first reward above.">
          </dojo-empty-state>
          <div *ngFor="let r of rewards"
            style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border)">
            <div style="font-size:20px">{{ rewardIcon(r.type) }}</div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:13px">{{ r.name }}</div>
              <div class="text-muted text-sm">{{ r.description }}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700;color:var(--accent)">{{ r.pointsCost }} pts</div>
              <div *ngIf="r.discountPct" style="font-size:12px;color:var(--success)">{{ r.discountPct }}% off</div>
            </div>
            <button class="btn btn--ghost btn--sm" (click)="toggleReward(r)">
              {{ r.isActive ? '✓ Active' : 'Disabled' }}
            </button>
          </div>
        </div>
      </div>
    </ng-container>

    <!-- Notifications settings -->
    <ng-container *ngIf="activeTab() === 'notifications'">
      <div class="card" style="max-width:600px">
        <div class="card__header"><span class="card__title">Notification Preferences</span></div>
        <div class="card__body">
          <p class="text-muted mb-4" style="font-size:13px">
            Choose which events trigger notifications to parents and coaches.
          </p>
          <div *ngFor="let pref of notifPrefs"
            style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:13px;font-weight:500">{{ pref.label }}</div>
              <div class="text-muted text-sm">{{ pref.desc }}</div>
            </div>
            <label class="toggle">
              <input type="checkbox" [(ngModel)]="pref.enabled">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>
          <button class="btn btn--primary mt-4" (click)="saveNotifPrefs()" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save Preferences' }}
          </button>
          <span *ngIf="saved()" style="color:var(--success);font-size:13px;margin-left:12px">✓ Saved</span>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    .tabs     { display:flex; gap:4px; border-bottom:1px solid var(--border); }
    .tab-btn  { padding:8px 16px; font-size:13px; font-weight:500; border:none; background:none;
                color:var(--text-muted); cursor:pointer; border-bottom:2px solid transparent;
                margin-bottom:-1px; transition:color .15s,border-color .15s;
                &:hover { color:var(--text); }
                &.active { color:var(--accent); border-bottom-color:var(--accent); } }
    .toggle { position:relative; display:inline-flex; cursor:pointer; }
    .toggle input { opacity:0; width:0; height:0; position:absolute; }
    .toggle-track { width:40px; height:22px; background:var(--surface-2); border-radius:11px;
                    border:1px solid var(--border); transition:background .2s; }
    .toggle input:checked ~ .toggle-track { background:var(--accent); border-color:var(--accent); }
    .toggle-thumb { position:absolute; top:3px; left:3px; width:16px; height:16px;
                    background:#fff; border-radius:50%; transition:left .2s; }
    .toggle input:checked ~ .toggle-track .toggle-thumb { left:21px; }
  `]
})
export class AdminSettingsComponent implements OnInit {
  private auth      = inject(AuthService);
  private firestore = inject(Firestore);
  private ls        = inject(LoyaltyService);

  rewards$!: Observable<LoyaltyReward[]>;

  activeTab    = signal<SettingsTab>('dojo');
  saving       = signal(false);
  saved        = signal(false);
  saveError    = signal('');
  copied       = signal(false);
  showAddReward = signal(false);

  dojoId = () => this.auth.currentUser()?.dojoId ?? '';

  dojo = { name: '', email: '', phone: '', address: '', timezone: 'UTC' };

  timezones = [
    { value: 'UTC',              label: 'UTC' },
    { value: 'America/New_York', label: 'Eastern (US)' },
    { value: 'America/Chicago',  label: 'Central (US)' },
    { value: 'America/Denver',   label: 'Mountain (US)' },
    { value: 'America/Los_Angeles', label: 'Pacific (US)' },
    { value: 'Europe/London',    label: 'London (GMT)' },
    { value: 'Asia/Dubai',       label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata',     label: 'India (IST)' },
    { value: 'Asia/Singapore',   label: 'Singapore (SGT)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  ];

  pointRules = [
    { icon: '✓',  label: 'Attend a class (present)',  points: 10,  key: 'attendance' },
    { icon: '⏱',  label: 'Attend a class (late)',      points: 5,   key: 'attendance_late' },
    { icon: '🔄',  label: 'Membership renewal',         points: 100, key: 'renewal' },
    { icon: '👥',  label: 'Refer a new member',          points: 200, key: 'referral' },
    { icon: '🥋',  label: 'Belt promotion',              points: 150, key: 'promotion' },
    { icon: '🎓',  label: 'Attend a seminar',            points: 50,  key: 'seminar' },
  ];

  tiers = [
    { name: 'Bronze',   threshold: 0,    color: '#cd7f32' },
    { name: 'Silver',   threshold: 500,  color: '#c0c0c0' },
    { name: 'Gold',     threshold: 1500, color: '#ffd700' },
    { name: 'Platinum', threshold: 3000, color: '#e5e4e2' },
  ];

  newReward = { name: '', type: 'discount', pointsCost: 500,
                description: '', discountPct: 10, isActive: true };

  notifPrefs = [
    { key: 'belt_awarded',     label: 'Belt Promotion',          desc: 'Notify parent when child earns a new belt',     enabled: true },
    { key: 'comment_added',    label: 'Coach Comment',           desc: 'Notify parent when coach adds a session note',  enabled: true },
    { key: 'attendance_marked',label: 'Attendance Marked',       desc: 'Notify parent when attendance is recorded',     enabled: false },
    { key: 'points_earned',    label: 'Points Earned',           desc: 'Notify parent when loyalty points are awarded', enabled: true },
    { key: 'new_message',      label: 'New Message',             desc: 'Notify coach/parent of new messages',           enabled: true },
    { key: 'objective_complete',label: 'Objective Completed',    desc: 'Notify parent when child completes an objective',enabled: true },
  ];

  tabs = [
    { key: 'dojo'          as SettingsTab, icon: '🏠', label: 'Dojo' },
    { key: 'loyalty'       as SettingsTab, icon: '⭐', label: 'Loyalty Program' },
    { key: 'notifications' as SettingsTab, icon: '🔔', label: 'Notifications' },
  ];

  ngOnInit() {
    this.rewards$ = this.ls.rewards$(this.dojoId());
    this.loadDojoSettings();
  }

  async loadDojoSettings() {
    const snap = await getDoc(doc(this.firestore, `dojos/${this.dojoId()}`));
    if (snap.exists()) {
      const d = snap.data();
      this.dojo = {
        name: d['name'] ?? '', email: d['email'] ?? '',
        phone: d['phone'] ?? '', address: d['address'] ?? '',
        timezone: d['timezone'] ?? 'UTC',
      };
    }
  }

  async saveDojo() {
    this.saving.set(true); this.saveError.set(''); this.saved.set(false);
    try {
      await setDoc(doc(this.firestore, `dojos/${this.dojoId()}`), {
        ...this.dojo, updatedAt: serverTimestamp(),
      }, { merge: true });
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 3000);
    } catch (e: any) {
      this.saveError.set(e.message ?? 'Save failed.');
    } finally { this.saving.set(false); }
  }

  async savePointRules() {
    this.saving.set(true);
    const rules = Object.fromEntries(this.pointRules.map(r => [r.key, r.points]));
    await setDoc(doc(this.firestore, `dojos/${this.dojoId()}`),
      { pointRules: rules, updatedAt: serverTimestamp() }, { merge: true });
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 3000);
    this.saving.set(false);
  }

  async saveTiers() {
    this.saving.set(true);
    const thresholds = Object.fromEntries(this.tiers.map(t => [t.name.toLowerCase(), t.threshold]));
    await setDoc(doc(this.firestore, `dojos/${this.dojoId()}`),
      { tierThresholds: thresholds, updatedAt: serverTimestamp() }, { merge: true });
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 3000);
    this.saving.set(false);
  }

  async saveNotifPrefs() {
    this.saving.set(true);
    const prefs = Object.fromEntries(this.notifPrefs.map(p => [p.key, p.enabled]));
    await setDoc(doc(this.firestore, `dojos/${this.dojoId()}`),
      { notifPrefs: prefs, updatedAt: serverTimestamp() }, { merge: true });
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 3000);
    this.saving.set(false);
  }

  async addReward() {
    if (!this.newReward.name) return;
    this.saving.set(true);
    await this.ls['firestore'] && this.ls.add({
      dojoId: this.dojoId(),
      name:        this.newReward.name,
      description: this.newReward.description,
      pointsCost:  this.newReward.pointsCost,
      type:        this.newReward.type as any,
      discountPct: this.newReward.type === 'discount' ? this.newReward.discountPct : undefined,
      isActive:    true,
    } as any);
    this.newReward = { name: '', type: 'discount', pointsCost: 500, description: '', discountPct: 10, isActive: true };
    this.showAddReward.set(false);
    this.saving.set(false);
  }

  async toggleReward(r: LoyaltyReward) {
    await this.ls.update(r.id, { isActive: !r.isActive } as any);
  }

  rewardIcon(type: string): string {
    const map: Record<string, string> = {
      discount: '💸', free_class: '🎟', merchandise: '👕', custom: '🎁',
    };
    return map[type] ?? '🎁';
  }

  async copyId() {
    await navigator.clipboard.writeText(this.dojoId());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
