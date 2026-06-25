import { Injectable } from '@angular/core';
import { Firestore, updateDoc, doc, serverTimestamp } from '@angular/fire/firestore';
import { FirestoreBaseService } from './firestore-base.service';
import { Notification } from '../models';

@Injectable({ providedIn: 'root' })
export class NotificationService extends FirestoreBaseService<Notification> {
  protected collectionPath = 'notifications';

  forUser$(uid: string) {
    return this.list$([
      this.byField('uid', uid),
      this.orderByField('createdAt', 'desc'),
      this.limitTo(50),
    ]);
  }

  async markRead(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, `notifications/${id}`), {
      isRead: true, readAt: serverTimestamp(),
    });
  }

  async markAllRead(uid: string): Promise<void> {
    const all = await this.list$([this.byField('uid', uid), this.byField('isRead', false)])
      .toPromise();
    await Promise.all((all ?? []).map(n => this.markRead(n.id)));
  }
}
