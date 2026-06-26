import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where, orderBy } from '@angular/fire/firestore';
import { UserProfile, UserRole } from '../models';
import { Observable } from 'rxjs';

// UserProfile uses 'uid' not 'id', so we can't extend FirestoreBaseService directly.
// This service uses Firestore directly.
@Injectable({ providedIn: 'root' })
export class UserService {
  private firestore = inject(Firestore);

  private col() { return collection(this.firestore, 'users'); }

  byDojo$(dojoId: string): Observable<UserProfile[]> {
    return collectionData(
      query(this.col(), where('dojoId', '==', dojoId), orderBy('displayName')),
      { idField: 'uid' }
    ) as Observable<UserProfile[]>;
  }

  byRole$(dojoId: string, role: UserRole): Observable<UserProfile[]> {
    return collectionData(
      query(this.col(), where('dojoId', '==', dojoId), where('role', '==', role), orderBy('displayName')),
      { idField: 'uid' }
    ) as Observable<UserProfile[]>;
  }

  coaches$(dojoId: string) { return this.byRole$(dojoId, 'coach'); }
  parents$(dojoId: string) { return this.byRole$(dojoId, 'parent'); }
}
