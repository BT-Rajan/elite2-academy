import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { tap, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { UserProfile, UserRole } from '../models';

interface AuthResponse {
  token:   string;
  user:    UserProfile;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api    = inject(ApiService);
  private router = inject(Router);

  readonly currentUser = signal<UserProfile | null>(this.loadUser());
  readonly isLoading   = signal(false);
  readonly isLoggedIn  = computed(() => !!this.currentUser());
  readonly role        = computed(() => this.currentUser()?.role ?? null);

  private loadUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem('dojo_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async login(email: string, password: string): Promise<void> {
    this.isLoading.set(true);
    try {
      // A pending/rejected account gets a 403 with a clear message straight
      // from the backend (AuthController::login()) rather than a 200 —
      // ApiService surfaces that as a thrown Error, which the login screen
      // already displays via its existing catch block.
      const res = await this.api.post<{ data: AuthResponse }>('/auth/login', { email, password })
        .toPromise();
      if (!res?.data) throw new Error('No response from server.');
      this.storeSession(res.data);
      this.redirectByRole(res.data.user.role);
    } finally { this.isLoading.set(false); }
  }

  // Every new signup starts life as approval_status='pending' (enforced
  // server-side in AuthController::register(), not just this check), so
  // there's nothing useful to log them into yet -- no session is stored and
  // no navigation happens here. The signup screen shows a confirmation and
  // sends them to /auth/login for later, once an admin approves them.
  async signup(
    email: string, password: string, displayName: string,
    role: UserRole, dojoId: string
  ): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await this.api.post<{ data: AuthResponse }>('/auth/register', {
        email, password, displayName, role, dojoId,
      }).toPromise();
      if (!res?.data) throw new Error('No response from server.');
    } finally { this.isLoading.set(false); }
  }

  async logout(): Promise<void> {
    try { await this.api.post('/auth/logout', {}).toPromise(); } catch {}
    this.clearSession();
    this.router.navigate(['/auth/login']);
  }

  async resetPassword(email: string): Promise<void> {
    await this.api.post('/auth/forgot-password', { email }).toPromise();
  }

  /** Merge partial profile changes (name, phone, avatarUrl, etc.) into the cached session. */
  updateCurrentUser(patch: Partial<UserProfile>): void {
    const merged = { ...this.currentUser(), ...patch } as UserProfile;
    localStorage.setItem('dojo_user', JSON.stringify(merged));
    this.currentUser.set(merged);
  }

  private storeSession(res: AuthResponse): void {
    localStorage.setItem('dojo_token', res.token);
    localStorage.setItem('dojo_user',  JSON.stringify(res.user));
    this.currentUser.set(res.user);
  }

  private clearSession(): void {
    localStorage.removeItem('dojo_token');
    localStorage.removeItem('dojo_user');
    this.currentUser.set(null);
  }

  private redirectByRole(role: UserRole): void {
    const map: Record<UserRole, string> = {
      admin:  '/admin/dashboard',
      coach:  '/coach/dashboard',
      parent: '/parent/dashboard',
      staff:  '/staff/dashboard',
    };
    this.router.navigate([map[role] ?? '/auth/login']);
  }
}
