import { useState } from "react";
import { Loader2, Smartphone, ShieldCheck, ChevronDown, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import AdmissionPaymentAccounts from "@/components/shared/AdmissionPaymentAccounts";
import type { PaymentMethod } from "@/hooks/useFees";
import { createOnlinePayment, useOnlinePaymentEnabled } from "@/lib/safepay";
import { SCHOOL_WHATSAPP_DISPLAY, whatsappLink } from "@/lib/schoolContact";

interface Props {
  token: string;
  applicationId: string;
  /** Tracking ID, quoted in the WhatsApp verification message. */
  trackingId?: string;
  fee: number;
  methods: PaymentMethod[];
  /** Make sure the payment reference exists (generates it when missing). */
  ensureReference: () => Promise<boolean>;
  /** Whether the payment reference has been generated already. */
  hasReference: boolean;
}

/**
 * "Pay Online" (Safepay → Easypaisa / wallets) as the primary action, with the
 * school's own accounts + WhatsApp proof upload as a clearly-labelled manual fallback.
 */
export default function OnlinePayPanel({ token, applicationId, trackingId, fee, methods, ensureReference, hasReference }: Props) {
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
  const waText =
    `Assalam o Alaikum, I have paid the admission processing fee (Rs ${fee})` +
    (trackingId ? ` for Tracking ID ${trackingId}` : "") +
    `. Payment screenshot / receipt is attached. Please verify my payment.`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-5 text-[12.5px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading payment options…
      </div>
    );
  }

  return (
    <div id="pay-fee" className="space-y-3 scroll-mt-24">
      {online && (
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
          <Button onClick={payOnline} disabled={busy} className="h-12 w-full gap-2 text-[15px] font-semibold">
            {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Smartphone className="h-4 w-4 shrink-0" />}
            <span>Pay Rs {fee} Online</span>
          </Button>
          <p className="mt-2 text-center text-[12.5px] font-medium text-foreground/80">
            Easypaisa · JazzCash · Wallet
          </p>
          <div className="mt-2.5 flex items-start justify-center gap-1.5 text-[12px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span className="text-left">
              Secure checkout by Safepay — choose <strong className="text-foreground">Wallets</strong>. Your fee is
              confirmed automatically.
            </span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card">
        {online && (
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={manualOpen}
          >
            <span className="min-w-0 text-[13.5px] font-semibold leading-snug text-foreground">
              Manual Transfer
              <span className="block text-[11.5px] font-normal text-muted-foreground">Slower verification</span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${manualOpen ? "rotate-180" : ""}`} />
          </button>
        )}
        {manualOpen && (
          <div className={`${online ? "border-t border-border" : ""} space-y-4 p-4`}>
            <ol className="space-y-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              <li><strong className="text-foreground">1.</strong> Send <strong className="text-foreground">Rs {fee}</strong> to the account below.</li>
              <li><strong className="text-foreground">2.</strong> Send the payment screenshot on WhatsApp with your Tracking ID.</li>
              <li><strong className="text-foreground">3.</strong> The school office verifies and marks your fee as paid.</li>
            </ol>

            <AdmissionPaymentAccounts methods={methods} />

            <a
              href={whatsappLink(waText)}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto flex h-9 w-full max-w-xs items-center justify-center gap-1.5 rounded-lg border border-[#25D366]/50 bg-[#25D366]/[0.07] px-3 text-[12.5px] font-medium text-[#128C4A] transition-colors hover:bg-[#25D366]/15 dark:text-[#4ADE80]"
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Send screenshot on WhatsApp</span>
              <span className="shrink-0 text-[11px] font-normal opacity-70">· {SCHOOL_WHATSAPP_DISPLAY}</span>
            </a>
            {!hasReference && (
              <Button variant="outline" disabled={busy} className="h-11 w-full font-semibold"
                onClick={async () => { setBusy(true); try { await ensureReference(); } finally { setBusy(false); } }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Generate Fee Challan
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
