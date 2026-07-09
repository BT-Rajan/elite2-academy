import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseHttpService } from './base-http.service';
import { LoyaltyAccount, LoyaltyTransaction, LoyaltyReward } from '../models';

@Injectable({ providedIn: 'root' })
export class LoyaltyService extends BaseHttpService<LoyaltyAccount> {
  protected endpoint = '/loyalty';

  account$(parentUid: string): Observable<LoyaltyAccount | undefined> {
    return this.api.get<{ data: LoyaltyAccount }>(`/loyalty/${parentUid}`)
      .pipe(map(r => r.data));
  }

  transactions$(parentUid: string): Observable<LoyaltyTransaction[]> {
    return this.api.get<{ data: LoyaltyTransaction[] }>(`/loyalty/${parentUid}/transactions`)
      .pipe(map(r => r.data));
  }

  rewards$(dojoId: string): Observable<LoyaltyReward[]> {
    return this.api.get<{ data: LoyaltyReward[] }>('/loyalty-rewards', { dojoId })
      .pipe(map(r => r.data));
  }

  // Dojo-wide list, for reporting (tier distribution, etc). Admin/coach/
  // staff only -- a plain parent can't see other families' point totals.
  accounts$(): Observable<LoyaltyAccount[]> {
    return this.api.get<{ data: LoyaltyAccount[] }>('/loyalty-accounts')
      .pipe(map(r => r.data));
  }

  async award(parentUid: string, dojoId: string, amount: number, reason: string, note?: string): Promise<void> {
    await this.api.post(`/loyalty/${parentUid}/award`, { dojoId, amount, reason, note }).toPromise();
  }

  async redeem(parentUid: string, reward: LoyaltyReward): Promise<void> {
    await this.api.post(`/loyalty/${parentUid}/redeem`, { rewardId: reward.id }).toPromise();
  }
}
