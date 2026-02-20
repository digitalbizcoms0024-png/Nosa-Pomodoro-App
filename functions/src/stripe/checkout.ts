import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getStripe } from '../utils/stripe-helpers.js';

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');

/**
 * Create a Stripe Checkout session for purchasing premium access
 * Supports both subscription (monthly/yearly with 7-day trial) and payment (lifetime, no trial) modes
 */
export const createCheckoutSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  // Guard: require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to create checkout session');
  }

  const { priceId, mode } = request.data;

  // Validate mode
  if (mode !== 'subscription' && mode !== 'payment') {
    throw new HttpsError(
      'invalid-argument',
      'Invalid mode. Must be "subscription" or "payment"'
    );
  }

  // Validate priceId
  if (!priceId || typeof priceId !== 'string' || !priceId.startsWith('price_')) {
    throw new HttpsError(
      'invalid-argument',
      'Invalid priceId. Must be a valid Stripe price ID starting with "price_"'
    );
  }

  const stripe = getStripe();

  // Build checkout session configuration
  const sessionConfig: any = {
    mode,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: 'https://pomodorotimer.vip/?checkout=success&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://pomodorotimer.vip/?checkout=canceled',
    customer_email: request.auth.token.email,
    client_reference_id: request.auth.uid, // Used by webhook to link to Firebase user
  };

  // Add mode-specific configuration
  if (mode === 'subscription') {
    // Monthly/yearly subscriptions: 7-day free trial
    sessionConfig.subscription_data = {
      trial_period_days: 7,
      metadata: {
        firebaseUid: request.auth.uid,
      },
    };
  } else if (mode === 'payment') {
    // Lifetime purchase: no trial, immediate charge
    sessionConfig.payment_intent_data = {
      metadata: {
        firebaseUid: request.auth.uid,
      },
    };
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionConfig);

    return {
      url: session.url,
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw new HttpsError('internal', 'Failed to create checkout session');
  }
});
