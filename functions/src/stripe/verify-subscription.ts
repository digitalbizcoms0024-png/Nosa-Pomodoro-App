import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDb, PREMIUM_STATUSES } from '../utils/stripe-helpers.js';

/**
 * Server-side subscription verification
 * Returns structured access response with tier info, grace period, and subscription metadata
 */
export const verifySubscription = onCall(async (request) => {
  // Guard: require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to verify subscription');
  }

  const db = getDb();

  // Read subscription document from Firestore
  const subscriptionDoc = await db.doc(`users/${request.auth.uid}/subscription/status`).get();

  // No subscription document or no data
  if (!subscriptionDoc.exists || !subscriptionDoc.data()) {
    return {
      hasAccess: false,
      status: 'none',
      tier: null,
      gracePeriod: false,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }

  const subscription = subscriptionDoc.data()!;

  // Determine access based on PREMIUM_STATUSES
  const hasAccess = PREMIUM_STATUSES.includes(subscription.status);

  // Determine tier
  let tier: 'monthly' | 'yearly' | 'lifetime' | null = null;
  if (subscription.status === 'lifetime') {
    tier = 'lifetime';
  } else if (subscription.priceId) {
    // Tier will be matched client-side based on priceId
    // For now, we return the priceId-based tier name
    // The client will map priceId to tier name (monthly/yearly)
    tier = subscription.priceId.includes('monthly') ? 'monthly' : 'yearly';
  }

  // Determine grace period (past_due still has access but payment failed)
  const gracePeriod = subscription.status === 'past_due';

  return {
    hasAccess,
    status: subscription.status,
    tier,
    gracePeriod,
    currentPeriodEnd: subscription.currentPeriodEnd || null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
  };
});
