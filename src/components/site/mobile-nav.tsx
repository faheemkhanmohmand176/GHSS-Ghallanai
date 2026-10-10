"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, ClipboardList, Trophy, Phone } from "lucide-react";

/**
 * MobileBottomNav — app-style thumb navigation for phones (§4.3).
 * Five destinations, 56px targets, gold active indicator, safe-area aware.
 * Hidden from lg upward; print styles exclude it.
 */

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/academics", label: "Programmes", icon: BookOpen },
  { href: "/admissions", label: "Admissions", icon: ClipboardList },
  { href: "/results", label: "Results", icon: Trophy },
  { href: "/contact", label: "Contact", icon: Phone },
] as const;

function isActive(pathname: string | undefined, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile quick navigation"
      className="mobile-nav grid grid-cols-5 lg:hidden"
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="mobile-nav-link"
          >
            <item.icon
              className={`h-5.5 w-5.5 transition-transform duration-150 ${
                active ? "scale-110" : ""
              }`}
              strokeWidth={active ? 2.25 : 1.75}
              aria-hidden
            />
            <span className="tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
