import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { UserProfile, UserRole, PendingUser } from '../models';

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
  pending$(dojoId: string): Observable<PendingUser[]> {
    return this.api.get<{ data: PendingUser[] }>('/users/pending', { dojoId })
      .pipe(map(r => r.data));
  }

  async approve(uid: string): Promise<void> {
    await this.api.patch(`/users/${uid}/approve`, {}).toPromise();
  }

  async reject(uid: string): Promise<void> {
    await this.api.patch(`/users/${uid}/reject`, {}).toPromise();
  }

  // Admin-only — designates or removes a coach's Head Coach status. Head
  // Coaches can overrule other coaches' curriculum evaluations and force
  // promotions; the server independently enforces the admin-only check.
  async setHeadCoach(uid: string, isHeadCoach: boolean): Promise<void> {
    await this.api.patch(`/users/${uid}/head-coach`, { isHeadCoach }).toPromise();
  }
}
