"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/posts", label: "Posts" },
  { href: "/generate", label: "Generate" },
];

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 14a4 4 0 0 0 4-4 4 4 0 0 0-4-4 4 4 0 0 0-4 4 4 4 0 0 0 4 4z" />
      <path d="M6 20c2-2 4-3 6-3s4 1 6 3" />
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { appUser } = useAuth();

  if (!appUser) return null;

  const displayName = appUser?.name?.trim() || appUser?.email || "Profile";

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
          {appUser && (
            <Link
              href="/profile"
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === "/profile"
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text)] hover:bg-[var(--border)]/50 hover:text-[var(--primary)]"
              }`}
              aria-label={`Profile for ${displayName}`}
            >
              {appUser.avatarUrl ? (
                <img
                  src={appUser.avatarUrl}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
                />
              ) : (
                <UserIcon className="h-4 w-4 shrink-0" />
              )}
              <span className="max-w-[120px] truncate sm:max-w-[180px]">{displayName}</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
