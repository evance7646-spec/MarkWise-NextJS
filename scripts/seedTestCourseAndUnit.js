// Run this script with: node seedTestCourseAndUnit.js

let fetchFn;
try {
  fetchFn = fetch;
} catch {
  fetchFn = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
}

const departmentId = '437ad0c0-ed92-40c5-9e5f-0e6ac314a074';

async function seed() {
  // Create a test course
  const courseRes = await fetchFn('http://localhost:3000/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'TEST101', name: 'Test Course', departmentId })
  });
  const course = await courseRes.json();
  console.log('Course:', course);

  // Create a test unit
  const unitRes = await fetchFn('http://localhost:3000/api/units', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'UNIT101', title: 'Test Unit', departmentId, courseId: course.id || course.course?.id || course.courseId })
  });
  const unit = await unitRes.json();
  console.log('Unit:', unit);
}

seed().catch(console.error);
