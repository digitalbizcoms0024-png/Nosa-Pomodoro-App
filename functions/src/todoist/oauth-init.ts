import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';

const TODOIST_CLIENT_ID = defineSecret('TODOIST_CLIENT_ID');

/**
 * Todoist OAuth initialization — generates the Todoist authorize URL with CSRF state.
 * Called by the client before opening the OAuth popup.
 */
export const todoistOauthInit = onCall(
  { secrets: [TODOIST_CLIENT_ID] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to connect Todoist');
    }

    const uid = request.auth.uid;
    const state = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10-minute TTL

    // Store state for CSRF validation on callback (one-time use)
    await getFirestore().collection('todoistOAuthStates').doc(state).set({
      uid,
      createdAt: now,
      expiresAt,
    });

    const params = new URLSearchParams({
      client_id: TODOIST_CLIENT_ID.value(),
      scope: 'data:read',
      state,
    });

    return { url: `https://api.todoist.com/oauth/authorize?${params}` };
  }
);
