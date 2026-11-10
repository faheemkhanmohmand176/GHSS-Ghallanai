// Final config-vs-code cross-verification (simulates Vercel routing order:
// headers → redirects → middleware → rewrites → filesystem).
// Run: node scripts/verify-vercel-config.mjs
import { readFileSync } from "node:fs";
import { classifyPath, PUBLIC_ROUTE_PATHS, isRemovedPath, REMOVED_PATHS } from "./site-routes.mjs";

const vj = JSON.parse(readFileSync("vercel.json", "utf8"));
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log("✗ " + msg); } };

// ── 1. Redirects: every redirect source must NOT be a public route, a removed
//        path, or missing from the React app — and its destination must be a
//        REAL route that serves 200 (never another redirect → no chains). ──
for (const r of vj.redirects) {
  ok(!PUBLIC_ROUTE_PATHS.includes(r.source), `redirect source ${r.source} must not be a public route`);
  ok(!isRemovedPath(r.source), `redirect source ${r.source} must not shadow a 410 removed path`);
  ok(classifyPath(r.destination) === "public" || classifyPath(r.destination) === "app",
     `redirect destination ${r.destination} must be a real served route`);
  ok(r.permanent === true, `redirect ${r.source} must be permanent (301/308), not temporary`);
}

// ── 2. The two client-redirecting URLs are now platform redirects ──
const redirectSources = vj.redirects.map((r) => r.source);
ok(redirectSources.includes("/admission/login"), "/admission/login has a platform 308 redirect");
ok(redirectSources.includes("/admission/register"), "/admission/register has a platform 308 redirect");
const loginDest = vj.redirects.find((r) => r.source === "/admission/login")?.destination;
const regDest = vj.redirects.find((r) => r.source === "/admission/register")?.destination;
ok(loginDest === "/admission/portal", `/admission/login → ${loginDest} (the page that replaced it)`);
ok(regDest === "/admission/portal", `/admission/register → ${regDest} (the page that replaced it)`);
ok(!redirectSources.includes("/result-card") === false, "/result-card 308 kept (moved page, correct)");

// ── 3. No redirect chains: no redirect destination is itself a redirect source ──
for (const r of vj.redirects) {
  ok(!redirectSources.includes(r.destination), `no chain: ${r.source} → ${r.destination} → …`);
}

// ── 4. X-Robots-Tag noindex headers cover every crawlable app screen ──
const noindexSources = vj.headers
  .filter((h) => h.headers.some((x) => x.key.toLowerCase() === "x-robots-tag" && /noindex/.test(x.value)))
  .map((h) => h.source);
const appScreens = ["/admission/apply", "/admission/portal", "/admission/profile", "/admission/ssc", "/admission/application/:id", "/search"];
for (const s of appScreens) ok(noindexSources.includes(s), `X-Robots-Tag noindex header present for ${s}`);

// ── 5. No noindex header accidentally covers a PUBLIC route ──
for (const h of noindexSources) {
  const base = h.replace(/\/:id$/, "");
  ok(!PUBLIC_ROUTE_PATHS.includes(base), `noindex header ${h} must not cover public route ${base}`);
}

// ── 6. Removed paths are still 410 (not in redirects — platform would shadow) ──
for (const p of REMOVED_PATHS) ok(!redirectSources.includes(p), `${p} must stay 410 (not be a redirect)`);

// ── 7. Sitemap URLs can never redirect: every public route is a final URL ──
for (const p of PUBLIC_ROUTE_PATHS) {
  ok(!redirectSources.includes(p), `sitemap URL ${p} must not be a redirect source`);
  ok(!p.endsWith("/index.html"), `sitemap URL ${p} is clean (no /index.html)`);
  ok(p === "/" || !p.endsWith("/"), `sitemap URL ${p} has no trailing slash`);
}

// ── 8. The redirects do NOT fight the rewrites for the 10 public routes ──
const rewrittenPublic = vj.rewrites.map((r) => r.source).filter((s) => PUBLIC_ROUTE_PATHS.includes(s));
ok(rewrittenPublic.length === 9, `9 non-root public routes keep their prerender rewrites (got ${rewrittenPublic.length})`);

console.log(`\n${fail === 0 ? "✅ ALL CONFIG CROSS-CHECKS PASSED" : "❌ FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
