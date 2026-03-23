import { prisma } from '../lib/prisma.js';
import { recomputeRoomStatus } from '../lib/roomBookingService.js';

async function updateOccupiedBookings() {
  const now = new Date();
  // Find all reserved bookings that should now be occupied
  const bookings = await prisma.booking.findMany({
    where: {
      status: 'reserved',
      startAt: { lte: now },
      endAt: { gt: now },
    },
    select: { id: true, roomId: true },
  });

  for (const booking of bookings) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'occupied' },
    });
    // Recompute room status
    await recomputeRoomStatus(prisma, booking.roomId, 'booking.occupied', 'system');
  }
}

updateOccupiedBookings()
  .then(() => {
    console.log('Occupied bookings and room statuses updated.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error updating occupied bookings:', err);
    process.exit(1);
  });
