import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ─────────────────────────────────────────────────────────────────────────────
//  ApiService — single HTTP client wrapper, all services use this.
//  Handles JWT header injection, error normalisation, base URL.
// ─────────────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http    = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  private headers(): HttpHeaders {
    const token = localStorage.getItem('dojo_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return this.http.get<T>(url.toString(), { headers: this.headers() })
      .pipe(catchError(this.handleError));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, { headers: this.headers() })
      .pipe(catchError(this.handleError));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, { headers: this.headers() })
      .pipe(catchError(this.handleError));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, { headers: this.headers() })
      .pipe(catchError(this.handleError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`, { headers: this.headers() })
      .pipe(catchError(this.handleError));
  }

  /**
   * For file uploads (FormData). Deliberately omits Content-Type so the
   * browser sets 'multipart/form-data; boundary=...' itself — setting it
   * manually breaks the boundary and the server can't parse the upload.
   */
  upload<T>(path: string, formData: FormData): Observable<T> {
    const token = localStorage.getItem('dojo_token');
    const headers = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    return this.http.post<T>(`${this.baseUrl}${path}`, formData, { headers })
      .pipe(catchError(this.handleError));
  }

  private handleError = (err: HttpErrorResponse): Observable<never> => {
    // status 0 means the browser never got an HTTP response at all — the
    // request was blocked (CORS) or the server was unreachable. This is
    // NOT a server-side error, so give the user something actionable
    // instead of the opaque "HTTP 0: Unknown Error".
    if (err.status === 0) {
      return throwError(() => new Error(
        `Can't reach the API at ${this.baseUrl}. Check that: ` +
        `1) the PHP backend is running (e.g. XAMPP Apache + MySQL), ` +
        `2) the URL/port in environment.ts matches where it's hosted, ` +
        `3) mod_rewrite / .htaccess overrides are enabled so requests reach index.php.`
      ));
    }
    const message = err.error?.message ?? err.error?.error ?? `HTTP ${err.status}: ${err.statusText}`;
    return throwError(() => new Error(message));
  };
}
