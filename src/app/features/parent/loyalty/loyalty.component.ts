import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { LoyaltyService } from '../../../core/services/loyalty.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoyaltyAccount, LoyaltyTransaction, LoyaltyReward } from '../../../core/models';
import { LOYALTY_TIER_COLORS } from '../../../core/utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];
const TIER_THRESHOLDS: Record<string, number> = {
  bronze: 0, silver: 500, gold: 1500, platinum: 3000
};
const TIER_ICONS: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎'
};

@Component({
  selector: 'app-loyalty',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, TitleCasePipe,
            PageHeaderComponent, EmptyStateComponent, TimeAgoPipe],
  template: `
    <dojo-page-header title="Loyalty & Rewards"
      subtitle="Earn points, unlock rewards and discounts">
    </dojo-page-header>

    <ng-container *ngIf="account$ | async as acct; else noAccount">

      <!-- Balance hero -->
      <div class="card mb-6 balance-hero">
        <div class="hero-left">
          <div class="hero-points">{{ acct.points }}</div>
          <div class="hero-label">available points</div>
          <div class="hero-lifetime text-muted text-sm">
            {{ acct.lifetimePoints }} lifetime points
          </div>
        </div>
        <div class="hero-right">
          <div class="tier-badge" [style.color]="tierColor(acct.tier)">
            {{ tierIcon(acct.tier) }} {{ acct.tier | titlecase }}
          </div>
          <!-- Tier progress bar -->
          <div *ngIf="nextTier(acct.tier) as nt" style="margin-top:12px">
            <div style="display:flex;justify-content:space-between;font-size:12px;
                        color:var(--text-muted);margin-bottom:6px">
              <span>{{ acct.tier | titlecase }}</span>
              <span>{{ nt.name | titlecase }} at {{ nt.threshold }} pts</span>
            </div>
            <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
              <div style="height:100%;border-radius:4px;transition:width .6s ease"
                [style.width.%]="tierProgress(acct)"
                [style.background]="tierColor(acct.tier)">
              </div>
            </div>
            <div class="text-muted text-sm" style="margin-top:4px">
              {{ nt.threshold - acct.lifetimePoints }} more points to {{ nt.name | titlecase }}
            </div>
          </div>
          <div *ngIf="!nextTier(acct.tier)" style="margin-top:8px">
            <span class="badge badge--accent">🏆 Maximum tier reached!</span>
          </div>
        </div>
      </div>

      <!-- How to earn -->
      <div class="card mb-6">
        <div class="card__header"><span class="card__title">How to Earn Points</span></div>
        <div class="card__body">
          <div class="earn-grid">
            <div class="earn-item" *ngFor="let e of earningRules">
              <div class="earn-icon">{{ e.icon }}</div>
              <div>
                <div style="font-weight:600;font-size:13px">{{ e.label }}</div>
                <div class="text-accent" style="font-size:18px;font-weight:700">+{{ e.points }} pts</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rewards catalogue -->
      <div class="card mb-6">
        <div class="card__header">
          <span class="card__title">Rewards Catalogue</span>
          <span class="text-muted text-sm">{{ acct.points }} pts available</span>
        </div>
        <div *ngIf="rewards$ | async as rewards">
          <dojo-empty-state *ngIf="rewards.length === 0"
            icon="🎁" title="No rewards available yet"
            subtitle="Your dojo admin will add rewards to this catalogue.">
          </dojo-empty-state>
          <div class="rewards-grid" *ngIf="rewards.length > 0">
            <div *ngFor="let r of rewards" class="reward-card"
              [class.reward-card--locked]="acct.points < r.pointsCost">
              <div class="reward-icon">{{ rewardIcon(r.type) }}</div>
              <div class="reward-body">
                <div class="reward-name">{{ r.name }}</div>
                <div class="text-muted text-sm">{{ r.description }}</div>
                <div *ngIf="r.discountPct" style="color:var(--success);font-size:13px;margin-top:4px">
                  {{ r.discountPct }}% off
                </div>
              </div>
              <div class="reward-action">
                <div class="reward-cost" [style.color]="acct.points >= r.pointsCost ? 'var(--accent)' : 'var(--text-dim)'">
                  {{ r.pointsCost }} pts
                </div>
                <button class="btn btn--sm"
                  [class.btn--primary]="acct.points >= r.pointsCost"
                  [class.btn--secondary]="acct.points < r.pointsCost"
                  [disabled]="acct.points < r.pointsCost || redeeming()"
                  (click)="redeem(acct, r)">
                  {{ acct.points >= r.pointsCost ? 'Redeem' : 'Locked' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Transaction history -->
      <div class="card">
        <div class="card__header"><span class="card__title">Points History</span></div>
        <div *ngIf="transactions$ | async as txs">
          <dojo-empty-state *ngIf="txs.length === 0"
            icon="📋" title="No transactions yet"
            subtitle="Points earned and redeemed will appear here.">
          </dojo-empty-state>
          <table *ngIf="txs.length > 0">
            <thead>
              <tr><th>Date</th><th>Reason</th><th>Note</th><th style="text-align:right">Points</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let tx of txs">
                <td class="text-muted">{{ tx.createdAt | date:'MMM d, y' }}</td>
                <td>
                  <span class="badge"
                    [class.badge--success]="tx.amount > 0"
                    [class.badge--danger]="tx.amount < 0">
                    {{ tx.reason | titlecase }}
                  </span>
                </td>
                <td class="text-muted text-sm">{{ tx.note || '—' }}</td>
                <td style="text-align:right;font-weight:700"
                  [style.color]="tx.amount > 0 ? 'var(--success)' : 'var(--danger)'">
                  {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ng-container>

    <!-- No loyalty account yet -->
    <ng-template #noAccount>
      <div class="card">
        <div class="card__body" style="text-align:center;padding:48px">
          <div style="font-size:48px;margin-bottom:16px">⭐</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">Start earning today</div>
          <div class="text-muted">Your loyalty account is created automatically when you
            first attend a class.</div>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .balance-hero { display:flex; align-items:stretch; gap:0; padding:0; overflow:hidden; }
    .hero-left    { flex:1; padding:28px; border-right:1px solid var(--border); }
    .hero-right   { flex:1; padding:28px; }
    .hero-points  { font-size:56px; font-weight:800; color:var(--accent); line-height:1; }
    .hero-label   { font-size:14px; color:var(--text-muted); margin-top:4px; }
    .hero-lifetime{ margin-top:6px; }
    .tier-badge   { font-size:22px; font-weight:700; }

    .earn-grid  { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px; }
    .earn-item  { display:flex; align-items:center; gap:12px; padding:16px;
                  background:var(--surface-2); border-radius:var(--radius-md); }
    .earn-icon  { font-size:28px; width:44px; text-align:center; }

    .rewards-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
                    gap:0; }
    .reward-card  { display:flex; align-items:center; gap:14px; padding:16px 20px;
                    border-bottom:1px solid var(--border); transition:background .15s;
                    &:hover { background:var(--surface-2); }
                    &--locked { opacity:.6; } }
    .reward-icon  { font-size:28px; width:44px; text-align:center; flex-shrink:0; }
    .reward-body  { flex:1; min-width:0; }
    .reward-name  { font-weight:600; font-size:14px; margin-bottom:2px; }
    .reward-action{ display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0; }
    .reward-cost  { font-size:13px; font-weight:700; }

    @media (max-width:640px) {
      .balance-hero { flex-direction:column; }
      .hero-left { border-right:none; border-bottom:1px solid var(--border); }
    }
  `]
})
export class LoyaltyComponent implements OnInit {
  private auth  = inject(AuthService);
  private ls    = inject(LoyaltyService);
  private toast = inject(ToastService);

  account$!:      Observable<LoyaltyAccount | undefined>;
  transactions$!: Observable<LoyaltyTransaction[]>;
  rewards$!:      Observable<LoyaltyReward[]>;
  redeeming       = signal(false);

  earningRules = [
    { icon: '✓',  label: 'Attend a class',     points: 10  },
    { icon: '⏱',  label: 'Late attendance',     points: 5   },
    { icon: '🔄',  label: 'Membership renewal',  points: 100 },
    { icon: '👥',  label: 'Refer a friend',       points: 200 },
    { icon: '🥋',  label: 'Belt promotion',       points: 150 },
    { icon: '🎓',  label: 'Attend a seminar',     points: 50  },
  ];

  ngOnInit() {
    const uid    = this.auth.currentUser()!.uid;
    const dojoId = this.auth.currentUser()!.dojoId;
    this.account$      = this.ls.account$(uid);
    this.transactions$ = this.ls.transactions$(uid);
    this.rewards$      = this.ls.rewards$(dojoId);
  }

  tierColor  = (t: string) => LOYALTY_TIER_COLORS[t] ?? '#888';
  tierIcon   = (t: string) => TIER_ICONS[t] ?? '⭐';

  nextTier(current: string): { name: string; threshold: number } | null {
    const idx = TIER_ORDER.indexOf(current);
    if (idx === -1 || idx === TIER_ORDER.length - 1) return null;
    const name = TIER_ORDER[idx + 1];
    return { name, threshold: TIER_THRESHOLDS[name] };
  }

  tierProgress(acct: LoyaltyAccount): number {
    const current  = TIER_THRESHOLDS[acct.tier] ?? 0;
    const nt       = this.nextTier(acct.tier);
    if (!nt) return 100;
    const range    = nt.threshold - current;
    const progress = acct.lifetimePoints - current;
    return Math.min(100, Math.round(progress / range * 100));
  }

  rewardIcon(type: string): string {
    const map: Record<string, string> = {
      discount:    '💸', free_class: '🎟',
      merchandise: '👕', custom:     '🎁',
    };
    return map[type] ?? '🎁';
  }

  async redeem(acct: LoyaltyAccount, reward: LoyaltyReward) {
    if (acct.points < reward.pointsCost) return;
    this.redeeming.set(true);
    try {
      await this.ls.redeem(acct.id, reward);
      this.toast.success(`Redeemed: ${reward.name}!`);
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not redeem reward.');
    } finally {
      this.redeeming.set(false);
    }
  }
}
