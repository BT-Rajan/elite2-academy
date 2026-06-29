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

  async markAll(records: Partial<AttendanceRecord>[]): Promise<void> {
    await this.api.post('/attendance/bulk', { records }).toPromise();
  }
}
