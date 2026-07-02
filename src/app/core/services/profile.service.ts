import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { UserProfile } from '../models';

export interface ProfileUpdatePayload {
  salutation?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private api = inject(ApiService);

  get$(): Observable<UserProfile> {
    return this.api.get<{ data: UserProfile }>('/profile').pipe(map(r => r.data));
  }

  async update(payload: ProfileUpdatePayload): Promise<UserProfile> {
    const res = await this.api.put<{ data: UserProfile }>('/profile', payload).toPromise();
    return res!.data;
  }

  async uploadPhoto(file: File): Promise<{ avatarUrl: string }> {
    const form = new FormData();
    form.append('photo', file);
    const res = await this.api.upload<{ data: { avatarUrl: string } }>('/profile/photo', form).toPromise();
    return res!.data;
  }

  async deletePhoto(): Promise<void> {
    await this.api.delete('/profile/photo').toPromise();
  }

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await this.api.post('/profile/password', payload).toPromise();
  }
}
