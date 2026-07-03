import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { UserProfile, UserRole } from '../models';

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

  // Admin-only — designates or removes a coach's Head Coach status. Head
  // Coaches can overrule other coaches' curriculum evaluations and force
  // promotions; the server independently enforces the admin-only check.
  async setHeadCoach(uid: string, isHeadCoach: boolean): Promise<void> {
    await this.api.patch(`/users/${uid}/head-coach`, { isHeadCoach }).toPromise();
  }
}
