import { Landmark, Smartphone, Banknote, Wallet } from "lucide-react";
import type { PaymentMethod } from "@/hooks/useFees";
import { describePaymentMethod } from "@/hooks/useAdmission";

const ICON: Record<string, typeof Landmark> = {
  bank: Landmark, easypaisa: Smartphone, jazzcash: Smartphone, cash: Banknote, other: Wallet,
};

/** The school's own payment accounts, exactly as set by the admin. */
export default function AdmissionPaymentAccounts({ methods }: { methods: PaymentMethod[] }) {
  const list = (methods || []).filter((m) => describePaymentMethod(m).lines.length > 0 || m.type === "bank");
  if (list.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-muted/30 px-3 py-3 text-center text-[13px] text-muted-foreground">
        Payment account details will be provided by the school office.
      </p>
    );
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {list.map((m, i) => {
        const d = describePaymentMethod(m);
        const Icon = ICON[m.type] ?? Wallet;
        return (
          <div key={i} className="flex flex-col items-center rounded-xl border border-gold/30 bg-gold/[0.04] px-3 py-3 text-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 bg-card">
              <Icon className="h-4 w-4 text-gold" strokeWidth={1.5} />
            </span>
            <p className="mt-1.5 text-[13.5px] font-bold text-foreground">{d.title}</p>
            {d.lines.map((l) => (
              <p key={l} className="mt-0.5 max-w-full break-all text-[12.5px] text-muted-foreground">{l}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
