import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, doc, updateDoc, query, where, orderBy, serverTimestamp } from '@angular/fire/firestore';
import { FirestoreBaseService } from './firestore-base.service';
import { MessageThread, Message } from '../models';
import { Observable } from 'rxjs';
import { inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MessageService extends FirestoreBaseService<MessageThread> {
  protected collectionPath = 'threads';

  threadsForCoach$(coachUid: string) {
    return this.list$([this.byField('coachUid', coachUid), this.orderByField('lastAt', 'desc')]);
  }

  threadsForParent$(parentUid: string) {
    return this.list$([this.byField('parentUid', parentUid), this.orderByField('lastAt', 'desc')]);
  }

  messages$(threadId: string): Observable<Message[]> {
    const ref = collection(this.firestore, `threads/${threadId}/messages`);
    return collectionData(query(ref, orderBy('sentAt', 'asc')), { idField: 'id' }) as Observable<Message[]>;
  }

  async send(threadId: string, msg: Omit<Message, 'id'>): Promise<void> {
    const msgRef = collection(this.firestore, `threads/${threadId}/messages`);
    await addDoc(msgRef, { ...msg, sentAt: serverTimestamp() });
    await updateDoc(doc(this.firestore, `threads/${threadId}`), {
      lastMessage: msg.text,
      lastAt: serverTimestamp(),
      [`unread${msg.fromRole === 'coach' ? 'Parent' : 'Coach'}`]: 0,
    });
  }

  async markRead(threadId: string, role: 'coach' | 'parent'): Promise<void> {
    await updateDoc(doc(this.firestore, `threads/${threadId}`), {
      [`unread${role === 'coach' ? 'Coach' : 'Parent'}`]: 0,
    });
  }
}
