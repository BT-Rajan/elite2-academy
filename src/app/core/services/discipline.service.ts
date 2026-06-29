import { Injectable } from '@angular/core';
import { BaseHttpService } from './base-http.service';
import { Discipline, Belt } from '../models';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class DisciplineService extends BaseHttpService<Discipline> {
  protected endpoint = '/disciplines';

  byDojo$(dojoId: string): Observable<Discipline[]> {
    return this.list$({ dojoId });
  }

  belts$(disciplineId: string): Observable<Belt[]> {
    return this.api.get<{ data: Belt[] }>(`/disciplines/${disciplineId}/belts`)
      .pipe(map(r => r.data));
  }

  async addBelt(disciplineId: string, belt: Partial<Belt>): Promise<string> {
    const res = await this.api.post<{ data: Belt }>(`/disciplines/${disciplineId}/belts`, belt).toPromise();
    return String(res!.data.id);
  }

  async updateBelt(disciplineId: string, beltId: string, data: Partial<Belt>): Promise<void> {
    await this.api.patch(`/disciplines/${disciplineId}/belts/${beltId}`, data).toPromise();
  }
}
