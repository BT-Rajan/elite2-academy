import { Injectable } from '@angular/core';
import { BaseHttpService } from './base-http.service';
import { Student, SessionComment } from '../models';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class StudentService extends BaseHttpService<Student> {
  protected endpoint = '/students';

  byParent$(parentUid: string): Observable<Student[]> {
    return this.list$({ parentUid });
  }

  byDojo$(dojoId: string): Observable<Student[]> {
    return this.list$({ dojoId });
  }

  // All session comments for this student, across every session — not session-scoped
  comments$(studentId: string): Observable<SessionComment[]> {
    return this.api.get<{ data: SessionComment[] }>(`/students/${studentId}/comments`)
      .pipe(map(r => r.data));
  }

  async addComment(studentId: string, comment: Partial<SessionComment>): Promise<void> {
    await this.api.post(`/students/${studentId}/comments`, comment).toPromise();
  }
}
