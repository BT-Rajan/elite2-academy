import { Injectable } from '@angular/core';
import { BaseHttpService } from './base-http.service';
import { Student } from '../models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StudentService extends BaseHttpService<Student> {
  protected endpoint = '/students';

  byParent$(parentUid: string): Observable<Student[]> {
    return this.list$({ parentUid });
  }

  byDojo$(dojoId: string): Observable<Student[]> {
    return this.list$({ dojoId });
  }
}
