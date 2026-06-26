import { Injectable } from '@angular/core';
import { FirestoreBaseService } from './firestore-base.service';
import { ClassSchedule } from '../models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ScheduleService extends FirestoreBaseService<ClassSchedule> {
  protected collectionPath = 'schedules';

  byDojo$(dojoId: string): Observable<ClassSchedule[]> {
    return this.list$([
      this.byField('dojoId', dojoId),
      this.byField('isActive', true),
      this.orderByField('dayOfWeek'),
    ]);
  }

  public$(dojoId: string): Observable<ClassSchedule[]> {
    return this.byDojo$(dojoId);
  }
}
