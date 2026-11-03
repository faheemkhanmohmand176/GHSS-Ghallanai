import { useState } from "react";
import { Loader2, Smartphone, ShieldCheck, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import AdmissionPaymentAccounts from "@/components/shared/AdmissionPaymentAccounts";
import type { PaymentMethod } from "@/hooks/useFees";
import { createOnlinePayment, useOnlinePaymentEnabled } from "@/lib/safepay";

interface Props {
  token: string;
  applicationId: string;
  fee: number;
  methods: PaymentMethod[];
  /** Make sure the payment reference exists (generates it when missing). */
  ensureReference: () => Promise<boolean>;
  /** Whether the payment reference has been generated already. */
  hasReference: boolean;
  /** Shown above the manual details, e.g. the reference + deadline notice. */
  manualNote?: React.ReactNode;
}

/**
 * "Pay Online" (Safepay → Easypaisa / wallets) as the primary action, with the
 * school's own accounts kept as a clearly-labelled manual fallback.
 */
export default function OnlinePayPanel({ token, applicationId, fee, methods, ensureReference, hasReference, manualNote }: Props) {
  const { data: online, isLoading } = useOnlinePaymentEnabled();
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);

  async function payOnline() {
    setBusy(true);
    try {
      if (!(await ensureReference())) return;
      const r = await createOnlinePayment(token, applicationId);
      if (!r.ok || !r.url) {
        toast.error(r.error || "Could not start the online payment.");
        return;
      }
      window.location.assign(r.url);
    } finally {
      setBusy(false);
    }
  }

  const manualOpen = showManual || (!isLoading && !online);

  return (
    <div className="space-y-3">
      {online && (
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 text-center">
          <Button onClick={payOnline} disabled={busy} className="h-11 w-full max-w-sm font-semibold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            Pay Online (Easypaisa / Wallet) · Rs {fee}
          </Button>
          <p className="mx-auto mt-2.5 flex max-w-sm items-start justify-center gap-1.5 text-[12px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            Secure checkout by Safepay. Choose <strong className="text-foreground">Wallets</strong>, then Easypaisa
            or JazzCash. Your fee is confirmed automatically in a few moments.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card">
        {online && (
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            aria-expanded={manualOpen}
          >
            <span className="text-[13px] font-semibold text-foreground">
              Manual Transfer <span className="font-normal text-muted-foreground">(Slower Verification)</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${manualOpen ? "rotate-180" : ""}`} />
          </button>
        )}
        {manualOpen && (
          <div className={`${online ? "border-t border-border" : ""} space-y-3 p-4`}>
            {!online && <h3 className="text-center font-heading font-bold text-foreground">Pay To</h3>}
            {manualNote}
            <AdmissionPaymentAccounts methods={methods} />
            {!hasReference && (
              <div className="text-center">
                <Button variant="outline" disabled={busy} className="h-10 font-semibold"
                  onClick={async () => { setBusy(true); try { await ensureReference(); } finally { setBusy(false); } }}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Generate Fee Challan
                </Button>
              </div>
            )}
            <p className="text-center text-[11.5px] text-muted-foreground">
              Manual payments are verified by the school office and can take longer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
