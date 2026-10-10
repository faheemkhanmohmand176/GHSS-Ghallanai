import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLoginForm } from "@/components/site/admin-login-form";
import { CrestMark } from "@/components/site/crest";

export const metadata: Metadata = {
  title: "Sign In — GHSS Ghallanai Admin",
  description: "Administrator and staff sign-in for the GHSS Ghallanai school platform.",
  robots: { index: false, follow: false },
};

/**
 * /admin/login — lives OUTSIDE the gated /admin layout (route group) so the
 * sign-in screen itself is reachable. Verification happens client-side with
 * Supabase Auth AND server-side in the admin layout + RLS policies.
 */
export default function AdminLoginPage() {
  return (
    <div className="flex min-h-svh flex-col bg-primary-strong dark:bg-[#0a1810]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <CrestMark className="mx-auto h-16 w-16" />
          <h1 className="mt-4 font-display text-2xl font-bold text-white">
            GHSS <span className="text-gold">Ghallanai</span>
          </h1>
          <p className="mt-1 text-small text-[#E8F5EC]/75">
            Administrator &amp; staff sign-in
          </p>
        </div>
        <Suspense fallback={null}>
          <AdminLoginForm />
        </Suspense>
        <p className="mt-8 text-center text-xs text-[#E8F5EC]/60">
          Access is granted through the profiles table by an existing administrator.
          Students and parents do not need an account — every public page works without one.
        </p>
      </div>
    </div>
  );
}
