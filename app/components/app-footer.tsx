import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AppFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand column */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                MarkWise
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 max-w-sm">
              A unified platform for verified attendance, classroom coordination,
              assignments, and group workflows in modern higher education.
            </p>

            {/* Social links */}
            <div className="flex gap-4 pt-4">
              {["Twitter", "LinkedIn", "GitHub"].map((social) => (
                <Link
                  key={social}
                  href="#"
                  className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors duration-300"
                >
                  <span className="sr-only">{social}</span>
                  <div className="h-5 w-5" />
                </Link>
              ))}
            </div>
          </div>

          {/* Administration links */}
          <div>
            <h4 className="font-semibold text-lg mb-4 text-slate-900 dark:text-white">Administration</h4>
            <nav className="flex flex-col space-y-3">
              {["Institution", "Department", "Faculty", "Students"].map((item) => (
                <Link
                  key={item}
                  href={`/${item.toLowerCase()}/login`}
                  className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                >
                  {item}
                </Link>
              ))}
            </nav>
          </div>

          {/* Company links */}
          <div>
            <h4 className="font-semibold text-lg mb-4 text-slate-900 dark:text-white">Company</h4>
            <nav className="flex flex-col space-y-3">
              {["About Us", "Contact", "Privacy Policy", "Terms of Service"].map((item) => (
                <Link
                  key={item}
                  href="#"
                  className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                >
                  {item}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>&copy; {new Date().getFullYear()} MarkWise. All rights reserved.</p>
          <p className="mt-2">Made with ❤️ for modern education</p>
        </div>
      </div>
    </footer>
  );
}