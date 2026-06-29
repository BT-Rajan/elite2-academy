import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

// ─────────────────────────────────────────────────────────────────────────────
//  BaseHttpService — replaces FirestoreBaseService.
//  All feature services extend this — zero duplicate HTTP logic.
// ─────────────────────────────────────────────────────────────────────────────
export abstract class BaseHttpService<T extends { id: string | number }> {
  protected api = inject(ApiService);

  protected abstract endpoint: string;

  list$(params?: Record<string, string>): Observable<T[]> {
    return this.api.get<{ data: T[] }>(this.endpoint, params)
      .pipe(map(r => r.data));
  }

  get$(id: string | number): Observable<T> {
    return this.api.get<{ data: T }>(`${this.endpoint}/${id}`)
      .pipe(map(r => r.data));
  }

  async create(body: Partial<T>): Promise<T> {
    const res = await this.api.post<{ data: T }>(this.endpoint, body).toPromise();
    return res!.data;
  }

  async update(id: string | number, body: Partial<T>): Promise<T> {
    const res = await this.api.patch<{ data: T }>(`${this.endpoint}/${id}`, body).toPromise();
    return res!.data;
  }

  async remove(id: string | number): Promise<void> {
    await this.api.delete(`${this.endpoint}/${id}`).toPromise();
  }
}
