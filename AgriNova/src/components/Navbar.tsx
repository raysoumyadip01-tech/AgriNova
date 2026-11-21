import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#F8FAFC]/95 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0F172A]/95">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          className="font-display text-lg font-bold tracking-tight text-[#14532D] whitespace-nowrap shrink-0 dark:text-[#A3E635]"
        >
          AgriNova
        </Link>

        {/* Zone 2: 4 Single-line Navigation Links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a
            href="#platform"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#14532D] hover:underline hover:underline-offset-4 dark:hover:text-white"
          >
            Platform
          </a>
          <a
            href="#supply-chain"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#14532D] hover:underline hover:underline-offset-4 dark:hover:text-white"
          >
            Features
          </a>
          <a
            href="#roles"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#14532D] hover:underline hover:underline-offset-4 dark:hover:text-white"
          >
            Role Demos
          </a>
          <Link
            to="/auth"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#14532D] hover:underline hover:underline-offset-4 dark:hover:text-white"
          >
            Account Login
          </Link>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to={user ? '/dashboard' : '/auth'}
            className="hidden sm:inline-flex whitespace-nowrap shrink-0 items-center justify-center rounded-lg bg-[#14532D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#16A34A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
          >
            {user ? 'Open Workspace' : 'Sign In'}
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden dark:border-slate-700 dark:text-slate-200"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden dark:border-slate-800 dark:bg-[#1E293B]">
          <nav className="flex flex-col gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            <a href="#platform" onClick={() => setMobileOpen(false)} className="py-1.5">
              Platform
            </a>
            <a href="#supply-chain" onClick={() => setMobileOpen(false)} className="py-1.5">
              Features
            </a>
            <a href="#roles" onClick={() => setMobileOpen(false)} className="py-1.5">
              Role Demos
            </a>
            <Link to="/auth" onClick={() => setMobileOpen(false)} className="py-1.5">
              Account Login
            </Link>
            <Link
              to={user ? '/dashboard' : '/auth'}
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white"
            >
              {user ? 'Open Workspace' : 'Sign In'}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
