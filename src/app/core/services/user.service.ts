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
}
