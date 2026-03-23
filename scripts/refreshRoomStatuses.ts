// scripts/refreshRoomStatuses.ts
// Run this script every minute using a scheduler (e.g., cron, PM2, or a cloud job)

import { refreshRoomStatuses } from '../lib/roomBookingService';

(async () => {
  try {
    await refreshRoomStatuses();
    console.log('Room statuses refreshed at', new Date().toISOString());
    process.exit(0);
  } catch (err) {
    console.error('Failed to refresh room statuses:', err);
    process.exit(1);
  }
})();
