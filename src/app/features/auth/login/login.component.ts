import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">🥋</div>
        <h1 class="auth-title">Dojo Platform</h1>
        <p class="auth-sub">Sign in to your portal</p>

        <div class="form-group">
          <label>Email</label>
          <input class="input" type="email" [(ngModel)]="email" placeholder="you@example.com" (keyup.enter)="login()">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input class="input" type="password" [(ngModel)]="password" placeholder="••••••••" (keyup.enter)="login()">
        </div>

        <div class="form-error" *ngIf="error()">{{ error() }}</div>

        <button class="btn btn--primary btn--full btn--lg" (click)="login()" [disabled]="loading()">
          {{ loading() ? 'Signing in…' : 'Sign In' }}
        </button>

        <div class="auth-links">
          <a routerLink="/auth/reset">Forgot password?</a>
          <a routerLink="/auth/signup">Create account</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page   { min-height:100vh; display:flex; align-items:center; justify-content:center;
                   background:var(--bg); padding:24px; }
    .auth-card   { width:100%; max-width:380px; background:var(--surface);
                   border:1px solid var(--border); border-radius:var(--radius-lg); padding:36px; }
    .auth-logo   { font-size:40px; text-align:center; margin-bottom:12px; }
    .auth-title  { font-size:22px; font-weight:700; text-align:center; margin-bottom:4px; }
    .auth-sub    { font-size:14px; color:var(--text-muted); text-align:center; margin-bottom:28px; }
    .auth-links  { display:flex; justify-content:space-between; margin-top:16px;
                   font-size:13px; color:var(--text-muted); }
    .form-error  { color:var(--danger); font-size:13px; margin-bottom:12px; }
  `]
})
export class LoginComponent {
  private auth = inject(AuthService);
  email    = '';
  password = '';
  loading  = signal(false);
  error    = signal('');

  async login() {
    if (!this.email || !this.password) { this.error.set('Email and password required.'); return; }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email, this.password);
    } catch (e: any) {
      this.error.set(e.message ?? 'Login failed.');
    } finally {
      this.loading.set(false);
    }
  }
}
