"use client";

/**
 * DEPRECATED — the admin shell now lives at `src/components/admin/admin-shell.tsx`
 * and is rendered by `src/app/admin/layout.tsx`.
 *
 * This file is kept only as a backwards-compatibility shim: existing admin
 * pages that import `AdminChrome`, `AdminDemoBanner`, `AdminTitle` from this
 * module continue to work, but `AdminChrome` is now a thin pass-through that
 * renders its children directly (the sidebar nav is provided by AdminShell).
 *
 * New admin pages should import from `@/components/admin/admin-shell` directly.
 */

import type { ReactNode } from "react";
import { AdminDemoBanner as NewBanner, AdminTitle as NewTitle } from "@/components/admin/admin-shell";

export function AdminChrome({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const AdminDemoBanner = NewBanner;
export const AdminTitle = NewTitle;
