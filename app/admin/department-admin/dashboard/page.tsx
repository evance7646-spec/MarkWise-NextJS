export default function DepartmentPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 dark:bg-slate-900">
      <header className="mb-8">
        <h1 className="bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl dark:from-indigo-300 dark:to-emerald-300">
          Department Overview
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-300">
          Welcome! Here you can monitor attendance, engagement, room status, assignments, and recent activity for your department.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Quick Stats Cards */}
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center dark:bg-slate-950">
          <span className="text-2xl font-semibold text-green-600">92%</span>
          <span className="mt-2 text-gray-700 dark:text-zinc-300">Attendance Rate</span>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center dark:bg-slate-950">
          <span className="text-2xl font-semibold text-blue-600">87%</span>
          <span className="mt-2 text-gray-700 dark:text-zinc-300">Engagement Score</span>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center dark:bg-slate-950">
          <span className="text-2xl font-semibold text-yellow-600">12</span>
          <span className="mt-2 text-gray-700 dark:text-zinc-300">Rooms Available</span>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center dark:bg-slate-950">
          <span className="text-2xl font-semibold text-red-600">5</span>
          <span className="mt-2 text-gray-700 dark:text-zinc-300">Late Assignments</span>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Interactive Charts Placeholder */}
        <div className="bg-white rounded-lg shadow p-6 dark:bg-slate-950">
          <h2 className="text-xl font-bold text-blue-900 dark:text-blue-300 mb-4">Attendance Trends</h2>
          <div className="h-40 flex items-center justify-center text-gray-400 dark:text-zinc-500">[Chart Placeholder]</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 dark:bg-slate-950">
          <h2 className="text-xl font-bold text-blue-900 dark:text-blue-300 mb-4">Room Usage</h2>
          <div className="h-40 flex items-center justify-center text-gray-400 dark:text-zinc-500">[Chart Placeholder]</div>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-6 dark:bg-slate-950">
        <h2 className="text-xl font-bold text-blue-900 dark:text-blue-300 mb-4">Recent Activity</h2>
        <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
          <li className="py-2 text-gray-700 dark:text-zinc-300">Attendance session started for Unit ABC123</li>
          <li className="py-2 text-gray-700 dark:text-zinc-300">Room 204 reserved for tutorial</li>
          <li className="py-2 text-gray-700 dark:text-zinc-300">Assignment submitted by Student X</li>
          <li className="py-2 text-gray-700 dark:text-zinc-300">Group B assignment deadline extended</li>
        </ul>
      </section>
    </div>
  );
}
