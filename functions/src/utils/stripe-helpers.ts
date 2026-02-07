import Stripe from 'stripe';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (only once)
if (getApps().length === 0) {
  initializeApp();
}

// Lazy-initialized Stripe client
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return stripeClient;
}

// Lazy-initialized Firestore
let firestoreDb: FirebaseFirestore.Firestore | null = null;

export function getDb(): FirebaseFirestore.Firestore {
  if (!firestoreDb) {
    firestoreDb = getFirestore();
  }
  return firestoreDb;
}

// Premium status constants
export const PREMIUM_STATUSES = ['active', 'trialing', 'past_due', 'lifetime'] as const;
