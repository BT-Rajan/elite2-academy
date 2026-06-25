import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, query, where, orderBy, serverTimestamp, doc, updateDoc } from '@angular/fire/firestore';
import { FirestoreBaseService } from './firestore-base.service';
import { Belt, BeltHistory, StudentObjective } from '../models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BeltService extends FirestoreBaseService<Belt> {
  protected collectionPath = 'belts';

  byDiscipline$(disciplineId: string): Observable<Belt[]> {
    return this.list$([this.byField('disciplineId', disciplineId), this.orderByField('sortOrder')]);
  }

  history$(studentId: string): Observable<BeltHistory[]> {
    const ref = collection(this.firestore, `students/${studentId}/beltHistory`);
    return collectionData(query(ref, orderBy('awardedAt', 'desc')), { idField: 'id' }) as Observable<BeltHistory[]>;
  }

  async award(studentId: string, entry: Omit<BeltHistory, 'id'>): Promise<void> {
    const ref = collection(this.firestore, `students/${studentId}/beltHistory`);
    await addDoc(ref, { ...entry, awardedAt: serverTimestamp() });
    await updateDoc(doc(this.firestore, `students/${studentId}`), {
      currentBeltId: entry.beltId,
      updatedAt: serverTimestamp(),
    });
  }

  objectives$(studentId: string): Observable<StudentObjective[]> {
    const ref = collection(this.firestore, `students/${studentId}/objectives`);
    return collectionData(query(ref, orderBy('isComplete'), ), { idField: 'id' }) as Observable<StudentObjective[]>;
  }

  async addObjective(studentId: string, obj: Omit<StudentObjective, 'id'>): Promise<void> {
    const ref = collection(this.firestore, `students/${studentId}/objectives`);
    await addDoc(ref, { ...obj, createdAt: serverTimestamp() });
  }

  async completeObjective(studentId: string, objId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `students/${studentId}/objectives/${objId}`), {
      isComplete: true, completedAt: serverTimestamp(),
    });
  }
}
