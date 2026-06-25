import { Injectable } from '@angular/core';
import { FirestoreBaseService } from './firestore-base.service';
import { Student } from '../models';

@Injectable({ providedIn: 'root' })
export class StudentService extends FirestoreBaseService<Student> {
  protected collectionPath = 'students';

  byParent$(parentUid: string) {
    return this.list$([this.byField('parentUid', parentUid), this.byField('isActive', true)]);
  }

  byDojo$(dojoId: string) {
    return this.list$([this.byDojo(dojoId), this.byField('isActive', true), this.orderByField('firstName')]);
  }

  byCoach$(dojoId: string) {
    return this.byDojo$(dojoId);
  }
}
