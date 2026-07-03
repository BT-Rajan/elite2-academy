import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { PromotionReadiness, SeminarPointsLogEntry, StudentEvaluation } from '../models';

// ─────────────────────────────────────────────────────────────────────────────
//  EvaluationService — curriculum-roadmap evaluation, promotion, seminar
//  points, and BJJ stripes. Coaches evaluate students per the roadmap's
//  rules; a Head Coach (or Admin) can overrule any single evaluation.
// ─────────────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class EvaluationService {
  private api = inject(ApiService);

  evaluations$(studentId: string): Observable<StudentEvaluation[]> {
    return this.api.get<{ data: StudentEvaluation[] }>(`/students/${studentId}/evaluations`)
      .pipe(map(r => r.data));
  }

  async evaluate(studentId: string, body: { track: string; result: 'pass' | 'fail'; notes?: string; coachName: string }): Promise<void> {
    await this.api.post(`/students/${studentId}/evaluations`, body).toPromise();
  }

  // Head Coach / Admin only — server enforces this.
  async overrule(evaluationId: string, body: { result: 'pass' | 'fail'; notes: string; overruledByName: string }): Promise<void> {
    await this.api.patch(`/evaluations/${evaluationId}/overrule`, body).toPromise();
  }

  readiness$(studentId: string): Observable<PromotionReadiness> {
    return this.api.get<{ data: PromotionReadiness }>(`/students/${studentId}/promotion-readiness`)
      .pipe(map(r => r.data));
  }

  // If the student isn't fully ready, only a Head Coach / Admin can force
  // this through (server-enforced) and overrideNotes becomes required.
  async promote(studentId: string, body: { awardedBy: string; notes?: string; overrideNotes?: string }): Promise<{ beltId: string; beltName: string }> {
    const res = await this.api.post<{ data: { beltId: string; beltName: string } }>(`/students/${studentId}/promote`, body).toPromise();
    return res!.data;
  }

  seminarPointsLog$(studentId: string): Observable<SeminarPointsLogEntry[]> {
    return this.api.get<{ data: SeminarPointsLogEntry[] }>(`/students/${studentId}/seminar-points`)
      .pipe(map(r => r.data));
  }

  async awardSeminarPoints(studentId: string, points: number, reason: string, awardedByName: string): Promise<void> {
    await this.api.post(`/students/${studentId}/seminar-points`, { points, reason, awardedByName }).toPromise();
  }

  async awardStripe(studentId: string): Promise<void> {
    await this.api.post(`/students/${studentId}/bjj-stripe`, {}).toPromise();
  }
}
