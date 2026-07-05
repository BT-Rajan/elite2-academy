import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo"><dojo-icon name="key" [size]="28"></dojo-icon></div>
        <h1 class="auth-title">Reset Password</h1>
        <p class="auth-sub">We'll send you a reset link</p>

        <div class="form-group">
          <label>Email</label>
          <input class="input" type="email" [(ngModel)]="email" placeholder="you@example.com" (keyup.enter)="reset()">
        </div>

        <div class="form-error" *ngIf="error()">{{ error() }}</div>
        <p *ngIf="sent()" style="color:var(--success);font-size:13px;margin-bottom:12px">
          Reset link sent! Check your inbox.
        </p>

        <button class="btn btn--primary btn--full" (click)="reset()" [disabled]="loading() || sent()">
          {{ loading() ? 'Sending…' : 'Send Reset Link' }}
        </button>
        <div style="text-align:center;margin-top:16px">
          <a routerLink="/auth/login" style="font-size:13px">Back to login</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height:100vh; display:flex; align-items:center; justify-content:center;
                 background:var(--bg); padding:24px; }
    .auth-card { width:100%; max-width:360px; background:var(--surface);
                 border:1px solid var(--border); border-radius:var(--radius-lg); padding:36px; }
    .auth-logo { font-size:40px; text-align:center; margin-bottom:12px; }
    .auth-title{ font-size:22px; font-weight:700; text-align:center; margin-bottom:4px; }
    .auth-sub  { font-size:14px; color:var(--text-muted); text-align:center; margin-bottom:28px; }
    .form-error{ color:var(--danger); font-size:13px; margin-bottom:12px; }
  `]
})
export class ResetPasswordComponent {
  private auth = inject(AuthService);
  email = ''; loading = signal(false); error = signal(''); sent = signal(false);

  async reset() {
    if (!this.email) { this.error.set('Enter your email.'); return; }
    this.loading.set(true); this.error.set('');
    try {
      await this.auth.resetPassword(this.email);
      this.sent.set(true);
    } catch (e: any) {
      this.error.set(e.message ?? 'Failed.');
    } finally { this.loading.set(false); }
  }
}
