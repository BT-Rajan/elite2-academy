import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Branch, Student, UserProfile, StudentBranchTransfer, BranchProgram } from '../models';

@Injectable({ providedIn: 'root' })
export class BranchService {
  private api = inject(ApiService);

  list$(): Observable<Branch[]> {
    return this.api.get<{ data: Branch[] }>('/branches').pipe(map(r => r.data));
  }

  get$(id: string): Observable<Branch> {
    return this.api.get<{ data: Branch }>(`/branches/${id}`).pipe(map(r => r.data));
  }

  async create(branch: Partial<Branch>): Promise<Branch> {
    const res = await this.api.post<{ data: Branch }>('/branches', branch).toPromise();
    return res!.data;
  }

  async update(id: string, branch: Partial<Branch>): Promise<Branch> {
    const res = await this.api.patch<{ data: Branch }>(`/branches/${id}`, branch).toPromise();
    return res!.data;
  }

  async deactivate(id: string): Promise<void> {
    await this.api.delete(`/branches/${id}`).toPromise();
  }

  students$(branchId: string): Observable<Student[]> {
    return this.api.get<{ data: Student[] }>(`/branches/${branchId}/students`).pipe(map(r => r.data));
  }

  coaches$(branchId: string): Observable<UserProfile[]> {
    return this.api.get<{ data: UserProfile[] }>(`/branches/${branchId}/coaches`).pipe(map(r => r.data));
  }

  programs$(branchId: string): Observable<BranchProgram[]> {
    return this.api.get<{ data: BranchProgram[] }>(`/branches/${branchId}/programs`).pipe(map(r => r.data));
  }

  // Admin/Head Coach only — assigns (or clears, by passing null) a
  // coach/staff member's home branch.
  async assignUserBranch(uid: string, branchId: string | null): Promise<void> {
    await this.api.patch(`/users/${uid}/branch`, { branchId }).toPromise();
  }

  // Admin/Staff only — moves a student to another branch, optionally
  // reassigning their discipline ("change batch") in the same call.
  async transferStudent(studentId: string, toBranchId: string, disciplineId?: string, notes?: string): Promise<Student> {
    const body: any = { toBranchId };
    if (disciplineId) body.disciplineId = disciplineId;
    if (notes) body.notes = notes;
    const res = await this.api.post<{ data: Student }>(`/students/${studentId}/transfer`, body).toPromise();
    return res!.data;
  }

  transferHistory$(studentId: string): Observable<StudentBranchTransfer[]> {
    return this.api.get<{ data: StudentBranchTransfer[] }>(`/students/${studentId}/transfers`).pipe(map(r => r.data));
  }
}
