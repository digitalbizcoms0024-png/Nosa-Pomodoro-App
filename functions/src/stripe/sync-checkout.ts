import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getStripe, getDb } from '../utils/stripe-helpers.js';

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');

/**
 * Sync subscription status from a completed Stripe Checkout session.
 * Called client-side after returning from Stripe checkout as a fallback
 * in case the webhook didn't fire or failed.
 */
export const syncCheckoutSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }

  const { sessionId } = request.data;
  if (!sessionId || typeof sessionId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing sessionId');
  }

  const stripe = getStripe();
  const db = getDb();
  const uid = request.auth.uid;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify this session belongs to this user
    if (session.client_reference_id !== uid) {
      throw new HttpsError('permission-denied', 'Session does not belong to this user');
    }

    if (session.payment_status === 'unpaid' && session.mode !== 'subscription') {
      throw new HttpsError('failed-precondition', 'Payment not completed');
    }

    const updatedAt = new Date().toISOString();

    if (session.mode === 'subscription') {
      const subscriptionId = session.subscription as string;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      await db.doc(`users/${uid}/subscription/status`).set(
        {
          subscriptionId,
          status: subscription.status,
          priceId: subscription.items.data[0]?.price.id || null,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          customerId: session.customer as string,
          updatedAt,
        },
        { merge: true }
      );

      return { status: subscription.status };
    } else if (session.mode === 'payment') {
      await db.doc(`users/${uid}/subscription/status`).set(
        {
          status: 'lifetime',
          paymentIntentId: session.payment_intent as string,
          customerId: session.customer as string,
          updatedAt,
        },
        { merge: true }
      );

      return { status: 'lifetime' };
    }

    return { status: 'unknown' };
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    console.error('Error syncing checkout session:', error);
    throw new HttpsError('internal', 'Failed to sync checkout session');
  }
});
