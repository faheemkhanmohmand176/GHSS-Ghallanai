// @vitest-environment node
/**
 * src/lib/__tests__/admissionStatus.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the shared admission status model — the single place that
 * decides what the admin console and the public Track Application page show.
 *
 * The rules under test:
 *
 *   1. The processing fee and the workflow stage are TWO different facts.
 *      The fee lives in `payment_status` and is only ever changed by the
 *      Fee action; the stage lives in `status` and is only ever changed by
 *      the Status action.  The admin may choose exactly five workflow
 *      stages — and none of them may be a payment state, which is what used
 *      to make the two dropdowns repeat each other.
 *   2. The public tracker must NEVER claim a payment that did not happen:
 *      "Fee Paid" / "Payment confirmed" is only ever shown when
 *      payment_status is really 'paid'.
 *   3. The tracker step is derived from both facts, so an old row whose
 *      status and payment disagree is surfaced as a warning instead of
 *      being silently believed.
 *   4. The status badge in the admin table must not repeat the fee badge:
 *      'fee_paid' is a payment state, so the admin sees "Awaiting Review".
 */
import { describe, expect, it } from "vitest";
import {
  TRACK_STEPS, WORKFLOW_STAGES, currentStage, normPayment, normStatus,
  paymentMethodLabel, resolveStage, stageLabel, suggestedStage,
} from "../admissionStatus";

describe("workflow stages", () => {
  it("offers exactly five stages and none of them is a payment state", () => {
    expect(WORKFLOW_STAGES.map((s) => s.value)).toEqual([
      "under_review", "merit_listed", "admitted", "rejected", "cancelled",
    ]);
    const values = WORKFLOW_STAGES.map((s) => s.value);
    expect(values).not.toContain("fee_paid");
    expect(values).not.toContain("fee_pending");
    expect(values).not.toContain("submitted");
  });

  it("marks the post-payment stages as requiring the fee", () => {
    const requiresFee = WORKFLOW_STAGES.filter((s) => s.requiresFee).map((s) => s.value);
    expect(requiresFee).toEqual(["under_review", "merit_listed", "admitted"]);
    // rejected / cancelled can happen at any time
    expect(WORKFLOW_STAGES.find((s) => s.value === "rejected")!.requiresFee).toBe(false);
    expect(WORKFLOW_STAGES.find((s) => s.value === "cancelled")!.requiresFee).toBe(false);
  });

  it("recognises the current stage only for real workflow stages", () => {
    expect(currentStage("under_review")?.label).toBe("Under Review");
    expect(currentStage("fee_paid")).toBeNull();
    expect(currentStage("submitted")).toBeNull();
  });
});

describe("stageLabel — the admin status badge", () => {
  it("never repeats the fee badge", () => {
    // 'fee_paid' is a payment state → the admin must not see "Fee Paid" in
    // the status column as well, that is exactly the repetition that was
    // reported.  The fee badge already says "Paid".
    expect(stageLabel("fee_paid")).toBe("Awaiting Review");
    expect(stageLabel("fee_pending")).toBe("Applied");
    expect(stageLabel("submitted")).toBe("Applied");
    expect(stageLabel("under_review")).toBe("Not Merit Listed");
    expect(stageLabel("merit_listed")).toBe("Merit Listed");
    expect(stageLabel("admitted")).toBe("Admitted");
    expect(stageLabel("rejected")).toBe("Rejected");
    expect(stageLabel("cancelled")).toBe("Cancelled");
  });

  it("does not produce any label equal to a fee MILESTONE label", () => {
    // "Paid" and "Pending" are the payment milestones that used to show up
    // in BOTH columns.  ("Rejected" is legitimately both a payment state and
    // a workflow stage — it means the same thing either way, and the two
    // live in separate columns.)
    const feeMilestones = ["Paid", "Pending"];
    for (const s of ["submitted", "fee_pending", "fee_paid", "under_review", "merit_listed", "admitted", "rejected", "cancelled"]) {
      expect(feeMilestones).not.toContain(stageLabel(s));
    }
  });
});

describe("resolveStage — the public tracker", () => {
  it("shows a fee-pending application on step 1", () => {
    const st = resolveStage("submitted", "pending");
    expect(st.label).toBe("Fee Pending");
    expect(st.step).toBe(1);
    expect(st.paid).toBe(false);
    expect(st.feeDue).toBe(true);
    expect(st.complete).toBe(false);
    expect(st.closed).toBe(false);
  });

  it("shows a paid application on step 2", () => {
    const st = resolveStage("fee_paid", "paid");
    expect(st.label).toBe("Fee Paid");
    expect(st.step).toBe(2);
    expect(st.paid).toBe(true);
    expect(st.note).toContain("Payment confirmed");
  });

  it("walks the workflow steps 3 → 4 → 5", () => {
    expect(resolveStage("under_review", "paid").step).toBe(3);
    expect(resolveStage("merit_listed", "paid").step).toBe(4);
    const admitted = resolveStage("admitted", "paid");
    expect(admitted.step).toBe(5);
    expect(admitted.complete).toBe(true);
    expect(admitted.label).toBe("Admitted");
  });

  it("NEVER claims a payment that did not happen", () => {
    // status says fee_paid but the fee was never recorded — the fee wins
    const st = resolveStage("fee_paid", "pending");
    expect(st.label).toBe("Fee Pending");
    expect(st.paid).toBe(false);
    expect(st.note).not.toContain("Payment confirmed");
    expect(st.note).not.toContain("Payment of Rs");
    expect(st.step).toBe(1);
  });

  it("surfaces a contradiction between status and payment as a warning", () => {
    const st = resolveStage("under_review", "pending");
    expect(st.warning).toBeTruthy();
    expect(st.warning).toMatch(/fee/i);
    // the tracker must not advance past the unpaid fee
    expect(st.step).toBe(1);
    expect(st.complete).toBe(false);
  });

  it("has no warning when the two facts agree", () => {
    expect(resolveStage("under_review", "paid").warning).toBeNull();
    expect(resolveStage("submitted", "pending").warning).toBeNull();
    expect(resolveStage("admitted", "paid").warning).toBeNull();
  });

  it("closes the tracker for rejected and cancelled", () => {
    for (const s of ["rejected", "cancelled"]) {
      const st = resolveStage(s, "paid");
      expect(st.closed).toBe(true);
      expect(st.step).toBe(0);
      expect(st.complete).toBe(false);
      expect(st.next.length).toBeGreaterThan(0);
    }
  });

  it("always explains what happens next", () => {
    const states: Array<[string, string]> = [
      ["submitted", "pending"], ["fee_paid", "paid"], ["under_review", "paid"],
      ["merit_listed", "paid"], ["admitted", "paid"], ["rejected", "paid"],
    ];
    for (const [status, pay] of states) {
      const st = resolveStage(status, pay);
      expect(st.next.length).toBeGreaterThan(10);
      expect(st.note.length).toBeGreaterThan(10);
    }
  });

  it("treats a missing / broken payment_status as unpaid", () => {
    const st = resolveStage("fee_paid", null);
    expect(st.paid).toBe(false);
    expect(st.label).toBe("Fee Pending");
  });
});

describe("suggestedStage — what the admin dialog preselects", () => {
  it("preselects the natural next stage", () => {
    expect(suggestedStage("submitted")).toBe("under_review");
    expect(suggestedStage("fee_pending")).toBe("under_review");
    expect(suggestedStage("fee_paid")).toBe("under_review");
    expect(suggestedStage("under_review")).toBe("merit_listed");
    expect(suggestedStage("merit_listed")).toBe("admitted");
  });

  it("never preselects a payment state", () => {
    for (const s of ["submitted", "fee_pending", "fee_paid", "under_review", "merit_listed", "admitted", "rejected", "cancelled"]) {
      expect(WORKFLOW_STAGES.map((w) => w.value)).toContain(suggestedStage(s));
      expect(["fee_paid", "fee_pending", "submitted"]).not.toContain(suggestedStage(s));
    }
  });
});

describe("normalisation", () => {
  it("normalises unknown statuses and payment states", () => {
    expect(normStatus("nonsense")).toBe("submitted");
    expect(normStatus(null)).toBe("submitted");
    expect(normStatus("FEE_PAID")).toBe("fee_paid");
    expect(normPayment("PAID")).toBe("paid");
    expect(normPayment("Pending")).toBe("pending");
    expect(normPayment(undefined)).toBe("pending");
  });

  it("labels the payment methods", () => {
    expect(paymentMethodLabel("easypaisa")).toBe("EasyPaisa");
    expect(paymentMethodLabel("cash")).toBe("Cash at School");
    expect(paymentMethodLabel("safepay")).toBe("Online Payment");
    expect(paymentMethodLabel("")).toBe("");
    expect(paymentMethodLabel(null)).toBe("");
  });
});

describe("the tracker steps", () => {
  it("has five steps", () => {
    expect(TRACK_STEPS).toEqual(["Applied", "Fee Paid", "Review", "Merit", "Admitted"]);
  });
});
