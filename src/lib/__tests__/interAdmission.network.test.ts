/**
 * interAdmission.network.test — the slow-internet contract of the admission
 * RPC layer: a NETWORK failure must be distinguishable from a SERVER verdict,
 * because the session hook logs the applicant out only on the latter.
 *
 * These are the exact strings supabase-js 2.117 produces (verified against
 * the installed library — a dead host resolves, never throws, with
 * error.message "TypeError: fetch failed").
 */
import { describe, expect, it } from "vitest";
import { isAdmissionNetworkError } from "@/lib/interAdmission";

describe("isAdmissionNetworkError", () => {
  it("flags the network-failure shapes supabase-js actually produces", () => {
    expect(isAdmissionNetworkError({ ok: false, error: "TypeError: fetch failed" })).toBe(true);   // Node / undici
    expect(isAdmissionNetworkError({ ok: false, error: "TypeError: Failed to fetch" })).toBe(true); // Chrome
    expect(isAdmissionNetworkError({ ok: false, error: "Load failed" })).toBe(true);                // Safari
    expect(isAdmissionNetworkError({ ok: false, error: "Request timed out after 20 seconds." })).toBe(true);
    expect(isAdmissionNetworkError({ ok: false, error: "The operation was aborted" })).toBe(true);
    expect(isAdmissionNetworkError({ network: true, error: "anything" })).toBe(true);               // explicit flag
  });

  it("does NOT flag real server verdicts", () => {
    expect(isAdmissionNetworkError({ ok: false, error: "Session expired. Please login again." })).toBe(false);
    expect(isAdmissionNetworkError({ ok: false, error: "Error! You have already applied for this program" })).toBe(false);
    expect(isAdmissionNetworkError({ ok: true })).toBe(false);
    expect(isAdmissionNetworkError(null)).toBe(false);
    expect(isAdmissionNetworkError(undefined)).toBe(false);
  });

  it("handles non-object shapes defensively", () => {
    expect(isAdmissionNetworkError("TypeError: fetch failed")).toBe(false); // string, not a result object
    expect(isAdmissionNetworkError({ error: 42 })).toBe(false);            // non-string error
  });
});
