// @vitest-environment node
/**
 * src/lib/__tests__/securityMigration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Regression tests for the three verified vulnerabilities and the migration
 * that closes them.
 *
 * These are STATIC assertions over the migration SQL and the application
 * source. That is deliberate: the fixes live in the DATABASE, so there is no
 * TypeScript behaviour to unit-test — but a migration can be edited,
 * re-ordered or accidentally deleted, and a static check fails loudly at
 * build time in a way a runtime test on a deployed database cannot.
 *
 * THE THREE VULNERABILITIES
 * ─────────────────────────
 * 1. PAYMENT BYPASS — `inter_safepay_apply` and `inter_payment_context`
 *    were executable by the anonymous role (migration 27's bulk grant
 *    undid migration 23's deliberate revoke), and `inter_apply` was open
 *    too (bypassing the Turnstile captcha on the auth-gateway).
 * 2. TRACKER ENUMERATION — `inter_track_by_id` had no rate limiting at
 *    all; 130 consecutive anonymous calls against the live database were
 *    measured with 0 rejections.
 * 3. LEGACY TABLE RLS — blanket SELECT policies (`USING (true)`) on
 *    results / students / fee_vouchers / admissions / admission_documents,
 *    and blanket read+update policies on profiles for ANY signed-in user.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const MIG_DIR = path.join(ROOT, "Supabase", "Migration");

function readMig(name: string): string {
  return readFileSync(path.join(MIG_DIR, name), "utf8");
}
function readSrc(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

const MIG33 = "33_security_hardening_inter_admission.sql";
const MIG27 = "27_admission_status_payment_flow.sql";

describe("migration 33 exists and is the security fix", () => {
  it("the migration file is present", () => {
    expect(existsSync(path.join(MIG_DIR, MIG33))).toBe(true);
  });

  it("it sorts after migration 31 so it runs last", () => {
    const files = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql"));
    const last = files[files.length - 1];
    expect(last).toBe(MIG33);
  });
});

describe("fix 1 — the payment bypass", () => {
  const sql = readMig(MIG33);

  it("defaults to DENY for every inter_* function, for every overload", () => {
    // The pg_proc loop is what makes this correct: an explicit
    // "REVOKE ... ON FUNCTION f(a,b)" only covers ONE arity, and a
    // function with a DEFAULT argument has one pg_proc row per arity.
    expect(sql).toContain("pg_get_function_identity_arguments");
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated"
    );
  });

  it("revokes from PUBLIC as well as anon (a fresh function gets EXECUTE from PUBLIC)", () => {
    expect(sql).toMatch(/FROM PUBLIC, anon, authenticated/);
  });

  it("keeps inter_safepay_apply / inter_payment_context / inter_apply server-only", () => {
    expect(sql).toContain("'inter_apply','inter_safepay_apply','inter_payment_context'");
    // They must appear in the SERVER-ONLY block, never in the public list.
    const publicBlock = sql.slice(
      sql.indexOf("inter_session_state"),
      sql.indexOf("inter_session_state") + 1200
    );
    expect(publicBlock).not.toContain("inter_safepay_apply");
    expect(publicBlock).not.toContain("inter_payment_context");
    expect(publicBlock).not.toContain("'inter_apply'");
  });

  it("the public allow-list contains the applicant portal and the public catalogue", () => {
    for (const fn of [
      "inter_session_state", "inter_logout", "inter_save_personal", "inter_save_ssc",
      "inter_check_quota", "inter_draft_check_quota", "inter_submit_application",
      "inter_edit_application", "inter_proceed_payment", "inter_application_detail",
      "inter_programs_list", "inter_ucs_list", "inter_merit_lists_public",
      "inter_merit_list_view", "inter_track_by_id",
    ]) {
      expect(sql).toContain(`'${fn}'`);
    }
  });

  it("migration 27's bulk loop can no longer re-open the bypass", () => {
    const m27 = readMig(MIG27);
    // The loop must now DEFAULT-DENY (public + anon + authenticated) before
    // granting anything — that is what makes it allow-list based.
    expect(m27).toContain(
      "REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated"
    );
    // The old "skip these two names" branches are gone: a name-based skip
    // list is exactly how inter_safepay_apply slipped through.
    expect(m27).not.toContain("ELSIF r.proname IN ('inter_register','inter_login') THEN");
    expect(m27).not.toContain("ELSIF r.proname = 'inter_track' THEN");
    // …and the public surface is named explicitly.
    expect(m27).toContain("'inter_track_by_id'");
    expect(m27).toContain("GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role");
  });
});

describe("fix 2 — the admission tracker", () => {
  const sql = readMig(MIG33);

  it("drops the broken legacy tracker (STABLE + INSERT can never work)", () => {
    // All three arities are dropped. The DROPs run inside a DO block with an
    // exception handler, so a leftover dependency can never abort the whole
    // migration — but the function is revoked from anon either way.
    for (const sig of [
      "public.inter_track(text, text, text)",
      "public.inter_track(text, text)",
      "public.inter_track(text)",
    ]) {
      expect(sql, sig).toContain(`'${sig}'`);
    }
    expect(sql).toContain("DROP FUNCTION IF EXISTS %s");
  });

  it("the tracker is VOLATILE (it writes an attempt record)", () => {
    expect(sql).toMatch(/inter_track_by_id\(p_tracking_id text\)\s*\nRETURNS jsonb\s*\nLANGUAGE plpgsql VOLATILE/);
  });

  it("rate-limits per client IP", () => {
    expect(sql).toContain("'track_ip'");
    expect(sql).toContain("x-forwarded-for");
    expect(sql).toContain("v_max_ip");
  });

  it("rate-limits per reference", () => {
    expect(sql).toContain("'track_id'");
    expect(sql).toContain("v_max_id");
  });

  it("records only FAILED lookups, so a real applicant is never throttled", () => {
    expect(sql).toContain("success = false");
    // The success path must not insert an attempt row.
    const fn = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.inter_track_by_id"));
    const successPart = fn.slice(fn.indexOf("-- Found: no attempt is recorded"));
    expect(successPart).not.toContain("INSERT INTO public.security_attempts");
  });

  it("never stores a raw IP or a raw reference", () => {
    expect(sql).toContain("md5(v_ip)");
    expect(sql).toContain("md5(v_key)");
  });

  it("raises the tracking-id entropy floor from 6 to 8 characters", () => {
    expect(sql).toContain("GREATEST(8, p_len)");
  });

  it("pins the tracking-id format so it can never become sequential again", () => {
    expect(sql).toContain("inter_applications_tracking_id_format");
    expect(sql).toMatch(/CHECK \(tracking_id ~ '\^\[A-Z\]\{3\}\[0-9\]\{4\}-\[A-Z0-9\]\{6,8\}\$'\)/);
  });
});

describe("fix 3 — the legacy table RLS", () => {
  const sql = readMig(MIG33);

  it("removes the blanket public read on results", () => {
    expect(sql).toContain("DROP POLICY IF EXISTS results_public_read ON public.results");
  });

  it("keeps published results public and the rest admin-only", () => {
    expect(sql).toContain("CREATE POLICY results_published_public ON public.results");
    expect(sql).toContain("USING (is_published = true)");
  });

  it("exposes the publish SCHEDULE without exposing the results", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.result_schedule(p_scope text)");
    expect(sql).toContain("GRANT  EXECUTE ON FUNCTION public.result_schedule(text) TO anon");
    // The function must return the schedule columns only.
    const fn = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.result_schedule"));
    expect(fn.slice(0, 900)).toContain("r.class::text, r.exam_type::text, r.year::integer, r.publish_at");
  });

  it("removes the unused PII columns from the student table", () => {
    expect(sql).toContain("ALTER TABLE public.students DROP COLUMN IF EXISTS father_cnic");
    expect(sql).toContain("ALTER TABLE public.students DROP COLUMN IF EXISTS contact_number");
  });

  it("scopes the public student read to students with a published result", () => {
    expect(sql).toContain("DROP POLICY IF EXISTS students_public_read ON public.students");
    expect(sql).toContain("r.is_published = true");
  });

  it("removes the blanket policies on fee_vouchers, admissions, admission_documents and profiles", () => {
    for (const p of [
      "fv_anon_tracker_read", "fv_anon_admission_read", "fv_any_user_read",
      "admissions_public_insert", "admissions_public_select",
      "admissions_public_select_own", "admissions_self_select",
      "admission_docs_public_insert", "admission_docs_public_select",
      "admin_read_all_profiles", "admin_update_all_profiles",
    ]) {
      // The statement is aligned with padding spaces in the migration, so
      // match on whitespace rather than an exact string.
      const re = new RegExp(`DROP POLICY IF EXISTS\\s+${p}\\s+ON public\\.`);
      expect(re.test(sql), `DROP POLICY for ${p}`).toBe(true);
    }
  });
});

describe("the application no longer reads unpublished results directly", () => {
  const files = [
    "src/hooks/useResultsCountdown.ts",
    "src/pages/Home.tsx",
    "src/lib/autoPublish.ts",
  ];

  it("no file SELECTS unpublished results any more", () => {
    for (const f of files) {
      const src = readSrc(f);
      // A SELECT chain that filters to is_published = false would need a
      // blanket SELECT policy on `results` — the very policy this change
      // removes. The admin publish action (an UPDATE with the same filter)
      // is allowed to stay: it is an UPDATE, and RLS gives it no anon path.
      const selects = src.match(/\.from\("results"\)[\s\S]{0,400}?\.select\([\s\S]{0,400}?\.eq\(\s*["']is_published["']\s*,\s*false\s*\)/g);
      expect(selects, f).toBeNull();
    }
  });

  it("the admin publish UPDATE is untouched (RLS gives anon no path to it)", () => {
    const src = readSrc("src/lib/autoPublish.ts");
    expect(src).toContain('.update({ is_published: true, publish_at: null })');
  });

  it("every file goes through the shared schedule helper", () => {
    for (const f of files) {
      expect(readSrc(f), f).toContain("fetchResultSchedule");
    }
  });

  it("the helper calls the SECURITY DEFINER RPC, not the table", () => {
    const helper = readSrc("src/lib/resultSchedule.ts");
    expect(helper).toContain('supabase.rpc("result_schedule"');
    expect(helper).not.toContain('.from("results")');
  });
});
