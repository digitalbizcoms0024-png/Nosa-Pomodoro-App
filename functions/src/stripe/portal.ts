import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getStripe, getDb } from '../utils/stripe-helpers.js';

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');

/**
 * Create a Stripe Customer Portal session for managing subscription
 * Requires user to have an active subscription with a customerId in Firestore
 */
export const createPortalSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  // Guard: require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to access customer portal');
  }

  const db = getDb();
  const stripe = getStripe();

  // Read subscription document from Firestore
  const subscriptionDoc = await db.doc(`users/${request.auth.uid}/subscription`).get();

  if (!subscriptionDoc.exists) {
    throw new HttpsError('failed-precondition', 'No active subscription found');
  }

  const subscriptionData = subscriptionDoc.data();
  const customerId = subscriptionData?.customerId;

  if (!customerId) {
    throw new HttpsError('failed-precondition', 'No active subscription found');
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://pomodorotimer.vip/',
    });

    return {
      url: session.url,
    };
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw new HttpsError('internal', 'Failed to create portal session');
  }
});
