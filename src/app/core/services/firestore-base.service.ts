import { inject } from '@angular/core';
import {
  Firestore, collection, collectionData, doc, docData,
  addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, QueryConstraint,
  serverTimestamp, DocumentReference, CollectionReference
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// ─────────────────────────────────────────────────────────────────────────────
//  Base class — all feature services extend this, no duplicate CRUD code
// ─────────────────────────────────────────────────────────────────────────────
export abstract class FirestoreBaseService<T extends { id: string }> {
  protected firestore = inject(Firestore);

  protected abstract collectionPath: string;

  protected col(): CollectionReference {
    return collection(this.firestore, this.collectionPath);
  }

  protected docRef(id: string): DocumentReference {
    return doc(this.firestore, `${this.collectionPath}/${id}`);
  }

  list$(constraints: QueryConstraint[] = []): Observable<T[]> {
    const q = constraints.length
      ? query(this.col(), ...constraints)
      : query(this.col());
    return collectionData(q, { idField: 'id' }) as Observable<T[]>;
  }

  get$(id: string): Observable<T | undefined> {
    return docData(this.docRef(id), { idField: 'id' }) as Observable<T | undefined>;
  }

  async add(data: Omit<T, 'id'>): Promise<string> {
    const ref = await addDoc(this.col(), { ...data, createdAt: serverTimestamp() });
    return ref.id;
  }

  async set(id: string, data: Omit<T, 'id'>): Promise<void> {
    await setDoc(this.docRef(id), { ...data, updatedAt: serverTimestamp() });
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    await updateDoc(this.docRef(id), { ...data, updatedAt: serverTimestamp() });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }

  // ── Query helpers ──────────────────────────────────────────
  protected byDojo(dojoId: string) { return where('dojoId', '==', dojoId); }
  protected byField(field: string, value: unknown) { return where(field, '==', value); }
  protected orderByField(field: string, dir: 'asc'|'desc' = 'asc') { return orderBy(field, dir); }
  protected limitTo(n: number) { return limit(n); }
}
