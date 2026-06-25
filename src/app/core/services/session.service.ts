import { Injectable } from '@angular/core';
import { FirestoreBaseService } from './firestore-base.service';
import { ClassSession, SessionComment } from '../models';
import { collection, addDoc, query, where, orderBy, collectionData, serverTimestamp } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionService extends FirestoreBaseService<ClassSession> {
  protected collectionPath = 'sessions';

  byDojo$(dojoId: string) {
    return this.list$([this.byDojo(dojoId), this.orderByField('date', 'desc'), this.limitTo(30)]);
  }

  byCoach$(coachUid: string) {
    return this.list$([this.byField('coachUid', coachUid), this.orderByField('date', 'desc'), this.limitTo(30)]);
  }

  // Session comments live in a subcollection
  comments$(sessionId: string): Observable<SessionComment[]> {
    const ref = collection(this.firestore, `sessions/${sessionId}/comments`);
    return collectionData(query(ref, orderBy('createdAt', 'asc')), { idField: 'id' }) as Observable<SessionComment[]>;
  }

  async addComment(sessionId: string, comment: Omit<SessionComment, 'id'>): Promise<string> {
    const ref = collection(this.firestore, `sessions/${sessionId}/comments`);
    const d = await addDoc(ref, { ...comment, createdAt: serverTimestamp() });
    return d.id;
  }
}
