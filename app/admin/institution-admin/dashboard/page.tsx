import Link from "next/link";

export default function InstitutionPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-indigo-50 to-violet-50 px-6 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900">
      <main className="w-full max-w-2xl rounded-2xl border border-indigo-100 bg-white/90 p-10 text-center shadow-lg backdrop-blur-sm dark:border-indigo-500/30 dark:bg-slate-950/80">
        <h1 className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl dark:from-indigo-300 dark:to-violet-300">
          Institution Page
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-300">
          This is the institution workspace entry point.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-xl border border-indigo-200 bg-indigo-50/70 px-5 py-3 font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-400/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
        >
          Back to Landing Page
        </Link>
      </main>
    </div>
  );
}
