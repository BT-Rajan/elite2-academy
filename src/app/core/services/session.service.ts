import { Injectable } from '@angular/core';
import { BaseHttpService } from './base-http.service';
import { ClassSession, SessionComment } from '../models';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class SessionService extends BaseHttpService<ClassSession> {
  protected endpoint = '/sessions';

  byCoach$(coachUid: string): Observable<ClassSession[]> {
    return this.list$({ coachUid });
  }

  byDojo$(dojoId: string): Observable<ClassSession[]> {
    return this.list$({ dojoId });
  }

  comments$(sessionId: string): Observable<SessionComment[]> {
    return this.api.get<{ data: SessionComment[] }>(`/sessions/${sessionId}/comments`)
      .pipe(map(r => r.data));
  }

  async addComment(sessionId: string, comment: Partial<SessionComment>): Promise<string> {
    const res = await this.api.post<{ data: SessionComment }>(
      `/sessions/${sessionId}/comments`, comment
    ).toPromise();
    return String(res!.data.id);
  }
}
