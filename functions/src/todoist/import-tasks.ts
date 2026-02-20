import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

interface TodoistTask {
  id: string;
  content: string;
  project_id?: string;
}

/**
 * Fetch tasks from Todoist API using the stored access token.
 * Returns a simplified task list for the client to display in the import dialog.
 */
export const importTodoistTasks = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to import Todoist tasks');
  }

  const uid = request.auth.uid;
  const db = getFirestore();

  // Retrieve stored token — never expose to client
  const userDoc = await db.collection('users').doc(uid).get();
  const token = userDoc.data()?.todoistToken as string | undefined;

  if (!token) {
    throw new HttpsError('failed-precondition', 'Todoist not connected. Please connect your Todoist account first.');
  }

  // Fetch tasks from Todoist API v1
  const tasksRes = await fetch('https://api.todoist.com/api/v1/tasks', {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Handle expired/revoked token — clear stored token and prompt reconnect
  if (tasksRes.status === 401) {
    await db.collection('users').doc(uid).set(
      { todoistToken: null, todoistConnectedAt: null },
      { merge: true }
    );
    throw new HttpsError(
      'unauthenticated',
      'Todoist token expired or revoked. Please reconnect your Todoist account.'
    );
  }

  if (!tasksRes.ok) {
    console.error('Todoist API error:', tasksRes.status);
    throw new HttpsError('internal', 'Failed to fetch tasks from Todoist');
  }

  const tasks = (await tasksRes.json()) as TodoistTask[];

  // Return only the fields the client needs — no token data
  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      content: t.content,
    })),
  };
});
