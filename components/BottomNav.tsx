"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ScrollText, Briefcase, User } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Home", Icon: Home },
  { href: "/dashboard/sessions", label: "Sessions", Icon: ScrollText },
  { href: "/dashboard/jobs", label: "Jobs", Icon: Briefcase },
  { href: "/dashboard/profile", label: "Profile", Icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname.startsWith(href) || pathname === href;
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70"
    >
      <div className="mx-auto max-w-[460px] grid grid-cols-4">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex flex-col items-center gap-1 py-3 transition-colors focus:outline-none focus-visible:bg-primary/[0.06] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className={`absolute top-0 h-px w-8 bg-primary origin-center transition-transform duration-300 ${active ? "scale-x-100" : "scale-x-0"}`} />
              <Icon size={18} strokeWidth={1.5} />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em]">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
