import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getStripe, getDb } from '../utils/stripe-helpers.js';

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');

/**
 * TEMPORARY admin endpoint to backfill subscription data from Stripe.
 * Uses checkout sessions' client_reference_id (Firebase UID) directly.
 * DELETE THIS FUNCTION AFTER USE.
 */
export const adminSyncSubscriptions = onRequest(
  { secrets: [STRIPE_SECRET_KEY], timeoutSeconds: 120 },
  async (req, res) => {
    if (req.query.key !== 'pomodoro-admin-sync-2026') {
      res.status(403).send('Forbidden');
      return;
    }

    const stripe = getStripe();
    const db = getDb();
    const results: string[] = [];

    try {
      // Get all completed checkout sessions
      const sessions = await stripe.checkout.sessions.list({ limit: 100 });

      for (const session of sessions.data) {
        const uid = session.client_reference_id;
        if (!uid) {
          results.push(`SKIP: session ${session.id} — no client_reference_id`);
          continue;
        }

        if (session.status !== 'complete') {
          results.push(`SKIP: session ${session.id} — status: ${session.status}`);
          continue;
        }

        // Check if subscription data already exists
        const existingDoc = await db.doc(`users/${uid}/subscription/status`).get();
        if (existingDoc.exists) {
          results.push(`SKIP: ${uid} — already has subscription data`);
          continue;
        }

        const updatedAt = new Date().toISOString();

        if (session.mode === 'subscription' && session.subscription) {
          const subscriptionId = session.subscription as string;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          await db.doc(`users/${uid}/subscription/status`).set({
            subscriptionId,
            status: subscription.status,
            priceId: subscription.items.data[0]?.price.id || null,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            customerId: session.customer as string,
            updatedAt,
          });
          results.push(`SYNCED: ${uid} → ${subscription.status} (${session.customer_email})`);
        } else if (session.mode === 'payment') {
          await db.doc(`users/${uid}/subscription/status`).set({
            status: 'lifetime',
            paymentIntentId: session.payment_intent as string,
            customerId: session.customer as string,
            updatedAt,
          });
          results.push(`SYNCED: ${uid} → lifetime (${session.customer_email})`);
        }
      }

      res.status(200).json({ synced: results });
    } catch (error) {
      console.error('Admin sync error:', error);
      res.status(500).json({ error: String(error) });
    }
  }
);
