const { prisma } = require('../lib/prisma');

async function main() {
  await prisma.timetable.create({
    data: {
      courseId: 'e1079db7-6210-48e7-8b48-ce5e3b57fefe',
      unitId: 'ea13798e-0346-4ea0-a8b4-22beb49a5261',
      lecturerId: '5717dd98-f1f5-43d1-9fa6-78970b4ee46d',
      roomId: '0257f57a-7c85-43b7-ab04-5453cd5853b7', // Library Room 5
      departmentId: '1e8f39a6-3c1b-4043-b795-47286d88baf8',
      day: 'Monday',
      startTime: '09:00',
      endTime: '11:00',
      semester: '1',
      yearOfStudy: '1',
      status: 'Confirmed',
      venueName: 'Sample Venue' // <-- Replace with actual room name or code if needed
    }
  });
  console.log('Timetable entry added!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
