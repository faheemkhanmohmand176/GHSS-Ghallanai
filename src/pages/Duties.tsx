import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, IdCard, Smartphone, Loader2, Download, CheckCircle2, Info, AlertTriangle,
  X, ArrowRight, Briefcase, Building2, Hash, MapPin, CalendarCheck, Clock,
  CalendarDays, GraduationCap, FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import PageLayout from "@/components/layout/PageLayout";
import { downloadDutyOrderPDF } from "@/lib/dutyOrderPDF";
import { letterFacts } from "@/lib/letterModel";
import {
  useDrawSources, useDrawLookup, formatPkMobile,
  type DrawDetails, type DrawResult,
} from "@/hooks/useDrawLookup";

type By = "cnic" | "mobile";

/** Live-format while typing: CNIC 12345-1234567-1 · mobile 0300 1234567 */
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

const ROWS: { key: keyof DrawDetails; label: string }[] = [
  { key: "designation", label: "Designation" },
  { key: "institute", label: "Institute" },
  { key: "centerNo", label: "Center No" },
  { key: "mobile", label: "Mobile No" },
];

/** Small badge icon for each duty-detail cell (purely decorative). */
const FIELD_ICON: Record<string, typeof IdCard> = {
  Designation: Briefcase,
  Institute: Building2,
  "Center No": Hash,
  "Mobile No": Smartphone,
  "Center Name": MapPin,
  "Report Date": CalendarCheck,
  "Report Time": Clock,
  "Draw Held On": CalendarDays,
  "Exam Starts": GraduationCap,
  "Ref No": FileText,
  Dated: CalendarCheck,
  CNIC: IdCard,
};

const slimBtn =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-semibold tracking-wide transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

/** Sliding-pill segmented control (shared by duty-type tabs and CNIC/Mobile toggle) */
function Segmented<T extends string>({
  id, value, onChange, options, label,
}: {
  id: string; value: T; onChange: (v: T) => void; label: string;
  options: { value: T; label: string; icon?: typeof IdCard }[];
}) {
  return (
    <div role="tablist" aria-label={label} className="relative grid rounded-full border border-border/80 bg-secondary/60 p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative z-10 flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[12.5px] font-semibold transition-colors ${active ? "text-[hsl(158_45%_14%)]" : "text-muted-foreground hover:text-foreground"}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 -z-10 rounded-full border border-gold/50 bg-gradient-to-b from-white to-[hsl(45_80%_95%)] shadow-[0_4px_10px_-6px_hsl(38_70%_40%/.5)] dark:from-card dark:to-gold/10"
              />
            )}
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const Duties = () => {
  const { data: sources } = useDrawSources();
  const [sourceId, setSourceId] = useState("theory");
  const [by, setBy] = useState<By>("cnic");
  const [value, setValue] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const lookup = useDrawLookup();

  const source = useMemo(() => sources.find((s) => s.id === sourceId) ?? sources[0], [sources, sourceId]);
  const digits = value.replace(/\D/g, "");
  const ready = by === "cnic" ? digits.length === 13 : digits.length >= 10;
  const result: DrawResult | undefined = lookup.data;
  // everything shown is exactly what BISE returned: search result fields + the letter's own sentences
  const tableRows = useMemo(() => {
    if (!result?.selected) return [] as [string, string][];
    const rows: [string, string | undefined][] = ROWS.map(({ key, label }) => {
      const raw = result.details?.[key];
      return [label, key === "mobile" ? formatPkMobile(raw) : raw];
    });
    if (result.letterDoc?.length) {
      const f = letterFacts(result.letterDoc);
      rows.push(["Center Name", f.centerName], ["Report Date", f.reportDate], ["Report Time", f.reportTime],
        ["Draw Held On", f.drawDate], ["Exam Starts", f.commencing],
        ["Ref No", f.ref], ["Dated", f.dated], ["CNIC", f.cnic]);
    }
    return rows.filter(([, v]) => !!v) as [string, string][];
  }, [result]);

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
      await downloadDutyOrderPDF({ letter: result.letterDoc, details: result.details, session: source.session, dutyLabel: source.label });
    } catch {
      toast.error("Could not create the PDF. Please try again.");
    } finally { setPdfBusy(false); }
  };

  return (
    <PageLayout>
      {/* ── Premium light hero ─────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-gold/25 bg-[radial-gradient(60%_80%_at_100%_0%,hsl(42_90%_72%/.35),transparent_65%),radial-gradient(60%_80%_at_0%_100%,hsl(150_40%_80%/.5),transparent_65%),linear-gradient(170deg,#FFFEFA,#F6F4E6_60%,#EAF2E3)] px-4 py-9 text-center dark:bg-[linear-gradient(170deg,hsl(150_10%_11%),hsl(150_12%_8%))] sm:py-12">
        <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full border border-gold/30 shadow-[0_0_0_26px_hsl(40_75%_55%/.05),0_0_0_27px_hsl(40_75%_50%/.16)]" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-20 h-60 w-60 rounded-full border border-primary/20 shadow-[0_0_0_24px_hsl(150_40%_45%/.05),0_0_0_25px_hsl(150_40%_40%/.14)]" />
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative mx-auto max-w-xl">
          <h1 className="font-luxe text-[2.5rem] font-bold leading-[1.05] tracking-tight text-[hsl(158_40%_12%)] dark:text-white sm:text-5xl">
            Exam <span className="bg-gradient-to-br from-[hsl(36_88%_36%)] via-[hsl(42_92%_50%)] to-[hsl(34_85%_38%)] bg-clip-text text-transparent">Duties</span>
          </h1>
          <div className="my-3 flex items-center justify-center gap-2" aria-hidden="true">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold" />
            <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold" />
          </div>
          <p className="mx-auto max-w-sm font-luxe text-[1.05rem] font-medium italic leading-snug text-[hsl(158_14%_28%)] dark:text-white/75 sm:text-lg">
            Check your supervisory draw result, live from the Board
          </p>
        </motion.div>
      </section>

      <section className="px-4 pb-16 pt-8 sm:pt-10">
        <div className="mx-auto w-full min-w-0 max-w-xl">
          {/* ── Lookup card ─────────────────────────────────────────── */}
          <div className="rounded-[28px] border border-border bg-card p-5 shadow-[0_24px_60px_-34px_hsl(var(--primary)/.45)] sm:p-7">
            <Segmented
              id="source" label="Duty type" value={sourceId} onChange={switchSource}
              options={sources.map((s) => ({ value: s.id, label: s.label }))}
            />

            <div className="my-6 text-center">
              <h2 className="break-words font-luxe text-[1.9rem] font-bold leading-tight text-foreground sm:text-4xl">{source.session}</h2>
              <div className="mx-auto my-2.5 flex items-center justify-center gap-2" aria-hidden="true">
                <span className="h-px w-9 bg-gradient-to-r from-transparent to-gold" />
                <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
                <span className="h-px w-9 bg-gradient-to-l from-transparent to-gold" />
              </div>
              <p className="font-luxe text-[1.05rem] font-semibold italic tracking-wide text-primary sm:text-xl">Online Computerized Supervisory Draw</p>
            </div>

            <form onSubmit={submit} noValidate>
              <Segmented<By>
                id="by" label="Search by" value={by} onChange={switchBy}
                options={[{ value: "cnic", label: "CNIC", icon: IdCard }, { value: "mobile", label: "Mobile No", icon: Smartphone }]}
              />

              <label htmlFor="draw-value" className="mb-1.5 mt-4 block text-center text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary">
                {by === "cnic" ? "CNIC Number" : "Mobile Number"}
              </label>
              <div className="group relative">
                <span className="pointer-events-none absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-primary">
                  {by === "cnic" ? <IdCard className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                </span>
                <input
                  id="draw-value"
                  inputMode="numeric"
                  autoComplete="off"
                  value={value}
                  onChange={(e) => setValue(by === "cnic" ? formatCnic(e.target.value) : formatMobile(e.target.value))}
                  placeholder={by === "cnic" ? "17301-1234567-1" : "0301 2345678"}
                  className="h-11 w-full rounded-full border border-border bg-background px-12 text-center font-body text-[1rem] font-semibold tracking-[0.1em] text-foreground shadow-[inset_0_1px_3px_hsl(var(--primary)/.08)] outline-none transition-all placeholder:text-[0.95rem] placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:border-gold focus:shadow-[0_0_0_4px_hsl(var(--gold)/.18)]"
                />
                {value && (
                  <button type="button" aria-label="Clear" onClick={() => setValue("")} className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!ready || lookup.isPending}
                className="group relative mt-5 flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-b from-[hsl(46_96%_72%)] to-[hsl(38_88%_50%)] text-[13.5px] font-bold tracking-wide text-[hsl(158_45%_10%)] shadow-[0_14px_26px_-14px_hsl(38_85%_42%/.8),inset_0_1px_0_hsl(0_0%_100%/.55)] transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {lookup.isPending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Checking…</>) : (<><Search className="h-4 w-4" /> Check My Duty <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>)}
              </button>
            </form>
          </div>

          {/* ── Result ──────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {result && !lookup.isPending && (
              <motion.div
                key={`${result.ok}-${result.selected}-${result.fetched_at}`}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }}
                className="mt-7" aria-live="polite"
              >
                {!result.ok ? (
                  <Notice tone="warn" icon={AlertTriangle} title="Couldn't reach the Board">{result.error || "Something went wrong. Please try again."}</Notice>
                ) : result.selected ? (
                  <div className="overflow-hidden rounded-[28px] border border-gold/40 bg-card shadow-[0_24px_60px_-34px_hsl(var(--gold)/.7)]">
                    {/* Header */}
                    <div className="relative bg-gradient-to-b from-[hsl(45_90%_94%)] to-card px-5 pb-5 pt-6 text-center dark:from-gold/10">
                      <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="h-6 w-6" /></span>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">You are selected for duty</p>
                      <h3 className="mt-2 break-words font-luxe text-[1.9rem] font-bold leading-tight text-foreground">{result.details?.name}</h3>
                      {result.details?.appointedAs && (
                        <span className="mt-3 inline-flex max-w-full items-center rounded-full border border-gold/50 bg-white px-4 py-1.5 text-[13px] font-bold uppercase tracking-[0.14em] text-[hsl(38_85%_30%)] shadow-sm dark:bg-gold/15 dark:text-gold">
                          <span className="truncate">{result.details.appointedAs}</span>
                        </span>
                      )}
                      <p className="mt-3 text-[12px] font-medium text-muted-foreground">{source.session} · {source.label}</p>
                    </div>

                    {/* Duty details — two-column premium grid, centered in each cell */}
                    <div className="px-4 pb-2 pt-5 sm:px-6">
                      <div className="mb-3.5 flex items-center justify-center gap-2.5" aria-hidden="true">
                        <span className="h-px w-10 bg-gradient-to-r from-transparent to-gold/70" />
                        <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
                        <span className="text-[9.5px] font-bold uppercase tracking-[0.26em] text-primary/70">Duty Details</span>
                        <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
                        <span className="h-px w-10 bg-gradient-to-l from-transparent to-gold/70" />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                        {tableRows.map(([label, v]) => {
                          const Icon = FIELD_ICON[label] ?? FileText;
                          return (
                            <div
                              key={label}
                              className="flex min-w-0 flex-col items-center justify-center rounded-2xl border border-border/80 bg-gradient-to-b from-secondary/50 to-secondary/10 px-3 py-4 text-center transition-all hover:border-gold/50 hover:shadow-[0_12px_26px_-18px_hsl(var(--gold)/.8)] dark:from-secondary/40 dark:to-transparent"
                            >
                              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/35 bg-gradient-to-b from-[hsl(46_96%_91%)] to-[hsl(42_85%_82%)] text-[hsl(36_75%_32%)] shadow-[inset_0_1px_0_hsl(0_0%_100%/.65),0_6px_14px_-8px_hsl(38_80%_40%/.55)] dark:border-gold/25 dark:from-gold/20 dark:to-gold/5 dark:text-gold">
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary/85">{label}</span>
                              <span className="mt-1 w-full break-words text-[14.5px] font-bold leading-snug text-foreground">{v}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-center px-4 pb-6 pt-4">
                      <button type="button" onClick={downloadOrder} disabled={pdfBusy} className={`${slimBtn} border border-primary/20 bg-primary text-primary-foreground shadow-[0_12px_24px_-14px_hsl(var(--primary)/.8)]`}>
                        {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {pdfBusy ? "Preparing…" : "Download Duty Order"}
                      </button>
                    </div>

                  </div>
                ) : (
                  <Notice tone="info" icon={Info} title="Not selected in this draw">
                    The Computerized Draw did not select this {by === "cnic" ? "CNIC" : "number"} for {source.label.toLowerCase()}. Try the other duty type, or the other detail.
                  </Notice>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </PageLayout>
  );
};

const Notice = ({ tone, icon: Icon, title, children }: { tone: "info" | "warn"; icon: typeof Info; title: string; children: React.ReactNode }) => (
  <div className={`rounded-[28px] border p-6 text-center ${tone === "warn" ? "border-amber-400/50 bg-amber-50 dark:bg-amber-500/10" : "border-border bg-card"}`}>
    <Icon className={`mx-auto mb-2 h-7 w-7 ${tone === "warn" ? "text-amber-600" : "text-primary"}`} />
    <p className="mb-1 break-words font-luxe text-2xl font-bold text-foreground">{title}</p>
    <div className="break-words text-[14px] leading-relaxed text-muted-foreground">{children}</div>
  </div>
);

export default Duties;
