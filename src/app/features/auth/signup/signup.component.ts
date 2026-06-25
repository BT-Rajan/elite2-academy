import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">🥋</div>
        <h1 class="auth-title">Create Account</h1>
        <p class="auth-sub">Join your dojo's platform</p>

        <div class="form-grid form-grid--2">
          <div class="form-group">
            <label>First Name</label>
            <input class="input" [(ngModel)]="firstName" placeholder="First">
          </div>
          <div class="form-group">
            <label>Last Name</label>
            <input class="input" [(ngModel)]="lastName" placeholder="Last">
          </div>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input class="input" type="email" [(ngModel)]="email" placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input class="input" type="password" [(ngModel)]="password" placeholder="min 6 characters">
        </div>
        <div class="form-group">
          <label>I am a…</label>
          <select class="select" [(ngModel)]="role">
            <option value="parent">Parent</option>
            <option value="coach">Coach</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="form-group">
          <label>Dojo ID</label>
          <input class="input" [(ngModel)]="dojoId" placeholder="Provided by your dojo admin">
        </div>

        <div class="form-error" *ngIf="error()">{{ error() }}</div>

        <button class="btn btn--primary btn--full btn--lg" (click)="signup()" [disabled]="loading()">
          {{ loading() ? 'Creating account…' : 'Create Account' }}
        </button>

        <div class="auth-links" style="justify-content:center;margin-top:16px;font-size:13px">
          <a routerLink="/auth/login">Already have an account? Sign in</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page  { min-height:100vh; display:flex; align-items:center; justify-content:center;
                  background:var(--bg); padding:24px; }
    .auth-card  { width:100%; max-width:420px; background:var(--surface);
                  border:1px solid var(--border); border-radius:var(--radius-lg); padding:36px; }
    .auth-logo  { font-size:40px; text-align:center; margin-bottom:12px; }
    .auth-title { font-size:22px; font-weight:700; text-align:center; margin-bottom:4px; }
    .auth-sub   { font-size:14px; color:var(--text-muted); text-align:center; margin-bottom:28px; }
    .form-error { color:var(--danger); font-size:13px; margin-bottom:12px; }
  `]
})
export class SignupComponent {
  private auth = inject(AuthService);
  firstName = ''; lastName = ''; email = ''; password = '';
  role: UserRole = 'parent'; dojoId = '';
  loading = signal(false); error = signal('');

  async signup() {
    if (!this.email || !this.password || !this.firstName) {
      this.error.set('Please fill in all required fields.'); return;
    }
    this.loading.set(true); this.error.set('');
    try {
      await this.auth.signup(
        this.email, this.password,
        `${this.firstName} ${this.lastName}`.trim(),
        this.role, this.dojoId
      );
    } catch (e: any) {
      this.error.set(e.message?.replace('Firebase: ', '') ?? 'Signup failed.');
    } finally { this.loading.set(false); }
  }
}
