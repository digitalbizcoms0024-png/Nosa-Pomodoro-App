import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getStripe, getDb } from '../utils/stripe-helpers.js';

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');

/**
 * Cancel a subscription at period end (not immediate).
 * Sets cancel_at_period_end = true so the user keeps access until their billing cycle ends.
 */
export const cancelSubscription = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to cancel subscription');
  }

  const db = getDb();
  const uid = request.auth.uid;

  const subscriptionDoc = await db.doc(`users/${uid}/subscription/status`).get();

  if (!subscriptionDoc.exists) {
    throw new HttpsError('failed-precondition', 'No active subscription found');
  }

  const subscriptionData = subscriptionDoc.data();
  const subscriptionId = subscriptionData?.subscriptionId;

  if (!subscriptionId) {
    throw new HttpsError('failed-precondition', 'No subscription ID found');
  }

  try {
    const stripe = getStripe();
    const updated = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Update Firestore to reflect the change immediately
    await db.doc(`users/${uid}/subscription/status`).update({
      cancelAtPeriodEnd: true,
      updatedAt: new Date().toISOString(),
    });

    return {
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: updated.current_period_end,
    };
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw new HttpsError('internal', 'Failed to cancel subscription');
  }
});
