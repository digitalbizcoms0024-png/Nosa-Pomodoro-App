import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';

const TODOIST_CLIENT_ID = defineSecret('TODOIST_CLIENT_ID');
const TODOIST_CLIENT_SECRET = defineSecret('TODOIST_CLIENT_SECRET');
const TODOIST_REDIRECT_URI = defineSecret('TODOIST_REDIRECT_URI');

/**
 * Todoist OAuth callback handler — validates state, exchanges code for token,
 * stores token in Firestore, then redirects back to the app.
 * This is an HTTP endpoint registered as the OAuth redirect URI in Todoist's App Console.
 */
export const todoistOauthCallback = onRequest(
  { secrets: [TODOIST_CLIENT_ID, TODOIST_CLIENT_SECRET, TODOIST_REDIRECT_URI] },
  async (req, res) => {
    const { code, state, error } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    // Handle Todoist-side errors (e.g., user denied access)
    if (error) {
      res.redirect(`https://pomodorotimer.vip/?todoist=error&reason=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !state) {
      res.redirect('https://pomodorotimer.vip/?todoist=error&reason=missing_params');
      return;
    }

    const db = getFirestore();

    // Validate CSRF state
    const stateRef = db.collection('todoistOAuthStates').doc(state);
    const stateDoc = await stateRef.get();

    if (!stateDoc.exists) {
      res.redirect('https://pomodorotimer.vip/?todoist=error&reason=invalid_state');
      return;
    }

    const { uid, expiresAt } = stateDoc.data()!;

    // Delete state doc immediately — one-time use
    await stateRef.delete();

    // Check expiry
    if (new Date() > (expiresAt as FirebaseFirestore.Timestamp).toDate()) {
      res.redirect('https://pomodorotimer.vip/?todoist=error&reason=expired');
      return;
    }

    // Exchange code for access token (client_secret stays server-side)
    let accessToken: string;
    try {
      const tokenRes = await fetch('https://api.todoist.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: TODOIST_CLIENT_ID.value(),
          client_secret: TODOIST_CLIENT_SECRET.value(),
          code,
          redirect_uri: TODOIST_REDIRECT_URI.value(),
        }),
      });

      if (!tokenRes.ok) {
        console.error('Todoist token exchange failed:', tokenRes.status, await tokenRes.text());
        res.redirect('https://pomodorotimer.vip/?todoist=error&reason=token_exchange_failed');
        return;
      }

      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };

      if (!tokenData.access_token) {
        console.error('Todoist token exchange returned no access_token:', tokenData);
        res.redirect('https://pomodorotimer.vip/?todoist=error&reason=no_token');
        return;
      }

      accessToken = tokenData.access_token;
    } catch (err) {
      console.error('Todoist token exchange error:', err);
      res.redirect('https://pomodorotimer.vip/?todoist=error&reason=network_error');
      return;
    }

    // Store token in Firestore — encrypted at rest, never exposed to client
    await db.collection('users').doc(uid).set(
      { todoistToken: accessToken, todoistConnectedAt: new Date() },
      { merge: true }
    );

    res.redirect('https://pomodorotimer.vip/?todoist=success');
  }
);
