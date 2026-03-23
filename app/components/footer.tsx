import React from "react";

export default function Footer() {
  return (
    <footer className="border-t-2 border-indigo-200 dark:border-indigo-800 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center sm:text-left">
            © {new Date().getFullYear()} MarkWise. AI-powered optimization
          </p>
          <div className="flex items-center gap-4">
            <button className="text-xs text-slate-500 hover:text-indigo-600 transition-colors">Settings</button>
            <button className="text-xs text-slate-500 hover:text-indigo-600 transition-colors">Help</button>
            <button className="text-xs text-slate-500 hover:text-indigo-600 transition-colors">API</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
