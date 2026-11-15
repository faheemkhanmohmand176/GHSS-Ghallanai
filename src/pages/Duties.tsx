import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, IdCard, Smartphone, Loader2, Download, CheckCircle2, Info, AlertTriangle,
  Landmark, X, ArrowRight, FileText, ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import PageLayout from "@/components/layout/PageLayout";
import { downloadDutyOrderPDF } from "@/lib/dutyOrderPDF";
import { groupRows, letterFacts, lineText, type LetterLine } from "@/lib/letterModel";
import {
  useDrawSources, useDrawLookup, useDrawPreview, formatPkMobile,
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
              <p className="mx-auto mt-3 max-w-[17rem] text-center text-[12.5px] leading-relaxed text-muted-foreground">
                {by === "cnic" ? "Enter your 13-digit CNIC. Dashes are added for you." : "Enter the mobile number registered with BISE Peshawar."}
              </p>

              <button
                type="submit"
                disabled={!ready || lookup.isPending}
                className="group relative mt-4 flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-b from-[hsl(46_96%_72%)] to-[hsl(38_88%_50%)] text-[13.5px] font-bold tracking-wide text-[hsl(158_45%_10%)] shadow-[0_14px_26px_-14px_hsl(38_85%_42%/.8),inset_0_1px_0_hsl(0_0%_100%/.55)] transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
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

                    {/* Centered duty table */}
                    <div className="px-4 sm:px-6">
                      <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-2xl border border-border text-center">
                        <tbody>
                          {ROWS.map(({ key, label }) => {
                            const raw = result.details?.[key];
                            if (!raw) return null;
                            const v = key === "mobile" ? formatPkMobile(raw) : raw;
                            return (
                              <tr key={key} className="[&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-border">
                                <td className="px-4 py-3.5 even:bg-secondary/40">
                                  <span className="block text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary">{label}</span>
                                  <span className="mt-1 block break-words text-[15.5px] font-semibold leading-snug tracking-wide text-foreground">{v}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-center px-4 pb-6 pt-5">
                      <button type="button" onClick={downloadOrder} disabled={pdfBusy} className={`${slimBtn} border border-primary/20 bg-primary text-primary-foreground shadow-[0_12px_24px_-14px_hsl(var(--primary)/.8)]`}>
                        {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {pdfBusy ? "Preparing…" : "Download Duty Order"}
                      </button>
                    </div>

                    {result.letterDoc && result.letterDoc.length > 0 && <LetterPanel lines={result.letterDoc} />}
                  </div>
                ) : (
                  <Notice tone="info" icon={Info} title="Not selected in this draw">
                    The Computerized Draw did not select this {by === "cnic" ? "CNIC" : "number"} for {source.label.toLowerCase()}. Try the other duty type, or the other detail.
                  </Notice>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Recently drawn (mobiles masked server-side) ─────────── */}
          {preview.data?.ok && preview.data.entries && preview.data.entries.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-1 flex items-center justify-center gap-2 text-center font-luxe text-[1.7rem] font-bold text-foreground">
                <Landmark className="h-4 w-4 text-gold-strong" /> Recently drawn staff
              </h2>
              <div className="mx-auto mb-4 flex items-center justify-center gap-2" aria-hidden="true">
                <span className="h-px w-8 bg-gradient-to-r from-transparent to-gold" /><span className="h-1.5 w-1.5 rotate-45 bg-gold" /><span className="h-px w-8 bg-gradient-to-l from-transparent to-gold" />
              </div>
              <div className="overflow-hidden rounded-3xl border border-border bg-card">
                <table className="w-full table-fixed border-collapse text-center">
                  <thead>
                    <tr className="bg-secondary/70 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                      <th className="px-3 py-3">Staff</th>
                      <th className="w-[19%] px-1 py-3">Center</th>
                      <th className="w-[31%] px-1 py-3">Duty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data.entries.map((e, i) => (
                      <tr key={i} className="border-t border-border align-middle">
                        <td className="break-words px-3 py-3">
                          <p className="text-[14px] font-semibold leading-snug text-foreground">{e.name}</p>
                          <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{[e.designation, e.institute].filter(Boolean).join(" · ")}</p>
                        </td>
                        <td className="px-1 py-3 text-[14px] font-bold text-primary">{e.centerNo || "-"}</td>
                        <td className="break-words px-1 py-3 text-[12px] font-bold text-[hsl(38_85%_32%)] dark:text-gold">{e.appointedAs || "-"}</td>
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

/** The board's own letter, verbatim — only the styling is ours. */
function LetterView({ lines }: { lines: LetterLine[] }) {
  const rows = useMemo(() => groupRows(lines), [lines]);
  return (
    <div className="space-y-1.5 text-[12.5px] leading-relaxed text-foreground">
      {rows.map((row, ri) => {
        const dashes = row.cols.length === 1 && /^[-–—_=\s]{12,}$/.test(lineText(row.cols[0].lines[0] || ({} as LetterLine)));
        if (dashes) return <hr key={row.id} className="border-t border-dashed border-border" />;
        const stack = row.cols.length >= 3;
        return (
          <div key={row.id} className={`flex gap-x-3 ${stack ? "flex-col gap-y-0.5 sm:flex-row" : ""} ${ri === 0 ? "pb-1" : ""}`}>
            {row.cols.map((c, ci) => (
              <div key={ci} className="min-w-0 break-words" style={{ flex: row.narrowFirst && ci === 0 ? "0 0 1.6rem" : `${c.weight} 1 0%` }}>
                {c.lines.map((l, li) =>
                  l.img ? (
                    <img key={li} src={l.img} alt="" className={`my-1 h-9 w-auto max-w-full ${l.center ? "mx-auto" : ""}`} />
                  ) : (
                    <p key={li} className={`${l.center ? "text-center" : ""} ${ri === 0 ? "font-luxe text-[1.1rem] leading-snug text-primary" : ""}`}>
                      {(l.runs || []).map((r, k) => (
                        <span key={k} className={`${r.b ? "font-semibold" : ""} ${r.u ? "underline underline-offset-2" : ""}`}>{r.t}</span>
                      ))}
                    </p>
                  ),
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function LetterPanel({ lines }: { lines: LetterLine[] }) {
  const f = useMemo(() => letterFacts(lines), [lines]);
  const facts: [string, string | undefined][] = [
    ["Center Name", f.centerName],
    ["Report On", f.reportDate && (f.reportTime ? `${f.reportDate} at ${f.reportTime}` : f.reportDate)],
    ["Ref No", f.ref],
    ["Dated", f.dated],
    ["CNIC", f.cnic],
  ];
  const shown = facts.filter(([, v]) => v) as [string, string][];
  return (
    <div className="border-t border-border">
      {shown.length > 0 && (
        <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border text-center">
          {shown.map(([k, v], i) => (
            <div key={k} className={`px-3 py-3 ${shown.length % 2 && i === shown.length - 1 ? "col-span-2" : ""}`}>
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{k}</span>
              <span className="mt-0.5 block break-words text-[14px] font-semibold text-foreground">{v}</span>
            </div>
          ))}
        </div>
      )}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-center gap-2 px-4 py-3 text-[13px] font-semibold text-primary [&::-webkit-details-marker]:hidden">
          <FileText className="h-4 w-4" /> Read the full duty letter
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mx-3 mb-4 rounded-2xl border border-border bg-background p-4 sm:mx-5"><LetterView lines={lines} /></div>
      </details>
    </div>
  );
}

const Notice = ({ tone, icon: Icon, title, children }: { tone: "info" | "warn"; icon: typeof Info; title: string; children: React.ReactNode }) => (
  <div className={`rounded-[28px] border p-6 text-center ${tone === "warn" ? "border-amber-400/50 bg-amber-50 dark:bg-amber-500/10" : "border-border bg-card"}`}>
    <Icon className={`mx-auto mb-2 h-7 w-7 ${tone === "warn" ? "text-amber-600" : "text-primary"}`} />
    <p className="mb-1 break-words font-luxe text-2xl font-bold text-foreground">{title}</p>
    <div className="break-words text-[14px] leading-relaxed text-muted-foreground">{children}</div>
  </div>
);

export default Duties;
