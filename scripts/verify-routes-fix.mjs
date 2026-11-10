// Behavioral verification of scripts/site-routes.mjs after the fix.
// Run: node scripts/verify-routes-fix.mjs
import { classifyPath, isRemovedPath, normalizePath, isIndexablePath, PUBLIC_ROUTE_PATHS } from "./site-routes.mjs";

let pass = 0, fail = 0;
function expect(pathname, expected) {
  const got = classifyPath(pathname);
  const ok = got === expected;
  if (ok) { pass++; } else { fail++; console.log(`✗ ${pathname}: expected "${expected}", got "${got}"`); }
  return ok;
}

// ── Public routes (indexable, live-rendered, in sitemap) ──
for (const p of PUBLIC_ROUTE_PATHS) expect(p, "public");

// ── App routes (real screens, noindex, NOT live-rendered, NOT in sitemap) ──
expect("/admission/apply", "app");
expect("/admission/portal", "app");
expect("/admission/profile", "app");
expect("/admission/ssc", "app");
expect("/search", "app");

// ── THE FIX: /admission/application/<ref> is now "app" (was "detail") ──
expect("/admission/application/GHSS-2026-ABC123", "app");
expect("/admission/application/abc123", "app");

// ── Notice details stay "detail" (live-rendered, canonical, indexable) ──
expect("/notices/6e48c1d9-7534-4a38-b435-0d968d024230", "detail");

// ── Private areas ──
expect("/admin", "private");
expect("/admin/x", "private");
expect("/dashboard", "private");
expect("/auth/signin", "private");
expect("/teacher", "private");
expect("/teacher/x", "private");

// ── Removed features ──
if (!isRemovedPath("/gallery") || !isRemovedPath("/notes/x") || !isRemovedPath("/duty")) { fail++; console.log("✗ isRemovedPath regression"); } else pass++;

// ── Junk URLs → notfound (real 404) ──
expect("/admission/application", "notfound");   // no id
expect("/admission/application/", "notfound");  // empty id normalises to /admission/application
expect("/About", "notfound");
expect("/nonexistent", "notfound");
expect("/gallery.jpg", "notfound");
expect("/admission/loginx", "notfound");

// ── isIndexablePath must NEVER include app/private/notfound ──
const notIndexable = ["/admission/apply", "/admission/portal", "/admission/application/REF1", "/search", "/admin", "/auth/signin"];
for (const p of notIndexable) {
  if (isIndexablePath(p)) { fail++; console.log(`✗ ${p} must NOT be indexable`); } else pass++;
}

// ── normalizePath sanity ──
if (normalizePath("/about/") !== "/about" || normalizePath("/") !== "/") { fail++; console.log("✗ normalizePath regression"); } else pass++;

console.log(`\n${fail === 0 ? "✅ ALL BEHAVIOURAL CHECKS PASSED" : "❌ FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
