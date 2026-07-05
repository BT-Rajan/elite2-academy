import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { UserProfile, UserRole, AccountRecord } from '../models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private api = inject(ApiService);

  byDojo$(dojoId: string): Observable<UserProfile[]> {
    return this.api.get<{ data: UserProfile[] }>('/users', { dojoId })
      .pipe(map(r => r.data));
  }

  byRole$(dojoId: string, role: UserRole): Observable<UserProfile[]> {
    return this.api.get<{ data: UserProfile[] }>('/users', { dojoId, role })
      .pipe(map(r => r.data));
  }

  coaches$(dojoId: string) { return this.byRole$(dojoId, 'coach'); }
  parents$(dojoId: string) { return this.byRole$(dojoId, 'parent'); }
  staff$(dojoId: string)   { return this.byRole$(dojoId, 'staff'); }

  // Accounts awaiting approval (see AuthController::register / the
  // approval-workflow security pass). dojoId param is accepted for
  // consistency with the other list methods but the server always scopes
  // to the caller's own dojo regardless of what's passed here.
  pending$(dojoId: string): Observable<AccountRecord[]> {
    return this.api.get<{ data: AccountRecord[] }>('/users/pending', { dojoId })
      .pipe(map(r => r.data));
  }

  // Full account lifecycle: every sign-up regardless of approval_status,
  // plus is_active/is_head_coach — used for the Approvals history view.
  history$(dojoId: string): Observable<AccountRecord[]> {
    return this.api.get<{ data: AccountRecord[] }>('/users/history', { dojoId })
      .pipe(map(r => r.data));
  }

  async approve(uid: string): Promise<void> {
    await this.api.patch(`/users/${uid}/approve`, {}).toPromise();
  }

  async reject(uid: string): Promise<void> {
    await this.api.patch(`/users/${uid}/reject`, {}).toPromise();
  }

  // Head Coach/Admin only — revokes access without deleting the account.
  // Takes effect on the target's very next request (see AuthMiddleware).
  async block(uid: string): Promise<void> {
    await this.api.patch(`/users/${uid}/block`, {}).toPromise();
  }

  async unblock(uid: string): Promise<void> {
    await this.api.patch(`/users/${uid}/unblock`, {}).toPromise();
  }

  // Head Coach/Admin only — a coach who should no longer hold coaching
  // duties/permissions but stays employed. Coach -> staff only.
  async downgradeToStaff(uid: string): Promise<void> {
    await this.api.patch(`/users/${uid}/downgrade-to-staff`, {}).toPromise();
  }

  // Admin-only — designates or removes a coach's Head Coach status. Head
  // Coaches can overrule other coaches' curriculum evaluations and force
  // promotions; the server independently enforces the admin-only check.
  async setHeadCoach(uid: string, isHeadCoach: boolean): Promise<void> {
    await this.api.patch(`/users/${uid}/head-coach`, { isHeadCoach }).toPromise();
  }
}
