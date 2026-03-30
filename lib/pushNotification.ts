/**
 * lib/pushNotification.ts
 *
 * Sends FCM push notifications via the FCM v1 HTTP API.
 * Authenticates with a Google service account from FIREBASE_SERVICE_ACCOUNT env var.
 * If not set, push calls are silently skipped (logged at info level).
 *
 * Stale / unregistered tokens (404 / UNREGISTERED) are automatically deleted
 * from the StudentPushToken table.
 */
import { prisma } from '@/lib/prisma';

const FCM_URL = 'https://fcm.googleapis.com/v1/projects/markwise-b4197/messages:send';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

// Cached OAuth2 access token
let _accessToken: string | null = null;
let _tokenExpiry = 0;

async function getAccessToken(): Promise<string | null> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  // Return cached token if still valid (with 60 s buffer)
  if (_accessToken && Date.now() < _tokenExpiry - 60_000) return _accessToken;

  try {
    const { GoogleAuth } = require('google-auth-library') as typeof import('google-auth-library');
    const serviceAccount = JSON.parse(raw);
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: [FCM_SCOPE],
    });
    const client = await auth.getClient();
    const tokenResponse = await (client as any).getAccessToken();
    _accessToken = tokenResponse.token as string;
    // Google tokens typically expire in 3600 s
    _tokenExpiry = Date.now() + 3_500_000;
    return _accessToken;
  } catch (err) {
    console.error('[pushNotification] Failed to obtain OAuth2 token:', err);
    return null;
  }
}

export interface PushPayload {
  token: string;
  title: string;
  body: string;
  /** data values must all be strings */
  data?: Record<string, string>;
}

/**
 * Send a single FCM v1 push notification.
 * Returns true on success. On 404 (UNREGISTERED), deletes the stale token and returns false.
 */
export async function sendPushNotification(payload: PushPayload): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.info('[pushNotification] Firebase not configured — skipping push:', payload.title);
    return false;
  }

  try {
    const res = await fetch(FCM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: payload.token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data ?? {},
          android: {
            priority: 'high',
            notification: { channel_id: 'markwise_alerts' },
          },
          apns: {
            payload: { aps: { contentAvailable: true } },
          },
        },
      }),
    });

    if (res.ok) return true;

    const errorBody = await res.json().catch(() => ({})) as any;
    const status = errorBody?.error?.status as string | undefined;

    if (res.status === 404 || status === 'UNREGISTERED' || status === 'NOT_FOUND') {
      console.warn('[pushNotification] Stale token, deleting:', payload.token.slice(-12));
      await prisma.studentPushToken
        .deleteMany({ where: { fcmToken: payload.token } })
        .catch(() => {/* already gone */});
    } else {
      console.error('[pushNotification] FCM error', res.status, JSON.stringify(errorBody));
    }
    return false;
  } catch (err: any) {
    console.error('[pushNotification] Fetch failed:', err?.message ?? err);
    return false;
  }
}

/**
 * Send push notifications to multiple tokens concurrently.
 * All results are settled; individual failures are logged but do not throw.
 */
export async function sendPushNotificationBatch(payloads: PushPayload[]): Promise<void> {
  if (payloads.length === 0) return;
  await Promise.allSettled(payloads.map(sendPushNotification));
}

/**
 * Look up all FCM tokens for a set of studentIds and return a flat list of PushPayload objects.
 * Caller provides title, body, and data; this function adds the token field.
 */
export async function buildPayloadsForStudents(
  studentIds: string[],
  message: Omit<PushPayload, 'token'>,
): Promise<PushPayload[]> {
  if (studentIds.length === 0) return [];
  const rows = await prisma.studentPushToken.findMany({
    where: { studentId: { in: studentIds } },
    select: { fcmToken: true },
  });
  return rows.map((r) => ({ token: r.fcmToken, ...message }));
}

