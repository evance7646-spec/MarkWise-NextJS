import Link from "next/link";
import { Sparkles, Twitter, Linkedin, Github, Mail, MapPin, Phone } from "lucide-react";

const NAV_COLUMNS = [
  {
    heading: "Platform",
    links: [
      { label: "Features",         href: "/#features" },
      { label: "How It Works",     href: "/#how-it-works" },
      { label: "Pricing",          href: "/pricing" },
      { label: "For Institutions", href: "/#for-institutions" },
    ],
  },
  {
    heading: "Portals",
    links: [
      { label: "System Administrator", href: "/admin/register" },
      { label: "Academic Registrar",   href: "/admin/register" },
      { label: "Facilities Manager",   href: "/admin/register" },
      { label: "Department Admin",     href: "/admin/register" },
      { label: "Sign In",              href: "/admin/login" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us",         href: "/about" },
      { label: "Contact",          href: "/contact" },
      { label: "Blog",             href: "#" },
      { label: "Careers",          href: "#" },
      { label: "Privacy Policy",   href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

const SOCIALS = [
  { label: "Twitter",  href: "#", Icon: Twitter  },
  { label: "LinkedIn", href: "#", Icon: Linkedin },
  { label: "GitHub",   href: "#", Icon: Github   },
];

export default function AppFooter() {
  return (
    <footer className="bg-slate-950 text-slate-300">
      {/* Top gradient accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60" />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-12 py-16 md:grid-cols-12 lg:gap-8">

          {/* Brand / tagline */}
          <div className="md:col-span-4 space-y-6">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
                MarkWise
              </span>
            </Link>

            <p className="text-sm leading-relaxed text-slate-400 max-w-xs">
              A unified campus management platform — verified attendance, timetable coordination, room bookings, assignments, and analytics for modern higher education.
            </p>

            {/* Contact info */}
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-indigo-400" />
                <span>hello@markwise.app</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-indigo-400" />
                <span>Nairobi, Kenya</span>
              </li>
            </ul>

            {/* Social links */}
            <div className="flex items-center gap-3 pt-2">
              {SOCIALS.map(({ label, href, Icon }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className="h-9 w-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/25"
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {NAV_COLUMNS.map((col) => (
            <div key={col.heading} className="md:col-span-2 lg:col-span-2 xl:col-span-2 space-y-5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {col.heading}
              </h4>
              <nav className="flex flex-col gap-3">
                {col.links.map(({ label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="text-sm text-slate-400 hover:text-indigo-300 transition-colors duration-150"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}

          {/* Newsletter / CTA */}
          <div className="md:col-span-12 lg:col-span-2 space-y-5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Stay Updated
            </h4>
            <p className="text-sm text-slate-400">
              Get platform updates and education insights.
            </p>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex flex-col gap-2"
            >
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-indigo-500 hover:to-cyan-500 transition-all duration-200 shadow-md hover:shadow-indigo-500/30"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} MarkWise. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy</Link>
            <span className="text-slate-700">·</span>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms</Link>
            <span className="text-slate-700">·</span>
            <span>Made with <span className="text-red-600">♥</span> for modern education</span>
          </div>
        </div>
      </div>
    </footer>
  );
}