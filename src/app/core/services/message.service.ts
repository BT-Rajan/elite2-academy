import { Injectable, inject } from '@angular/core';
import { Observable, interval } from 'rxjs';
import { switchMap, startWith, distinctUntilChanged, map } from 'rxjs/operators';
import { BaseHttpService } from './base-http.service';
import { MessageThread, Message } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class MessageService extends BaseHttpService<MessageThread> {
  protected endpoint = '/threads';

  threadsForCoach$(coachUid: string): Observable<MessageThread[]> {
    return this.list$({ coachUid });
  }

  threadsForParent$(parentUid: string): Observable<MessageThread[]> {
    return this.list$({ parentUid });
  }

  // Poll every 5 seconds for new messages (replaces Firestore real-time)
  messages$(threadId: string): Observable<Message[]> {
    return interval(5000).pipe(
      startWith(0),
      switchMap(() =>
        this.api.get<{ data: Message[] }>(`/threads/${threadId}/messages`)
          .pipe(map(r => r.data))
      ),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    );
  }

  async send(threadId: string, msg: Partial<Message>): Promise<void> {
    await this.api.post(`/threads/${threadId}/messages`, msg).toPromise();
  }

  async markRead(threadId: string, role: 'coach' | 'parent'): Promise<void> {
    await this.api.patch(`/threads/${threadId}/read`, { role }).toPromise();
  }
}
