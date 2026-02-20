import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getDb, getStripe, PREMIUM_STATUSES } from '../utils/stripe-helpers.js';

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');

/**
 * Server-side subscription verification.
 * First checks Firestore. If no data found, searches Stripe by email
 * and backfills Firestore (self-healing for webhook failures).
 */
export const verifySubscription = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to verify subscription');
  }

  const db = getDb();
  const uid = request.auth.uid;
  const email = request.auth.token.email;

  // Check Firestore first
  const subscriptionDoc = await db.doc(`users/${uid}/subscription/status`).get();

  if (subscriptionDoc.exists && subscriptionDoc.data()) {
    const subscription = subscriptionDoc.data()!;
    const hasAccess = PREMIUM_STATUSES.includes(subscription.status);
    return {
      hasAccess,
      status: subscription.status,
      tier: getTier(subscription),
      gracePeriod: subscription.status === 'past_due',
      currentPeriodEnd: subscription.currentPeriodEnd || null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
    };
  }

  // Firestore empty — search Stripe by email (self-healing)
  if (!email) {
    return { hasAccess: false, status: 'none', tier: null, gracePeriod: false, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }

  try {
    const stripe = getStripe();
    const customers = await stripe.customers.list({ email, limit: 1 });

    if (customers.data.length === 0) {
      return { hasAccess: false, status: 'none', tier: null, gracePeriod: false, currentPeriodEnd: null, cancelAtPeriodEnd: false };
    }

    const customer = customers.data[0];
    const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 1 });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      const data = {
        subscriptionId: sub.id,
        status: sub.status,
        priceId: sub.items.data[0]?.price.id || null,
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        customerId: customer.id,
        updatedAt: new Date().toISOString(),
      };

      // Backfill Firestore
      await db.doc(`users/${uid}/subscription/status`).set(data, { merge: true });
      console.log(`Backfilled subscription for user ${uid} from Stripe`);

      const hasAccess = (PREMIUM_STATUSES as readonly string[]).includes(sub.status);
      return {
        hasAccess,
        status: sub.status,
        tier: getTier(data),
        gracePeriod: sub.status === 'past_due',
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    }

    // Check for lifetime (one-time payment via checkout)
    const sessions = await stripe.checkout.sessions.list({ customer: customer.id, limit: 5 });
    const lifetimeSession = sessions.data.find(s => s.mode === 'payment' && s.payment_status === 'paid');

    if (lifetimeSession) {
      const data = {
        status: 'lifetime',
        paymentIntentId: lifetimeSession.payment_intent as string,
        customerId: customer.id,
        updatedAt: new Date().toISOString(),
      };
      await db.doc(`users/${uid}/subscription/status`).set(data, { merge: true });
      console.log(`Backfilled lifetime purchase for user ${uid} from Stripe`);

      return { hasAccess: true, status: 'lifetime', tier: 'lifetime', gracePeriod: false, currentPeriodEnd: null, cancelAtPeriodEnd: false };
    }
  } catch (err) {
    console.error('Error checking Stripe for subscription:', err);
  }

  return { hasAccess: false, status: 'none', tier: null, gracePeriod: false, currentPeriodEnd: null, cancelAtPeriodEnd: false };
});

function getTier(sub: any): 'monthly' | 'yearly' | 'lifetime' | null {
  if (sub.status === 'lifetime') return 'lifetime';
  if (!sub.priceId) return null;
  if (sub.priceId.includes('monthly')) return 'monthly';
  return 'yearly';
}
