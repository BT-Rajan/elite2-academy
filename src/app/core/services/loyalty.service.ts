import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, query, where, orderBy, collectionData, serverTimestamp, increment } from '@angular/fire/firestore';
import { FirestoreBaseService } from './firestore-base.service';
import { LoyaltyAccount, LoyaltyTransaction, LoyaltyReason, LoyaltyReward } from '../models';
import { Observable } from 'rxjs';
import { inject } from '@angular/core';

const TIER_THRESHOLDS = { bronze: 0, silver: 500, gold: 1500, platinum: 3000 };

@Injectable({ providedIn: 'root' })
export class LoyaltyService extends FirestoreBaseService<LoyaltyAccount> {
  protected collectionPath = 'loyalty';

  account$(parentUid: string): Observable<LoyaltyAccount | undefined> {
    return this.get$(parentUid);
  }

  transactions$(parentUid: string): Observable<LoyaltyTransaction[]> {
    const ref = collection(this.firestore, `loyalty/${parentUid}/transactions`);
    return collectionData(query(ref, orderBy('createdAt', 'desc'), ), { idField: 'id' }) as Observable<LoyaltyTransaction[]>;
  }

  rewards$(dojoId: string): Observable<LoyaltyReward[]> {
    const ref = collection(this.firestore, 'loyalty_rewards');
    return collectionData(query(ref, where('dojoId', '==', dojoId), where('isActive', '==', true)), { idField: 'id' }) as Observable<LoyaltyReward[]>;
  }

  async award(parentUid: string, dojoId: string, amount: number, reason: LoyaltyReason, note?: string): Promise<void> {
    const acctRef = doc(this.firestore, `loyalty/${parentUid}`);
    const snap = await getDoc(acctRef);

    if (!snap.exists()) {
      await setDoc(acctRef, {
        id: parentUid, dojoId, points: amount,
        lifetimePoints: amount, tier: 'bronze',
      });
    } else {
      const newLifetime = (snap.data()['lifetimePoints'] ?? 0) + Math.max(0, amount);
      const tier = this.calcTier(newLifetime);
      await updateDoc(acctRef, {
        points: increment(amount),
        lifetimePoints: increment(Math.max(0, amount)),
        tier,
      });
    }

    await addDoc(collection(this.firestore, `loyalty/${parentUid}/transactions`), {
      accountId: parentUid, amount, reason, note: note ?? '',
      createdAt: serverTimestamp(),
    });
  }

  async redeem(parentUid: string, reward: LoyaltyReward): Promise<void> {
    await this.award(parentUid, reward.dojoId, -reward.pointsCost, 'redemption', `Redeemed: ${reward.name}`);
  }

  private calcTier(lifetime: number): LoyaltyAccount['tier'] {
    if (lifetime >= TIER_THRESHOLDS.platinum) return 'platinum';
    if (lifetime >= TIER_THRESHOLDS.gold)     return 'gold';
    if (lifetime >= TIER_THRESHOLDS.silver)   return 'silver';
    return 'bronze';
  }
}
