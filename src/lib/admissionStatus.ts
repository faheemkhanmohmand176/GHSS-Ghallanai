/**
 * admissionStatus — the ONE place that knows how an application's
 * processing-fee state and its workflow stage relate to each other.
 *
 * ── The model ────────────────────────────────────────────────────────────────
 * Two INDEPENDENT facts, stored in two independent columns:
 *
 *   payment_status  (pending | paid | rejected)   ← money. Owned by the
 *                                                    admin "Fee" action only.
 *   status          (inter_app_status enum)       ← the college's workflow.
 *                                                    Owned by the admin
 *                                                    "Status" action only.
 *
 * `status` also carries three SYSTEM-managed values that are NOT workflow
 * stages and must never be offered as a choice to the admin:
 *
 *   submitted / fee_pending   → received, fee not paid yet
 *   fee_paid                  → fee received, waiting for the college to review
 *
 * Offering "Fee Pending" / "Fee Paid" as *status* choices duplicated the Fee
 * action and produced two sources of truth for the same fact (the stage said
 * "Fee Paid" while the Fee column said "Pending"). The workflow stages the
 * college can pick are now exactly the five in WORKFLOW_STAGES; the payment
 * milestones are derived from `payment_status` by resolveStage() below.
 *
 * The database enforces the same rule (migration 27): inter_admin_set_status
 * rejects the payment states, and inter_admin_set_payment owns them.
 *
 * ── Why this is a shared module ─────────────────────────────────────────────
 * The admin console and the public Track Application page must tell the same
 * story from the same two facts. Both import from here so a change in one
 * place cannot drift from the other.
 */

/** The processing-fee state (the `payment_status` column). */
export type PaymentState = "pending" | "paid" | "rejected";

/**
 * The application status (the `status` column, type `inter_app_status`).
 * `submitted`, `fee_pending` and `fee_paid` are system-managed — they are
 * never offered as an admin choice.
 */
export type AppStatus =
  | "submitted"
  | "fee_pending"
  | "fee_paid"
  | "under_review"
  | "merit_listed"
  | "admitted"
  | "rejected"
  | "cancelled";

/** A workflow stage the college can move an application to. */
export interface WorkflowStage {
  value: Extract<AppStatus, "under_review" | "merit_listed" | "admitted" | "rejected" | "cancelled">;
  label: string;
  /** Shown under the tile in the admin dialog. */
  hint: string;
  /** Tailwind classes for the tile / badge. */
  tone: string;
  /** Requires the processing fee to be paid before it can be reached. */
  requiresFee: boolean;
  /** Reaching this stage ends the workflow (no stepper afterwards). */
  terminal: boolean;
}

/**
 * The workflow stages — the ONLY statuses the admin may choose.
 * Deliberately excludes submitted / fee_pending / fee_paid: those describe
 * the payment, not the college's workflow, and the Fee action owns them.
 */
export const WORKFLOW_STAGES: WorkflowStage[] = [
  {
    value: "under_review",
    label: "Under Review",
    hint: "Documents are being verified by the college office.",
    tone: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    requiresFee: true,
    terminal: false,
  },
  {
    value: "merit_listed",
    label: "Merit Listed",
    hint: "Included in the published merit list for this program and quota.",
    tone: "bg-primary/10 text-primary",
    requiresFee: true,
    terminal: false,
  },
  {
    value: "admitted",
    label: "Admitted",
    hint: "Admission confirmed — the applicant is asked to bring original documents.",
    tone: "bg-green-600 text-white",
    requiresFee: true,
    terminal: false,
  },
  {
    value: "rejected",
    label: "Rejected",
    hint: "The application was not accepted.",
    tone: "bg-red-500/10 text-red-600",
    requiresFee: false,
    terminal: true,
  },
  {
    value: "cancelled",
    label: "Cancelled",
    hint: "The application was withdrawn or cancelled by the college.",
    tone: "bg-red-500/10 text-red-600",
    requiresFee: false,
    terminal: true,
  },
];

/** The public tracker's progress steps. */
export const TRACK_STEPS = ["Applied", "Fee Paid", "Review", "Merit", "Admitted"];

/** The stages in the order the college normally walks through them. */
export const STAGE_ORDER: AppStatus[] = [
  "submitted",
  "fee_pending",
  "fee_paid",
  "under_review",
  "merit_listed",
  "admitted",
];

/**
 * Payment methods the college accepts (stored in `inter_applications.payment_method`).
 * `safepay` is what the online payment flow writes; the rest are recorded by
 * the admin in the Fee dialog.
 */
export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "bank", label: "Bank" },
  { value: "easypaisa", label: "EasyPaisa" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "cash", label: "Cash at School" },
  { value: "safepay", label: "Online Payment" },
  { value: "other", label: "Other" },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank: "Bank",
  easypaisa: "EasyPaisa",
  jazzcash: "JazzCash",
  cash: "Cash at School",
  safepay: "Online Payment",
  other: "Other",
};

/** Human label for a payment method value (falls back to the raw value). */
export function paymentMethodLabel(method?: string | null): string {
  const key = String(method ?? "").trim().toLowerCase();
  if (!key) return "";
  return PAYMENT_METHOD_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

const ALL_STATUSES: AppStatus[] = [
  "submitted", "fee_pending", "fee_paid", "under_review",
  "merit_listed", "admitted", "rejected", "cancelled",
];

/** Normalise anything the database might hand us into a known status. */
export function normStatus(status?: string | null): AppStatus {
  const key = String(status ?? "").trim().toLowerCase() as AppStatus;
  return ALL_STATUSES.includes(key) ? key : "submitted";
}

/** Normalise anything the database might hand us into a known payment state. */
export function normPayment(paymentStatus?: string | null): PaymentState {
  const key = String(paymentStatus ?? "").trim().toLowerCase();
  if (key === "paid" || key === "rejected") return key;
  return "pending";
}

/**
 * Short badge label for the workflow stage of an application.
 *
 * The three system-managed values are collapsed so the admin table never
 * shows "Fee Paid" twice (once as the Fee badge, once as the Status badge):
 * the Fee column already carries the payment state.
 */
export function stageLabel(status?: string | null): string {
  switch (normStatus(status)) {
    case "submitted":
    case "fee_pending":
      return "Applied";
    case "fee_paid":
      return "Awaiting Review";
    case "under_review":
      // Set automatically by the Auto Merit List for fee-paid applicants
      // who did not get a seat.
      return "Not Merit Listed";
    case "merit_listed":
      return "Merit Listed";
    case "admitted":
      return "Admitted";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return "Applied";
  }
}

/** Tailwind classes for the workflow-stage badge. */
export function stageTone(status?: string | null): string {
  switch (normStatus(status)) {
    case "submitted":
    case "fee_pending":
    case "fee_paid":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "under_review":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "merit_listed":
      return "bg-primary/10 text-primary";
    case "admitted":
      return "bg-green-600 text-white";
    case "rejected":
    case "cancelled":
      return "bg-red-500/10 text-red-600";
    default:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  }
}

/** True for the stages that close the workflow. */
export function isClosedStatus(status?: string | null): boolean {
  const s = normStatus(status);
  return s === "rejected" || s === "cancelled";
}

/**
 * The stage an application is in, resolved from BOTH facts.
 */
export interface ResolvedStage {
  /** The workflow status as stored. */
  status: AppStatus;
  /** Badge label — always true for the data behind it. */
  label: string;
  /** Tailwind classes for the badge. */
  tone: string;
  /** One sentence describing the state — never claims a payment that did not happen. */
  note: string;
  /** 1-based index into TRACK_STEPS of the step the applicant is on (0 when closed). */
  step: number;
  /** True when every step of the tracker is complete. */
  complete: boolean;
  /** True when the application was rejected or cancelled. */
  closed: boolean;
  /** True when the processing fee is actually paid. */
  paid: boolean;
  /** True when the fee is outstanding. */
  feeDue: boolean;
  /** Non-null when the stored status and the fee state disagree. */
  warning: string | null;
  /** What the college does next — shown to the applicant as "What happens next". */
  next: string;
}

/**
 * Resolve what the applicant should be shown from the two stored facts.
 *
 * The fee milestone is read from `payment_status` — never from `status` —
 * so the tracker can never claim "Payment confirmed" for an unpaid fee.
 */
export function resolveStage(status?: string | null, paymentStatus?: string | null): ResolvedStage {
  const st = normStatus(status);
  const pay = normPayment(paymentStatus);
  const paid = pay === "paid";
  const closed = isClosedStatus(st);

  // How far along the college's workflow are we?
  const reached: number =
    st === "admitted" ? 5 :
    st === "merit_listed" ? 4 :
    st === "under_review" ? 3 : 1;

  // A workflow stage past "Applied" is only meaningful once the fee is paid.
  const stageReached = reached > 1 && !paid ? 1 : reached;
  const feeReached = paid ? 2 : 1;
  const step = closed ? 0 : Math.max(feeReached, stageReached);
  const complete = !closed && step >= TRACK_STEPS.length;

  // The stored status and the fee state can disagree on rows created before
  // the workflow and the payment were separated (migration 27).
  const warning =
    !closed && reached > 1 && !paid
      ? "The processing fee for this application is still pending. Please complete the payment at the school office."
      : null;

  let label = "Applied";
  let tone = stageTone(st);
  let note = "Your application is received. Pay the processing fee to continue.";
  let next = "";

  if (closed) {
    label = st === "rejected" ? "Rejected" : "Cancelled";
    tone = "bg-red-500/10 text-red-600";
    note = st === "rejected"
      ? "Your application was not accepted. Please contact the school office for details."
      : "This application was cancelled. Please contact the school office if you did not request this.";
    next = "Contact the school office at the college with your Tracking ID for details.";
  } else if (st === "admitted") {
    label = "Admitted";
    tone = "bg-green-600 text-white";
    note = "Congratulations — you have been admitted. Bring your original documents to the school office.";
    next = "Bring your original documents and the fee challan to the school office to complete the admission formalities.";
  } else if (st === "merit_listed") {
    label = "Merit Listed";
    tone = "bg-primary/10 text-primary";
    note = "You are on the published merit list for your program and quota.";
    next = "Check the published merit list below, then collect your admission slip from the school office.";
  } else if (st === "under_review") {
    label = "Not Merit Listed";
    tone = "bg-red-500/10 text-red-600 dark:text-red-400";
    note = "Your fee is received, but you are not on the merit list because all seats of your program were filled by higher merit.";
    next = "Check the published merit list below to see your position. If a later list is published, the status here updates automatically.";
  } else if (paid) {
    label = "Fee Paid";
    tone = "bg-green-500/15 text-green-700 dark:text-green-400";
    note = "Payment confirmed. Your application is in the queue for review.";
    next = "The college office verifies your documents next. The status here changes to “Under Review” once that check starts.";
  } else {
    label = "Fee Pending";
    tone = "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    note = "Your application is received. Pay the processing fee to continue.";
    next = "Pay the processing fee using the payment reference on your challan. The application moves to review as soon as the fee is received.";
  }

  if (warning) note = `${note} ${warning}`;

  return { status: st, label, tone, note, step, complete, closed, paid, feeDue: !paid && !closed, warning, next };
}

/**
 * The stage the admin dialog should preselect for an application: the stage
 * the application is already in, or the natural next one.
 */
export function suggestedStage(status?: string | null): WorkflowStage["value"] {
  const st = normStatus(status);
  switch (st) {
    case "submitted":
    case "fee_pending":
    case "fee_paid":
      return "under_review";
    case "under_review":
      return "merit_listed";
    case "merit_listed":
      return "admitted";
    default:
      return "under_review";
  }
}

/** The workflow stage an application currently sits in (null for system states). */
export function currentStage(status?: string | null): WorkflowStage | null {
  return WORKFLOW_STAGES.find((s) => s.value === normStatus(status)) ?? null;
}
