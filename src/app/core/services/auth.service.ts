import { Injectable, inject, signal, computed } from '@angular/core';
import {
  Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail, onAuthStateChanged, User
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, serverTimestamp } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { UserProfile, UserRole } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth      = inject(Auth);
  private firestore = inject(Firestore);
  private router    = inject(Router);

  readonly currentUser = signal<UserProfile | null>(null);
  readonly isLoading   = signal(true);
  readonly isLoggedIn  = computed(() => !!this.currentUser());
  readonly role        = computed(() => this.currentUser()?.role ?? null);

  constructor() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        const profile = await this.loadProfile(user.uid);
        this.currentUser.set(profile);
      } else {
        this.currentUser.set(null);
      }
      this.isLoading.set(false);
    });
  }

  async login(email: string, password: string): Promise<void> {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    const profile = await this.loadProfile(cred.user.uid);
    this.currentUser.set(profile);
    this.redirectByRole(profile?.role);
  }

  async signup(email: string, password: string, displayName: string, role: UserRole, dojoId: string): Promise<void> {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    const profile: UserProfile = {
      uid: cred.user.uid, email, displayName, role, dojoId,
      createdAt: new Date(),
    };
    await setDoc(doc(this.firestore, `users/${cred.user.uid}`), {
      ...profile, createdAt: serverTimestamp(),
    });
    this.currentUser.set(profile);
    this.redirectByRole(role);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  private async loadProfile(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(this.firestore, `users/${uid}`));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { ...d, uid, createdAt: d['createdAt']?.toDate() ?? new Date() } as UserProfile;
  }

  private redirectByRole(role?: UserRole | null): void {
    const map: Record<UserRole, string> = {
      admin:  '/admin/dashboard',
      coach:  '/coach/dashboard',
      parent: '/parent/dashboard',
    };
    this.router.navigate([role ? map[role] : '/auth/login']);
  }
}
