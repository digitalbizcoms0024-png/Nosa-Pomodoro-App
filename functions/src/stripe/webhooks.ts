import { onRequest } from 'firebase-functions/v2/https';
import type Stripe from 'stripe';
import { getStripe, getDb } from '../utils/stripe-helpers.js';

/**
 * Stripe webhook handler for subscription lifecycle events
 * Handles: checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_failed
 */
export const stripeWebhook = onRequest(
  {
    cors: false,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req, res) => {
    // Only accept POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      res.status(400).send('Missing stripe-signature header');
      return;
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      res.status(500).send('Webhook secret not configured');
      return;
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature using raw body
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).send('Invalid signature');
      return;
    }

    // Idempotency check: ensure we don't process the same event twice
    const db = getDb();
    const eventRef = db.doc(`stripe_events/${event.id}`);
    const eventDoc = await eventRef.get();

    if (eventDoc.exists) {
      console.log(`Event ${event.id} already processed, skipping`);
      res.status(200).send('Already processed');
      return;
    }

    // Record that we're processing this event
    await eventRef.set({
      processed: true,
      type: event.type,
      createdAt: new Date().toISOString(),
    });

    // Return 200 to Stripe immediately - we'll process asynchronously
    res.status(200).send('Webhook received');

    // Process the event (async, but Cloud Functions waits for completion)
    try {
      await processWebhookEvent(event);
    } catch (err) {
      console.error(`Error processing event ${event.id}:`, err);
      // Don't throw - we already responded to Stripe
    }
  }
);

/**
 * Process webhook events and sync subscription status to Firestore
 */
async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  const db = getDb();
  const stripe = getStripe();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.client_reference_id;

      if (!uid) {
        console.error('checkout.session.completed: missing client_reference_id');
        return;
      }

      const updatedAt = new Date().toISOString();

      if (session.mode === 'subscription') {
        // Recurring subscription - retrieve full subscription object
        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        await db.doc(`users/${uid}/subscription`).set(
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

        console.log(`Subscription created for user ${uid}: ${subscriptionId}`);
      } else if (session.mode === 'payment') {
        // One-time payment (lifetime)
        await db.doc(`users/${uid}/subscription`).set(
          {
            status: 'lifetime',
            paymentIntentId: session.payment_intent as string,
            customerId: session.customer as string,
            updatedAt,
          },
          { merge: true }
        );

        console.log(`Lifetime purchase for user ${uid}`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const uid = subscription.metadata.firebaseUid;

      if (!uid) {
        console.error('customer.subscription.updated: missing metadata.firebaseUid');
        return;
      }

      await db.doc(`users/${uid}/subscription`).set(
        {
          status: subscription.status,
          priceId: subscription.items.data[0]?.price.id || null,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log(`Subscription updated for user ${uid}: ${subscription.status}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const uid = subscription.metadata.firebaseUid;

      if (!uid) {
        console.error('customer.subscription.deleted: missing metadata.firebaseUid');
        return;
      }

      await db.doc(`users/${uid}/subscription`).set(
        {
          status: 'canceled',
          canceledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log(`Subscription canceled for user ${uid}`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      if (!subscriptionId) {
        console.error('invoice.payment_failed: missing subscription');
        return;
      }

      // Retrieve subscription to get firebaseUid
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const uid = subscription.metadata.firebaseUid;

      if (!uid) {
        console.error('invoice.payment_failed: missing metadata.firebaseUid');
        return;
      }

      await db.doc(`users/${uid}/subscription`).set(
        {
          status: subscription.status, // Will be 'past_due'
          lastPaymentError: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log(`Payment failed for user ${uid}: ${subscription.status}`);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}
