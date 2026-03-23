const SIGNALING_URL = process.env.SIGNALING_URL || 'http://localhost:3001';

/**
 * Asks the signaling server to emit `event` to all sockets in `room`.
 * Silently swallows errors so that a downed signaling server never breaks REST routes.
 */
export async function emitToRoom(
  room: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(`${SIGNALING_URL}/internal/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, event, data }),
    });
  } catch {
    // Signaling server may not be running in dev; non-fatal
  }
}
