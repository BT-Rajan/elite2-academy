import { Injectable } from '@angular/core';
import { BaseHttpService } from './base-http.service';
import { AttendanceRecord } from '../models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AttendanceService extends BaseHttpService<AttendanceRecord> {
  protected endpoint = '/attendance';

  bySession$(sessionId: string): Observable<AttendanceRecord[]> {
    return this.list$({ sessionId });
  }

  byStudent$(studentId: string): Observable<AttendanceRecord[]> {
    return this.list$({ studentId, limit: '50', sort: 'desc' });
  }

  // Dojo-wide attendance for reporting/drill-down. Capped at 200 by the
  // backend (AttendanceController::listAttendance) -- fine for a first
  // cut of this report; a dojo generating more than 200 attendance marks
  // in a reporting window would need real pagination, which is a bigger
  // change than this report currently needs.
  byDojo$(): Observable<AttendanceRecord[]> {
    return this.list$({ limit: '200' });
  }

  async markAll(records: Partial<AttendanceRecord>[]): Promise<void> {
    await this.api.post('/attendance/bulk', { records }).toPromise();
  }
}
