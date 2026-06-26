import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, onSnapshot,
  serverTimestamp, doc
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { loadStripe, Stripe } from '@stripe/stripe-js';

// ─────────────────────────────────────────────────────────────────────────────
//  StripeService — handles checkout sessions and subscription management.
//
//  Architecture:
//    1. Frontend creates a checkout_sessions doc in Firestore
//    2. Firebase Cloud Function (Phase 6) picks it up, calls Stripe API,
//       writes sessionId back
//    3. Frontend listens for sessionId, redirects to Stripe Checkout
//
//  For now the Cloud Function URL is stubbed — replace with your deployed URL.
// ─────────────────────────────────────────────────────────────────────────────

const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY'; // replace

@Injectable({ providedIn: 'root' })
export class StripeService {
  private firestore = inject(Firestore);
  private auth      = inject(AuthService);
  private stripe$:  Promise<Stripe | null> = loadStripe(STRIPE_PUBLISHABLE_KEY);

  /**
   * Create a Stripe Checkout session for a membership plan.
   * Writes to Firestore → Cloud Function picks it up → redirects to Stripe.
   */
  async checkout(priceId: string, dojoId: string): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) throw new Error('Must be logged in to checkout.');

    const sessionRef = await addDoc(
      collection(this.firestore, `customers/${user.uid}/checkout_sessions`),
      {
        price:      priceId,
        dojoId,
        uid:        user.uid,
        email:      user.email,
        mode:       'subscription',
        success_url: `${window.location.origin}/parent/dashboard?subscribed=true`,
        cancel_url:  `${window.location.origin}/pricing`,
        createdAt:  serverTimestamp(),
      }
    );

    // Listen for Cloud Function to write the sessionId back
    return new Promise((resolve, reject) => {
      const unsub = onSnapshot(sessionRef, async (snap) => {
        const data = snap.data();
        if (data?.['error']) { unsub(); reject(new Error(data['error'].message)); return; }
        if (!data?.['sessionId']) return; // not ready yet

        unsub();
        // Redirect to Stripe Checkout URL (set by Cloud Function)
        const checkoutUrl = data['url'] ?? data['checkoutUrl'];
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
          resolve();
        } else {
          reject(new Error('No checkout URL returned from server.'));
        }
      });

      // Timeout after 30s if Cloud Function never responds
      setTimeout(() => { unsub(); reject(new Error('Checkout timed out. Please try again.')); }, 30000);
    });
  }

  /**
   * Open the Stripe Customer Portal so users can manage their subscription.
   */
  async openPortal(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;

    // Cloud Function endpoint — replace with your deployed URL
    const fnUrl = 'https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/createPortalSession';
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid, returnUrl: window.location.href }),
    });
    const { url } = await res.json();
    window.location.href = url;
  }
}
