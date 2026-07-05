import { Component, inject, signal, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { UserProfile } from '../../core/models';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

const SALUTATIONS = ['', 'Mr', 'Mrs', 'Ms', 'Mx', 'Dr'];
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, AvatarComponent, IconComponent],
  template: `
    <dojo-page-header title="My Profile" subtitle="Manage your photo, details, and password"></dojo-page-header>

    <div class="form-grid form-grid--2">

      <!-- ── Photo ─────────────────────────────────────────────────────────── -->
      <div class="card" style="padding:24px">
        <div class="card__header" style="margin-bottom:16px"><span class="card__title">Profile Photo</span></div>
        <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
          <dojo-avatar [name]="fullName()" [src]="user()?.avatarUrl" size="xl"></dojo-avatar>
          <div style="display:flex;flex-direction:column;gap:8px">
            <input #fileInput type="file" accept="image/jpeg,image/png,image/webp" style="display:none" (change)="onFileSelected($event)">
            <button class="btn btn--secondary btn--sm" (click)="fileInput.click()" [disabled]="photoBusy()">
              @if (photoBusy()) { Uploading… } @else { <dojo-icon name="camera" [size]="14"></dojo-icon> Upload photo }
            </button>
            <button class="btn btn--secondary btn--sm" *ngIf="user()?.avatarUrl" (click)="removePhoto()" [disabled]="photoBusy()">
              <dojo-icon name="trash" [size]="14"></dojo-icon> Remove photo
            </button>
            <div class="text-muted text-sm">JPG, PNG, or WEBP · up to 3MB</div>
            <div class="form-error" *ngIf="photoError()">{{ photoError() }}</div>
          </div>
        </div>
      </div>

      <!-- ── Account info (read-only) ─────────────────────────────────────── -->
      <div class="card" style="padding:24px">
        <div class="card__header" style="margin-bottom:16px"><span class="card__title">Account</span></div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <div class="text-muted text-sm mb-2">Dojo ID</div>
            <span class="badge badge--gray">{{ user()?.dojoId }}</span>
          </div>
          <div>
            <div class="text-muted text-sm mb-2">Role</div>
            <span class="badge badge--accent" style="text-transform:capitalize">{{ user()?.role }}</span>
          </div>
          <div>
            <div class="text-muted text-sm mb-2">Member since</div>
            <span class="text-muted">{{ user()?.createdAt | date:'MMM d, y' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Personal info ───────────────────────────────────────────────────── -->
    <div class="card mt-4" style="padding:24px">
      <div class="card__header" style="margin-bottom:16px"><span class="card__title">Personal Details</span></div>
      <form (ngSubmit)="saveDetails()">
        <div class="form-grid form-grid--3 mb-3">
          <div>
            <label class="text-sm text-muted mb-2" style="display:block">Salutation</label>
            <select class="select" [(ngModel)]="form.salutation" name="salutation">
              <option *ngFor="let s of salutations" [value]="s">{{ s || '—' }}</option>
            </select>
          </div>
          <div>
            <label class="text-sm text-muted mb-2" style="display:block">First Name</label>
            <input class="input" [(ngModel)]="form.firstName" name="firstName" required>
          </div>
          <div>
            <label class="text-sm text-muted mb-2" style="display:block">Family Name</label>
            <input class="input" [(ngModel)]="form.lastName" name="lastName" required>
          </div>
        </div>
        <div class="form-grid form-grid--2 mb-3">
          <div>
            <label class="text-sm text-muted mb-2" style="display:block">Phone</label>
            <input class="input" [(ngModel)]="form.phone" name="phone" placeholder="+91 98765 43210">
          </div>
          <div>
            <label class="text-sm text-muted mb-2" style="display:block">Email</label>
            <input class="input" type="email" [(ngModel)]="form.email" name="email" required>
          </div>
        </div>

        <div class="form-error" *ngIf="detailsError()">{{ detailsError() }}</div>
        <div class="text-sm" style="color:var(--success)" *ngIf="detailsSaved()">✓ Profile updated.</div>

        <button class="btn btn--primary" type="submit" [disabled]="detailsBusy()">
          {{ detailsBusy() ? 'Saving…' : 'Save Changes' }}
        </button>
      </form>
    </div>

    <!-- ── Change password ─────────────────────────────────────────────────── -->
    <div class="card mt-4" style="padding:24px">
      <div class="card__header" style="margin-bottom:16px"><span class="card__title">Change Password</span></div>
      <form (ngSubmit)="savePassword()">
        <div class="form-grid form-grid--2 mb-3">
          <div>
            <label class="text-sm text-muted mb-2" style="display:block">Current Password</label>
            <input class="input" type="password" [(ngModel)]="pw.current" name="currentPassword" required>
          </div>
          <div></div>
          <div>
            <label class="text-sm text-muted mb-2" style="display:block">New Password</label>
            <input class="input" type="password" [(ngModel)]="pw.next" name="newPassword" required (input)="checkStrength()">
          </div>
          <div>
            <label class="text-sm text-muted mb-2" style="display:block">Confirm New Password</label>
            <input class="input" type="password" [(ngModel)]="pw.confirm" name="confirmPassword" required>
          </div>
        </div>

        <ul style="list-style:none;padding:0;margin:0 0 16px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px">
          <li [style.color]="strength().length   ? 'var(--success)' : 'var(--text-muted)'">{{ strength().length   ? '✓' : '○' }} At least 8 characters</li>
          <li [style.color]="strength().upper    ? 'var(--success)' : 'var(--text-muted)'">{{ strength().upper    ? '✓' : '○' }} One uppercase letter</li>
          <li [style.color]="strength().lower    ? 'var(--success)' : 'var(--text-muted)'">{{ strength().lower    ? '✓' : '○' }} One lowercase letter</li>
          <li [style.color]="strength().number   ? 'var(--success)' : 'var(--text-muted)'">{{ strength().number   ? '✓' : '○' }} One number</li>
          <li [style.color]="strength().special  ? 'var(--success)' : 'var(--text-muted)'">{{ strength().special  ? '✓' : '○' }} One special character</li>
        </ul>

        <div class="form-error" *ngIf="passwordError()">{{ passwordError() }}</div>
        <div class="text-sm" style="color:var(--success)" *ngIf="passwordSaved()">✓ Password updated.</div>

        <button class="btn btn--primary" type="submit" [disabled]="passwordBusy()">
          {{ passwordBusy() ? 'Updating…' : 'Update Password' }}
        </button>
      </form>
    </div>
  `
})
export class ProfileComponent implements OnInit {
  private auth    = inject(AuthService);
  private profile = inject(ProfileService);

  user = this.auth.currentUser;
  salutations = SALUTATIONS;

  form = { salutation: '', firstName: '', lastName: '', phone: '', email: '' };
  pw   = { current: '', next: '', confirm: '' };

  photoBusy   = signal(false);
  photoError  = signal('');

  detailsBusy  = signal(false);
  detailsError = signal('');
  detailsSaved = signal(false);

  passwordBusy   = signal(false);
  passwordError  = signal('');
  passwordSaved  = signal(false);

  strength = signal({ length: false, upper: false, lower: false, number: false, special: false });

  fullName() {
    const u = this.user();
    return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.displayName : '';
  }

  ngOnInit() {
    this.profile.get$().subscribe(u => {
      this.form = {
        salutation: u.salutation ?? '',
        firstName:  u.firstName  ?? '',
        lastName:   u.lastName   ?? '',
        phone:      u.phone      ?? '',
        email:      u.email      ?? '',
      };
      this.auth.updateCurrentUser(u);
    });
  }

  // ── Photo ────────────────────────────────────────────────────────────────
  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.photoError.set('');
    if (!ALLOWED_TYPES.includes(file.type)) {
      this.photoError.set('Please choose a JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      this.photoError.set('Photo must be 3MB or smaller.');
      return;
    }

    this.photoBusy.set(true);
    try {
      const { avatarUrl } = await this.profile.uploadPhoto(file);
      this.auth.updateCurrentUser({ avatarUrl });
    } catch (e: any) {
      this.photoError.set(e?.message ?? 'Upload failed. Please try again.');
    } finally {
      this.photoBusy.set(false);
    }
  }

  async removePhoto() {
    this.photoBusy.set(true);
    this.photoError.set('');
    try {
      await this.profile.deletePhoto();
      this.auth.updateCurrentUser({ avatarUrl: undefined });
    } catch (e: any) {
      this.photoError.set(e?.message ?? 'Could not remove photo.');
    } finally {
      this.photoBusy.set(false);
    }
  }

  // ── Personal details ─────────────────────────────────────────────────────
  async saveDetails() {
    this.detailsError.set('');
    this.detailsSaved.set(false);

    if (!this.form.firstName.trim() || !this.form.lastName.trim()) {
      this.detailsError.set('First and family name are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email)) {
      this.detailsError.set('Please enter a valid email address.');
      return;
    }

    this.detailsBusy.set(true);
    try {
      const updated = await this.profile.update({
        salutation: this.form.salutation || undefined,
        firstName:  this.form.firstName.trim(),
        lastName:   this.form.lastName.trim(),
        phone:      this.form.phone.trim() || undefined,
        email:      this.form.email.trim(),
      });
      this.auth.updateCurrentUser(updated);
      this.detailsSaved.set(true);
      setTimeout(() => this.detailsSaved.set(false), 3000);
    } catch (e: any) {
      this.detailsError.set(e?.message ?? 'Could not save changes.');
    } finally {
      this.detailsBusy.set(false);
    }
  }

  // ── Password ─────────────────────────────────────────────────────────────
  checkStrength() {
    const p = this.pw.next;
    this.strength.set({
      length:  p.length >= 8,
      upper:   /[A-Z]/.test(p),
      lower:   /[a-z]/.test(p),
      number:  /\d/.test(p),
      special: /[^A-Za-z0-9]/.test(p),
    });
  }

  async savePassword() {
    this.passwordError.set('');
    this.passwordSaved.set(false);

    if (!this.pw.current || !this.pw.next || !this.pw.confirm) {
      this.passwordError.set('All password fields are required.');
      return;
    }
    if (this.pw.next !== this.pw.confirm) {
      this.passwordError.set('New password and confirmation do not match.');
      return;
    }
    if (!PASSWORD_PATTERN.test(this.pw.next)) {
      this.passwordError.set('New password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.');
      return;
    }

    this.passwordBusy.set(true);
    try {
      await this.profile.changePassword({ currentPassword: this.pw.current, newPassword: this.pw.next });
      this.passwordSaved.set(true);
      this.pw = { current: '', next: '', confirm: '' };
      this.strength.set({ length: false, upper: false, lower: false, number: false, special: false });
      setTimeout(() => this.passwordSaved.set(false), 3000);
    } catch (e: any) {
      this.passwordError.set(e?.message ?? 'Could not update password.');
    } finally {
      this.passwordBusy.set(false);
    }
  }
}
