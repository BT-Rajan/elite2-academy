# Dojo Platform — Setup Guide

## Prerequisites
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (free Spark plan works for development)

---

## 1. Firebase Project Setup

1. Go to https://console.firebase.google.com → New project
2. Enable **Authentication** → Email/Password provider
3. Enable **Firestore** → Start in production mode
4. Enable **Cloud Messaging** (for push notifications)
5. Enable **Functions** (requires Blaze pay-as-you-go plan)
6. Copy your config from Project Settings → Your apps → Web app

---

## 2. Environment Config

Copy your Firebase config into both environment files:

```typescript
// src/environments/environment.ts  (development)
// src/environments/environment.prod.ts  (production)
export const environment = {
  production: false,
  firebase: {
    apiKey:            'YOUR_API_KEY',
    authDomain:        'YOUR_PROJECT.firebaseapp.com',
    projectId:         'YOUR_PROJECT_ID',
    storageBucket:     'YOUR_PROJECT.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId:             'YOUR_APP_ID',
  }
};
```

Also update `public/firebase-messaging-sw.js` with the same values.

---

## 3. Stripe Setup (optional — skip if not using payments)

1. Create a Stripe account at https://stripe.com
2. Get your **publishable key** and **secret key** from the dashboard
3. Update `src/app/core/services/stripe.service.ts`:
   ```typescript
   const STRIPE_PUBLISHABLE_KEY = 'pk_live_YOUR_KEY';
   ```
4. Set Firebase Function environment variables:
   ```bash
   firebase functions:config:set stripe.secret="sk_live_YOUR_SECRET"
   firebase functions:config:set stripe.webhook_secret="whsec_YOUR_SECRET"
   ```
5. Create products/prices in Stripe dashboard and update `priceId` values in `pricing.component.ts`
6. Register the webhook endpoint in Stripe dashboard:
   - URL: `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/stripeWebhook`
   - Events: `customer.subscription.*`, `invoice.payment_failed`

---

## 4. Deploy Firestore Rules & Indexes

```bash
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes
```

---

## 5. Deploy Cloud Functions

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

Update the portal URL in `StripeService` after deploy:
```typescript
const fnUrl = 'https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/createPortalSession';
```

---

## 6. Run Locally

```bash
npm install
ng serve
```

Visit http://localhost:4200

**First-time setup flow:**
1. Go to `/auth/signup`
2. Create an admin account (role: Admin, use any Dojo ID e.g. `dojo-001`)
3. Go to `/admin/disciplines` → add disciplines + belts
4. Share your Dojo ID with coaches and parents
5. Coaches sign up → start taking attendance
6. Parents sign up → link children → see progress

---

## 7. GitHub Actions CI/CD

Add these secrets to your GitHub repo (Settings → Secrets):

| Secret | Value |
|--------|-------|
| `FIREBASE_API_KEY` | From Firebase console |
| `FIREBASE_AUTH_DOMAIN` | `YOUR_PROJECT.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Your project ID |
| `FIREBASE_STORAGE_BUCKET` | `YOUR_PROJECT.appspot.com` |
| `FIREBASE_MESSAGING_SENDER_ID` | From Firebase console |
| `FIREBASE_APP_ID` | From Firebase console |
| `FIREBASE_SERVICE_ACCOUNT` | JSON from Project Settings → Service accounts |

Push to `main` → auto deploys to Firebase Hosting.

---

## 8. FCM Push Notifications (optional)

1. In Firebase console → Project Settings → Cloud Messaging → Web Push certificates
2. Generate a key pair, copy the **VAPID key**
3. Update `src/app/core/services/fcm.service.ts`:
   ```typescript
   const VAPID_KEY = 'YOUR_VAPID_PUBLIC_KEY';
   ```
4. Call `FcmService.init()` after login in `AuthService`

---

## Architecture Notes

- **Loyalty points** are awarded server-side by Cloud Functions only (not writable by frontend)
- **Notifications** are created by Cloud Functions — Firestore rules block frontend writes
- **Stripe checkout** uses the Firestore-triggered pattern: frontend writes a doc, CF creates session, writes URL back
- All **role-based access** is enforced in `firestore.rules` — not just the Angular guards
