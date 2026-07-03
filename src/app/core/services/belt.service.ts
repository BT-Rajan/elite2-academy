import { Injectable } from '@angular/core';
import { BaseHttpService } from './base-http.service';
import { Belt, BeltHistory, StudentObjective } from '../models';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class BeltService extends BaseHttpService<Belt> {
  protected endpoint = '/belts';

  // Full curriculum roadmap for a discipline: each belt with its
  // Striking/Grappling/Self-Defense syllabus attached, in belt order.
  roadmap$(disciplineId: string): Observable<Belt[]> {
    return this.api.get<{ data: Belt[] }>(`/disciplines/${disciplineId}/roadmap`)
      .pipe(map(r => r.data));
  }

  history$(studentId: string): Observable<BeltHistory[]> {
    return this.api.get<{ data: BeltHistory[] }>(`/students/${studentId}/belt-history`)
      .pipe(map(r => r.data));
  }

  async award(studentId: string, entry: Partial<BeltHistory>): Promise<void> {
    await this.api.post(`/students/${studentId}/belt-history`, entry).toPromise();
  }

  objectives$(studentId: string): Observable<StudentObjective[]> {
    return this.api.get<{ data: StudentObjective[] }>(`/students/${studentId}/objectives`)
      .pipe(map(r => r.data));
  }

  async addObjective(studentId: string, obj: Partial<StudentObjective>): Promise<void> {
    await this.api.post(`/students/${studentId}/objectives`, obj).toPromise();
  }

  async completeObjective(studentId: string, objId: string): Promise<void> {
    await this.api.patch(`/students/${studentId}/objectives/${objId}`, { isComplete: true }).toPromise();
  }
}
