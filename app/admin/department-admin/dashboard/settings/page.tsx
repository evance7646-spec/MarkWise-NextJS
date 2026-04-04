export default function DepartmentSettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-6 dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-violet-500/10">
        <h1 className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl dark:from-indigo-300 dark:to-violet-300">
          Settings
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-300">
          Configure department preferences, policies, and access options.
        </p>
      </section>

      <article className="rounded-xl border border-indigo-100 bg-white/90 p-5 shadow-sm dark:border-indigo-500/30 dark:bg-slate-950/80">
        <h2 className="text-base font-semibold text-foreground">Configuration</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Manage access controls, defaults, and operational settings for your department.
        </p>
      </article>
    </div>
  );
}
