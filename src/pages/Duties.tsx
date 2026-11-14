import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, IdCard, Smartphone, Loader2, Download, CheckCircle2, Info, AlertTriangle, Landmark,
} from "lucide-react";
import toast from "react-hot-toast";
import { downloadDutyOrderPDF } from "@/lib/dutyOrderPDF";
import PageLayout from "@/components/layout/PageLayout";
import PageBanner from "@/components/shared/PageBanner";
import {
  useDrawSources, useDrawLookup, useDrawPreview,
  type DrawDetails, type DrawResult,
} from "@/hooks/useDrawLookup";

type By = "cnic" | "mobile";

/** Live-format as the teacher types: CNIC 12345-1234567-1 · mobile 0300 1234567 */
const formatCnic = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 13);
  return [d.slice(0, 5), d.slice(5, 12), d.slice(12)].filter(Boolean).join("-");
};
const formatMobile = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("92") && d.length > 10) d = "0" + d.slice(2);
  d = d.slice(0, 11);
  return d.length > 4 ? `${d.slice(0, 4)} ${d.slice(4)}` : d;
};

const FIELDS: { key: keyof DrawDetails; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "designation", label: "Designation" },
  { key: "institute", label: "Institute" },
  { key: "centerNo", label: "Center No" },
  { key: "mobile", label: "Mobile" },
  { key: "appointedAs", label: "Appointed As" },
];

const slimBtn =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

const Duties = () => {
  const { data: sources } = useDrawSources();
  const [sourceId, setSourceId] = useState("theory");
  const [by, setBy] = useState<By>("cnic");
  const [value, setValue] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const lookup = useDrawLookup();
  const preview = useDrawPreview(sourceId);

  const source = useMemo(() => sources.find((s) => s.id === sourceId) ?? sources[0], [sources, sourceId]);
  const digits = value.replace(/\D/g, "");
  const ready = by === "cnic" ? digits.length === 13 : digits.length >= 10;
  const result: DrawResult | undefined = lookup.data;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || lookup.isPending) return;
    lookup.mutate({ source: sourceId, by, value });
  };
  const switchBy = (b: By) => { setBy(b); setValue(""); lookup.reset(); };
  const switchSource = (id: string) => { setSourceId(id); lookup.reset(); };

  const downloadOrder = async () => {
    if (!result?.details || pdfBusy) return;
    setPdfBusy(true);
    try {
      await downloadDutyOrderPDF({ details: result.details, session: source.session, dutyLabel: source.label });
    } catch {
      toast.error("Could not create the PDF. Please try again.");
    } finally { setPdfBusy(false); }
  };

  return (
    <PageLayout>
      <PageBanner
        variant="premium"
        compact
        hideCrumbs
        title="Exam Duties"
        subtitle="Check your supervisory draw result, live from the Board"
      />

      <section className="px-4 pb-16 pt-8 sm:pt-10">
        <div className="mx-auto w-full min-w-0 max-w-2xl">
          {/* ── Lookup card ─────────────────────────────────────────── */}
          <div className="rounded-3xl border border-border bg-card p-4 shadow-[0_18px_50px_-28px_hsl(var(--primary)/.35)] sm:p-6">
            <div role="tablist" aria-label="Duty type" className="mb-6 flex rounded-full bg-secondary p-1">
              {sources.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={s.id === sourceId}
                  onClick={() => switchSource(s.id)}
                  className={`min-w-0 flex-1 rounded-full px-2 py-2 text-[13px] font-semibold leading-tight transition-all ${
                    s.id === sourceId ? "bg-card text-primary shadow-sm ring-1 ring-gold/40" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Centered stylish heading */}
            <div className="mb-6 text-center">
              <h2 className="break-words font-luxe text-[1.7rem] font-bold leading-tight text-foreground sm:text-3xl">
                {source.session}
              </h2>
              <div className="mx-auto my-2 flex items-center justify-center gap-2" aria-hidden="true">
                <span className="h-px w-8 bg-gradient-to-r from-transparent to-gold" />
                <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
                <span className="h-px w-8 bg-gradient-to-l from-transparent to-gold" />
              </div>
              <p className="font-luxe text-base font-semibold italic tracking-wide text-primary sm:text-lg">
                Online Computerized Supervisory Draw
              </p>
            </div>

            <form onSubmit={submit} noValidate>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {([["cnic", "CNIC", IdCard], ["mobile", "Mobile No", Smartphone]] as const).map(([k, label, Icon]) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => switchBy(k)}
                    aria-pressed={by === k}
                    className={`${slimBtn} border ${
                      by === k
                        ? "border-gold/60 bg-gold-soft text-gold-ink dark:bg-gold/15 dark:text-gold"
                        : "border-border bg-transparent text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>

              <label htmlFor="draw-value" className="sr-only">{by === "cnic" ? "CNIC number" : "Mobile number"}</label>
              <div className="relative">
                {by === "cnic" ? (
                  <IdCard className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70" />
                ) : (
                  <Smartphone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70" />
                )}
                <input
                  id="draw-value"
                  inputMode="numeric"
                  autoComplete="off"
                  value={value}
                  onChange={(e) => setValue(by === "cnic" ? formatCnic(e.target.value) : formatMobile(e.target.value))}
                  placeholder={by === "cnic" ? "17301-1234567-1" : "0301 2345678"}
                  className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-4 font-body text-base font-semibold tracking-wider text-foreground outline-none transition-shadow placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/60 focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
              </div>
              <p className="mx-auto mt-2.5 max-w-xs text-center text-[12.5px] leading-relaxed text-muted-foreground">
                {by === "cnic"
                  ? "Enter your 13-digit CNIC. Dashes are added for you."
                  : "Enter the mobile number registered with BISE Peshawar."}
              </p>

              <button
                type="submit"
                disabled={!ready || lookup.isPending}
                className={`${slimBtn} mt-4 w-full bg-gradient-to-b from-[hsl(45_95%_68%)] to-[hsl(38_88%_50%)] text-[hsl(158_45%_10%)] shadow-[0_10px_22px_-12px_hsl(38_85%_42%/.7)]`}
              >
                {lookup.isPending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Checking…</>) : (<><Search className="h-4 w-4" /> Check My Duty</>)}
              </button>
            </form>
          </div>

          {/* ── Result ──────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {result && !lookup.isPending && (
              <motion.div
                key={`${result.ok}-${result.selected}-${result.fetched_at}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-6"
                aria-live="polite"
              >
                {!result.ok ? (
                  <Notice tone="warn" icon={AlertTriangle} title="Couldn't reach the Board">
                    {result.error || "Something went wrong. Please try again."}
                  </Notice>
                ) : result.selected ? (
                  <div className="overflow-hidden rounded-3xl border border-gold/40 bg-card shadow-[0_18px_50px_-28px_hsl(var(--gold)/.55)]">
                    <div className="bg-gradient-to-r from-[hsl(45_90%_90%)] to-[hsl(150_35%_92%)] px-4 py-4 text-center dark:from-gold/15 dark:to-primary/15">
                      <CheckCircle2 className="mx-auto mb-1 h-6 w-6 text-primary" />
                      <p className="font-luxe text-xl font-bold text-foreground">You are selected for duty</p>
                      <p className="text-[12px] font-medium text-muted-foreground">{source.session} · {source.label}</p>
                    </div>

                    {/* Duty table */}
                    <div className="px-3 pt-3 sm:px-5">
                      <table className="w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-2xl border border-border text-left">
                        <tbody>
                          {FIELDS.map(({ key, label }, i) =>
                            result.details?.[key] ? (
                              <tr key={key} className={i % 2 ? "bg-card" : "bg-secondary/40"}>
                                <th scope="row" className="w-[36%] border-b border-r border-border bg-secondary/70 px-3 py-3 align-top text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
                                  {label}
                                </th>
                                <td className={`break-words border-b border-border px-3 py-3 align-top text-[14.5px] font-semibold leading-snug text-foreground ${key === "appointedAs" ? "text-gold-ink dark:text-gold" : ""}`}>
                                  {result.details[key]}
                                </td>
                              </tr>
                            ) : null,
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-center px-4 pb-5 pt-4">
                      <button type="button" onClick={downloadOrder} disabled={pdfBusy} className={`${slimBtn} bg-primary px-6 text-primary-foreground shadow-md`}>
                        {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {pdfBusy ? "Preparing…" : "Download Duty Order"}
                      </button>
                    </div>

                    {result.notes && result.notes.length > 0 && (
                      <ul className="space-y-2 border-t border-border bg-secondary/50 px-4 py-3">
                        {result.notes.map((n, i) => (
                          <li key={i} className="flex gap-2 break-words text-[13px] leading-relaxed text-muted-foreground">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-strong" /> <span className="min-w-0">{n}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Notice tone="info" icon={Info} title="Not selected in this draw">
                    The Computerized Draw did not select this {by === "cnic" ? "CNIC" : "number"} for {source.label.toLowerCase()}.
                    Try the other duty type, or the other detail.
                  </Notice>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Recently drawn (mobiles masked server-side) ─────────── */}
          {preview.data?.ok && preview.data.entries && preview.data.entries.length > 0 && (
            <div className="mt-10">
              <h2 className="mb-3 flex items-center justify-center gap-2 font-luxe text-2xl font-bold text-foreground">
                <Landmark className="h-4 w-4 text-gold-strong" /> Recently drawn staff
              </h2>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr className="bg-secondary/70 text-[10.5px] font-bold uppercase tracking-[0.1em] text-primary">
                      <th className="px-3 py-2.5">Staff</th>
                      <th className="w-[22%] px-2 py-2.5 text-center">Center</th>
                      <th className="w-[30%] px-2 py-2.5">Duty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data.entries.map((e, i) => (
                      <tr key={i} className="border-t border-border align-top">
                        <td className="break-words px-3 py-2.5">
                          <p className="text-[14px] font-semibold leading-snug text-foreground">{e.name}</p>
                          <p className="text-[11.5px] leading-snug text-muted-foreground">{[e.designation, e.institute].filter(Boolean).join(" · ")}</p>
                        </td>
                        <td className="px-2 py-2.5 text-center text-[13px] font-semibold text-primary">{e.centerNo || "-"}</td>
                        <td className="break-words px-2 py-2.5 text-[12px] font-semibold text-gold-ink dark:text-gold">{e.appointedAs || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </PageLayout>
  );
};

const Notice = ({ tone, icon: Icon, title, children }: { tone: "info" | "warn"; icon: typeof Info; title: string; children: React.ReactNode }) => (
  <div className={`rounded-3xl border p-5 text-center ${tone === "warn" ? "border-amber-400/50 bg-amber-50 dark:bg-amber-500/10" : "border-border bg-card"}`}>
    <Icon className={`mx-auto mb-1.5 h-6 w-6 ${tone === "warn" ? "text-amber-600" : "text-primary"}`} />
    <p className="mb-1 break-words font-luxe text-xl font-bold text-foreground">{title}</p>
    <div className="break-words text-[14px] leading-relaxed text-muted-foreground">{children}</div>
  </div>
);

export default Duties;
