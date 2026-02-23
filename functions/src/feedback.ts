import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { google } from 'googleapis';

const FEEDBACK_SHEET_ID = defineSecret('FEEDBACK_SHEET_ID');

// Simple in-memory rate limiting: max 5 submissions per IP per minute
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

export const submitFeedback = onRequest(
  {
    cors: ['https://pomodorotimer.vip', 'https://www.pomodorotimer.vip'],
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: [FEEDBACK_SHEET_ID],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    if (isRateLimited(ip)) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }

    const { message, page, userAgent } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }

    if (message.length > 2000) {
      res.status(400).json({ error: 'Message must be under 2000 characters.' });
      return;
    }

    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const email = await auth.getCredentials();
      console.log('Using service account:', email?.client_email || 'unknown');

      const sheets = google.sheets({ version: 'v4', auth });

      await sheets.spreadsheets.values.append({
        spreadsheetId: FEEDBACK_SHEET_ID.value(),
        range: 'Sheet1!A:D',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            new Date().toISOString(),
            message.trim(),
            page || '',
            userAgent || '',
          ]],
        },
      });

      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Failed to append feedback to sheet:', err);
      res.status(500).json({ error: 'Failed to submit feedback. Please try again.' });
    }
  }
);
