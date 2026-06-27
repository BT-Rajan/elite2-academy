/**
 * Dojo Platform — Firebase Cloud Functions
 * =========================================
 * All server-side logic lives here:
 *   1. Loyalty triggers   — auto-award points on attendance / renewal / belt
 *   2. Stripe webhooks    — sync subscription state, trigger renewal points
 *   3. Stripe checkout    — create checkout sessions from Firestore docs
 *   4. Stripe portal      — customer portal sessions
 *   5. Notifications      — fan-out FCM push on key events
 *   6. Scheduled reports  — nightly attendance summary cron
 *   7. New user setup     — create loyalty account on signup
 */

import * as admin   from 'firebase-admin';
import * as functions from 'firebase-functions';
import Stripe from 'stripe';

admin.initializeApp();
const db     = admin.firestore();
const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', { apiVersion: '2024-04-10' });

// ── Constants ──────────────────────────────────────────────────────────────────
const POINTS = {
  attendance:       10,
  attendance_late:   5,
  renewal:         100,
  referral:        200,
  belt_promotion:  150,
  seminar:          50,
} as const;

const TIER_THRESHOLDS = { bronze: 0, silver: 500, gold: 1500, platinum: 3000 };

// ── Helpers ────────────────────────────────────────────────────────────────────
function calcTier(lifetime: number): string {
  if (lifetime >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (lifetime >= TIER_THRESHOLDS.gold)     return 'gold';
  if (lifetime >= TIER_THRESHOLDS.silver)   return 'silver';
  return 'bronze';
}

async function awardPoints(
  parentUid: string,
  dojoId:    string,
  amount:    number,
  reason:    keyof typeof POINTS | string,
  note:      string,
): Promise<void> {
  const acctRef = db.doc(`loyalty/${parentUid}`);
  const snap    = await acctRef.get();

  if (!snap.exists) {
    await acctRef.set({
      id: parentUid, dojoId,
      points: amount, lifetimePoints: Math.max(0, amount),
      tier: calcTier(Math.max(0, amount)),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    const cur        = snap.data()!;
    const newPoints  = (cur['points']        ?? 0) + amount;
    const newLifetime= (cur['lifetimePoints']?? 0) + Math.max(0, amount);
    await acctRef.update({
      points:        newPoints,
      lifetimePoints: newLifetime,
      tier:           calcTier(newLifetime),
      updatedAt:      admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await db.collection(`loyalty/${parentUid}/transactions`).add({
    accountId: parentUid, amount, reason, note,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function sendNotification(
  uid:   string,
  type:  string,
  title: string,
  body:  string,
  link?: string,
): Promise<void> {
  await db.collection('notifications').add({
    uid, type, title, body, isRead: false, link: link ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  // FCM push — get device token if stored
  const tokenSnap = await db.doc(`fcmTokens/${uid}`).get();
  const token     = tokenSnap.data()?.['token'];
  if (token) {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: { type, link: link ?? '' },
    }).catch(() => {}); // token may be stale — ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. LOYALTY TRIGGERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Triggered when a new attendance record is created.
 * Awards points to the student's parent and notifies them.
 */
export const onAttendanceCreated = functions.firestore
  .document('attendance/{recordId}')
  .onCreate(async (snap) => {
    const rec     = snap.data();
    const status  = rec['status'] as string;
    if (status !== 'present' && status !== 'late') return;

    const studentSnap = await db.doc(`students/${rec['studentId']}`).get();
    if (!studentSnap.exists) return;
    const student   = studentSnap.data()!;
    const parentUid = student['parentUid'] as string;
    const dojoId    = student['dojoId']    as string;

    const pts    = status === 'present' ? POINTS.attendance : POINTS.attendance_late;
    const reason = status === 'present' ? 'attendance' : 'attendance_late';
    const note   = `${status === 'present' ? 'Present' : 'Late'} at session`;

    await awardPoints(parentUid, dojoId, pts, reason, note);

    // Check dojo notif preferences before sending
    const dojoSnap = await db.doc(`dojos/${dojoId}`).get();
    const prefs    = dojoSnap.data()?.['notifPrefs'] ?? {};
    if (prefs['attendance_marked'] !== false) {
      await sendNotification(
        parentUid, 'attendance',
        `${student['firstName']} attended class`,
        `${pts} loyalty points earned. Keep it up!`,
      );
    }
  });

/**
 * Triggered when a belt history entry is created (belt awarded).
 * Awards promotion points and notifies parent.
 */
export const onBeltAwarded = functions.firestore
  .document('students/{studentId}/beltHistory/{historyId}')
  .onCreate(async (snap, ctx) => {
    const entry     = snap.data();
    const studentId = ctx.params['studentId'];

    const studentSnap = await db.doc(`students/${studentId}`).get();
    if (!studentSnap.exists) return;
    const student   = studentSnap.data()!;
    const parentUid = student['parentUid'] as string;
    const dojoId    = student['dojoId']    as string;

    await awardPoints(parentUid, dojoId, POINTS.belt_promotion, 'belt_promotion',
      `Belt promotion: ${entry['beltName']}`);

    const dojoSnap = await db.doc(`dojos/${dojoId}`).get();
    const prefs    = dojoSnap.data()?.['notifPrefs'] ?? {};
    if (prefs['belt_awarded'] !== false) {
      await sendNotification(
        parentUid, 'belt',
        `🥋 ${student['firstName']} earned a new belt!`,
        `Congratulations! ${entry['beltName']} awarded by ${entry['awardedBy']}.`,
      );
    }
  });

/**
 * Triggered when a coach adds a session comment.
 * Notifies the parent.
 */
export const onCommentAdded = functions.firestore
  .document('sessions/{sessionId}/comments/{commentId}')
  .onCreate(async (snap) => {
    const comment   = snap.data();
    const studentId = comment['studentId'] as string;

    const studentSnap = await db.doc(`students/${studentId}`).get();
    if (!studentSnap.exists) return;
    const student   = studentSnap.data()!;
    const parentUid = student['parentUid'] as string;
    const dojoId    = student['dojoId']    as string;

    const dojoSnap = await db.doc(`dojos/${dojoId}`).get();
    const prefs    = dojoSnap.data()?.['notifPrefs'] ?? {};
    if (prefs['comment_added'] === false) return;

    await sendNotification(
      parentUid, 'message',
      `New note from ${comment['coachName']}`,
      comment['comment']?.slice(0, 100) ?? 'Session notes added.',
    );
  });

/**
 * Triggered when a student objective is completed.
 */
export const onObjectiveCompleted = functions.firestore
  .document('students/{studentId}/objectives/{objId}')
  .onUpdate(async (change, ctx) => {
    const before = change.before.data();
    const after  = change.after.data();
    if (before['isComplete'] || !after['isComplete']) return; // only on completion

    const studentId   = ctx.params['studentId'];
    const studentSnap = await db.doc(`students/${studentId}`).get();
    if (!studentSnap.exists) return;
    const student   = studentSnap.data()!;
    const parentUid = student['parentUid'] as string;
    const dojoId    = student['dojoId']    as string;

    const dojoSnap = await db.doc(`dojos/${dojoId}`).get();
    const prefs    = dojoSnap.data()?.['notifPrefs'] ?? {};
    if (prefs['objective_complete'] === false) return;

    await sendNotification(
      parentUid, 'achievement',
      `🎯 ${student['firstName']} completed an objective!`,
      after['description'],
    );
  });

// ─────────────────────────────────────────────────────────────────────────────
//  2. NEW USER SETUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * On new user creation, create a loyalty account if role is parent.
 */
export const onUserCreated = functions.firestore
  .document('users/{uid}')
  .onCreate(async (snap, ctx) => {
    const user = snap.data();
    if (user['role'] !== 'parent') return;

    const uid    = ctx.params['uid'];
    const dojoId = user['dojoId'] as string;

    await db.doc(`loyalty/${uid}`).set({
      id: uid, dojoId,
      points: 0, lifetimePoints: 0, tier: 'bronze',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await sendNotification(uid, 'system',
      'Welcome to Dojo Platform! 🥋',
      'Your account is ready. Check your child\'s progress anytime.');
  });

// ─────────────────────────────────────────────────────────────────────────────
//  3. STRIPE CHECKOUT SESSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Triggered when frontend writes to customers/{uid}/checkout_sessions.
 * Creates a Stripe Checkout session and writes the URL back.
 */
export const createCheckoutSession = functions.firestore
  .document('customers/{uid}/checkout_sessions/{sessionId}')
  .onCreate(async (snap, ctx) => {
    const data = snap.data();
    const uid  = ctx.params['uid'];

    try {
      const session = await stripe.checkout.sessions.create({
        mode:        data['mode'] ?? 'subscription',
        line_items:  [{ price: data['price'], quantity: 1 }],
        success_url: data['success_url'],
        cancel_url:  data['cancel_url'],
        customer_email: data['email'],
        metadata:    { uid, dojoId: data['dojoId'] },
      });

      await snap.ref.update({
        sessionId: session.id,
        url:       session.url,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err: any) {
      await snap.ref.update({ error: { message: err.message } });
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
//  4. STRIPE CUSTOMER PORTAL
// ─────────────────────────────────────────────────────────────────────────────

export const createPortalSession = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  const { uid, returnUrl } = req.body;
  if (!uid) { res.status(400).json({ error: 'uid required' }); return; }

  const customerSnap = await db.doc(`customers/${uid}`).get();
  const customerId   = customerSnap.data()?.['stripeId'];
  if (!customerId) { res.status(404).json({ error: 'No Stripe customer found' }); return; }

  const session = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: returnUrl ?? 'https://your-app.web.app',
  });

  res.json({ url: session.url });
});

// ─────────────────────────────────────────────────────────────────────────────
//  5. STRIPE WEBHOOKS
// ─────────────────────────────────────────────────────────────────────────────

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig     = req.headers['stripe-signature'] as string;
  const secret  = process.env['STRIPE_WEBHOOK_SECRET'] ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
  } catch (err: any) {
    res.status(400).send(`Webhook error: ${err.message}`);
    return;
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub      = event.data.object as Stripe.Subscription;
      const uid      = sub.metadata['uid'];
      const dojoId   = sub.metadata['dojoId'];
      if (!uid) break;

      await db.doc(`customers/${uid}`).set({
        stripeId:       sub.customer,
        subscriptionId: sub.id,
        status:         sub.status,
        plan:           (sub.items.data[0]?.price?.nickname ?? 'unknown'),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        updatedAt:      admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // Award renewal points on new billing cycle
      if (event.type === 'customer.subscription.updated') {
        await awardPoints(uid, dojoId ?? '', POINTS.renewal, 'renewal',
          'Membership renewal');
        await sendNotification(uid, 'loyalty',
          '⭐ Renewal points earned!',
          `${POINTS.renewal} points added to your loyalty account.`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata['uid'];
      if (uid) {
        await db.doc(`customers/${uid}`).update({ status: 'canceled' });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice;
      const uid = (inv.subscription_details?.metadata?.['uid']) ?? '';
      if (uid) {
        await sendNotification(uid, 'system',
          '⚠ Payment failed',
          'Your subscription payment failed. Please update your payment method.');
      }
      break;
    }
  }

  res.json({ received: true });
});

// ─────────────────────────────────────────────────────────────────────────────
//  6. SCHEDULED REPORTS — nightly attendance summary
// ─────────────────────────────────────────────────────────────────────────────

export const nightlyAttendanceSummary = functions.pubsub
  .schedule('0 6 * * *')          // 06:00 UTC daily
  .timeZone('UTC')
  .onRun(async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date(yesterday);
    today.setDate(today.getDate() + 1);

    // Get all sessions from yesterday
    const sessions = await db.collection('sessions')
      .where('date', '>=', yesterday)
      .where('date', '<',  today)
      .get();

    if (sessions.empty) return;

    // Aggregate per dojo
    const dojoMap = new Map<string, { sessions: number; present: number; absent: number }>();
    for (const session of sessions.docs) {
      const { dojoId } = session.data();
      if (!dojoMap.has(dojoId)) dojoMap.set(dojoId, { sessions: 0, present: 0, absent: 0 });
      dojoMap.get(dojoId)!.sessions++;
    }

    // Write summary docs
    for (const [dojoId, stats] of dojoMap) {
      await db.collection(`dojos/${dojoId}/dailyReports`).add({
        date:    yesterday,
        ...stats,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    functions.logger.info(`Nightly report: ${dojoMap.size} dojos processed`);
  });

// ─────────────────────────────────────────────────────────────────────────────
//  7. FCM TOKEN REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HTTPS callable — frontend calls this to register device push token.
 */
export const registerFcmToken = functions.https.onCall(async (data, ctx) => {
  if (!ctx.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const { token } = data;
  if (!token) throw new functions.https.HttpsError('invalid-argument', 'token required');

  await db.doc(`fcmTokens/${ctx.auth.uid}`).set({
    token, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});
