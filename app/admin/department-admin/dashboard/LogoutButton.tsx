"use client";

export default function LogoutButton() {
  return (
    <button
      className="ml-auto flex items-center justify-center h-12 w-12 rounded-full border border-indigo-200 bg-white shadow-md transition hover:bg-indigo-100 dark:border-indigo-400/40 dark:bg-slate-900 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      aria-label="Logout"
      title="Logout"
      onClick={async () => {
        if (typeof window !== "undefined") {
          try {
            await fetch("/api/auth/admin/logout", { method: "POST", credentials: "include" });
          } catch {}
          window.localStorage.clear();
          window.sessionStorage.removeItem("tt_identity_v1");
          window.location.href = "/admin/department-admin/login";
        }
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="h-6 w-6 text-indigo-700 dark:text-indigo-200"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 12H9m0 0l3-3m-3 3l3 3"
        />
      </svg>
    </button>
  );
}
