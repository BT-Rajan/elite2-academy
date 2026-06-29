import { Injectable } from '@angular/core';
import { BaseHttpService } from './base-http.service';
import { ClassSchedule } from '../models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ScheduleService extends BaseHttpService<ClassSchedule> {
  protected endpoint = '/schedules';

  byDojo$(dojoId: string): Observable<ClassSchedule[]> {
    return this.list$({ dojoId, isActive: 'true' });
  }

  public$(dojoId: string): Observable<ClassSchedule[]> {
    return this.byDojo$(dojoId);
  }
}
