import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { UserRole } from '../../../core/models';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card auth-card--lg" *ngIf="!done()">
        <div class="auth-logo"><dojo-icon name="belt" [size]="28"></dojo-icon></div>
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
            <option value="staff">Staff</option>
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

      <div class="auth-card auth-card--lg" style="text-align:center" *ngIf="done()">
        <div style="display:flex;justify-content:center;color:var(--success, #16a34a);margin-bottom:12px">
          <dojo-icon name="check-circle" [size]="40"></dojo-icon>
        </div>
        <h1 class="auth-title">Account Created!</h1>
        <p class="auth-sub" style="margin-bottom:20px">
          Thanks{{ firstName ? ', ' + firstName : '' }} — your {{ role }} account has been submitted
          and is pending approval. You'll be able to sign in as soon as your dojo's admin approves it.
        </p>
        <a routerLink="/auth/login" class="btn btn--primary btn--full btn--lg">Go to Sign In</a>
      </div>
    </div>
  `
})
export class SignupComponent {
  private auth = inject(AuthService);
  firstName = ''; lastName = ''; email = ''; password = '';
  role: UserRole = 'parent'; dojoId = '';
  loading = signal(false); error = signal('');
  done = signal(false);

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
      this.done.set(true);
    } catch (e: any) {
      this.error.set(e.message ?? 'Signup failed.');
    } finally { this.loading.set(false); }
  }
}
