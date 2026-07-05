import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo"><dojo-icon name="belt" [size]="28"></dojo-icon></div>
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
  `
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
