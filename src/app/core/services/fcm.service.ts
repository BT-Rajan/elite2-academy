import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Messaging, getToken, onMessage } from '@angular/fire/messaging';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';

const VAPID_KEY = 'YOUR_VAPID_PUBLIC_KEY'; // replace from Firebase console

@Injectable({ providedIn: 'root' })
export class FcmService {
  private functions = inject(Functions);
  private auth      = inject(AuthService);

  /**
   * Request notification permission and register token with the server.
   * Call once after successful login.
   */
  async init(): Promise<void> {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      // Get SW registration
      const sw  = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const msg = (await import('@angular/fire/messaging')).getMessaging();
      const tok = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw });

      if (tok) {
        const register = httpsCallable(this.functions, 'registerFcmToken');
        await register({ token: tok });
      }
    } catch {
      // Silently fail — push notifications are optional
    }
  }
}
