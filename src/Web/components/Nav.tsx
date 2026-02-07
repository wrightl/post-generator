"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/posts", label: "Posts" },
  { href: "/generate", label: "Generate" },
  { href: "/profile", label: "Profile" },
];

export function Nav() {
  const pathname = usePathname();
  const { appUser, signOut } = useAuth();

  return (
    <nav
      className="nav-bar border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-[var(--text)] transition hover:text-[var(--primary)]"
        >
          <span className="text-xl" aria-hidden>✨</span>
          <span>Post Generator</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === href
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text)] hover:bg-[var(--border)]/50 hover:text-[var(--primary)]"
              }`}
            >
              {label}
            </Link>
          ))}
          <ThemeToggle />
          {appUser && (
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-red-500/10 hover:border-red-400/50 hover:text-red-600"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
