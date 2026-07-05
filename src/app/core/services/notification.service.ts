import { Injectable } from '@angular/core';
import { Observable, interval, of } from 'rxjs';
import { switchMap, startWith, map, distinctUntilChanged, catchError } from 'rxjs/operators';
import { BaseHttpService } from './base-http.service';
import { Notification } from '../models';

@Injectable({ providedIn: 'root' })
export class NotificationService extends BaseHttpService<Notification> {
  protected endpoint = '/notifications';

  // Poll every 30 seconds for new notifications
  forUser$(uid: string): Observable<Notification[]> {
    return interval(30000).pipe(
      startWith(0),
      switchMap(() =>
        this.api.get<{ data: Notification[] }>('/notifications', { uid })
          .pipe(map(r => r.data), catchError(() => of([] as Notification[])))
      ),
      distinctUntilChanged((a, b) => a.length === b.length &&
        a[0]?.id === b[0]?.id)
    );
  }

  async markRead(id: string): Promise<void> {
    await this.api.patch(`/notifications/${id}`, { isRead: true }).toPromise();
  }

  async markAllRead(uid: string): Promise<void> {
    await this.api.post('/notifications/mark-all-read', { uid }).toPromise();
  }
}
