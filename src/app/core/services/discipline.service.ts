import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, query, orderBy, addDoc, updateDoc, doc, serverTimestamp } from '@angular/fire/firestore';
import { FirestoreBaseService } from './firestore-base.service';
import { Discipline, Belt } from '../models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DisciplineService extends FirestoreBaseService<Discipline> {
  protected collectionPath = 'disciplines';

  byDojo$(dojoId: string): Observable<Discipline[]> {
    return this.list$([this.byDojo(dojoId), this.orderByField('name')]);
  }

  belts$(disciplineId: string): Observable<Belt[]> {
    const ref = collection(this.firestore, `disciplines/${disciplineId}/belts`);
    return collectionData(query(ref, orderBy('sortOrder')), { idField: 'id' }) as Observable<Belt[]>;
  }

  async addBelt(disciplineId: string, belt: Omit<Belt, 'id'>): Promise<string> {
    const ref = collection(this.firestore, `disciplines/${disciplineId}/belts`);
    const d = await addDoc(ref, { ...belt, createdAt: serverTimestamp() });
    return d.id;
  }

  async updateBelt(disciplineId: string, beltId: string, data: Partial<Belt>): Promise<void> {
    await updateDoc(doc(this.firestore, `disciplines/${disciplineId}/belts/${beltId}`), data);
  }
}
