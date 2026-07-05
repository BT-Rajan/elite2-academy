import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseHttpService } from './base-http.service';
import { Branch } from '../models';

@Injectable({ providedIn: 'root' })
export class BranchService extends BaseHttpService<Branch> {
  protected endpoint = '/branches';

  students$(branchId: string): Observable<any[]> {
    return this.api.get<{ data: any[] }>(`/branches/${branchId}/students`).pipe(map(r => r.data));
  }

  coaches$(branchId: string): Observable<any[]> {
    return this.api.get<{ data: any[] }>(`/branches/${branchId}/coaches`).pipe(map(r => r.data));
  }

  programs$(branchId: string): Observable<any[]> {
    return this.api.get<{ data: any[] }>(`/branches/${branchId}/programs`).pipe(map(r => r.data));
  }

  async transferStudent(studentId: string, toBranchId: string, notes?: string, disciplineId?: string): Promise<void> {
    await this.api.post(`/students/${studentId}/transfer`, { toBranchId, notes, disciplineId }).toPromise();
  }

  async assignUserBranch(uid: string, branchId: string | null): Promise<void> {
    await this.api.patch(`/users/${uid}/branch`, { branchId }).toPromise();
  }
}
