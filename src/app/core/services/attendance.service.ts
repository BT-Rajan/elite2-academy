import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, updateDoc, doc } from '@angular/fire/firestore';
import { FirestoreBaseService } from './firestore-base.service';
import { AttendanceRecord, AttendanceStatus, SessionComment } from '../models';
import { inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AttendanceService extends FirestoreBaseService<AttendanceRecord> {
  protected collectionPath = 'attendance';

  bySession$(sessionId: string) {
    return this.list$([this.byField('sessionId', sessionId)]);
  }

  byStudent$(studentId: string) {
    return this.list$([this.byField('studentId', studentId), this.orderByField('markedAt', 'desc'), this.limitTo(50)]);
  }

  async markAll(records: Omit<AttendanceRecord, 'id'>[]): Promise<void> {
    await Promise.all(records.map(r => this.add(r)));
  }
}
