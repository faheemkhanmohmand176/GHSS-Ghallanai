import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck, Search, IdCard, Smartphone, Loader2, ExternalLink, Printer,
  CheckCircle2, Info, AlertTriangle, MapPin, Hash, UserRound, BadgeCheck, Briefcase,
  Phone, Building2, Landmark, ShieldCheck,
} from "lucide-react";
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

const FIELDS: { key: keyof DrawDetails; label: string; icon: typeof Hash }[] = [
  { key: "centerNo", label: "Center No", icon: Hash },
  { key: "name", label: "Name", icon: UserRound },
  { key: "designation", label: "Designation", icon: Briefcase },
  { key: "institute", label: "Institute", icon: Building2 },
  { key: "mobile", label: "Mobile", icon: Phone },
  { key: "appointedAs", label: "Appointed As", icon: BadgeCheck },
];

const BISE_LINKS = [
  { label: "Supervisory Staff Portal", href: "https://supervisory.bisep.edu.pk/login/" },
  { label: "Retotalling / Rechecking", href: "https://portal.bisep.edu.pk/retotalling/" },
  { label: "Fee Challan", href: "https://www.bisep.edu.pk/challan/" },
  { label: "Notifications & Date Sheets", href: "https://www.bisep.edu.pk/page-10006.html" },
];

const slimBtn =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

const Duties = () => {
  const { data: sources } = useDrawSources();
  const [sourceId, setSourceId] = useState("theory");
  const [by, setBy] = useState<By>("cnic");
  const [value, setValue] = useState("");
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

  return (
    <PageLayout>
      <PageBanner
        variant="premium"
        compact
        hideCrumbs
        eyebrow="BISE Peshawar"
        icon={<ClipboardCheck className="h-6 w-6" />}
        title="Exam Duties"
        subtitle="Check your supervisory draw result, live from the Board"
      />

      <section className="px-4 pb-16 pt-8 sm:pt-10">
        <div className="mx-auto w-full max-w-2xl min-w-0">
          {/* ── Lookup card ─────────────────────────────────────────── */}
          <div className="rounded-3xl border border-border bg-card p-4 shadow-[0_18px_50px_-28px_hsl(var(--primary)/.35)] sm:p-6">
            {/* Session tabs */}
            <div role="tablist" aria-label="Duty type" className="mb-5 flex rounded-full bg-secondary p-1">
              {sources.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={s.id === sourceId}
                  onClick={() => switchSource(s.id)}
                  className={`min-w-0 flex-1 rounded-full px-2 py-2 text-[13px] font-semibold leading-tight transition-all ${
                    s.id === sourceId
                      ? "bg-card text-primary shadow-sm ring-1 ring-gold/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <p className="mb-4 break-words font-heading text-lg font-bold leading-snug text-foreground sm:text-xl">
              {source.session}
              <span className="block text-xs font-body font-medium text-muted-foreground">
                Online Computerized Supervisory Draw
              </span>
            </p>

            <form onSubmit={submit} noValidate>
              {/* CNIC / Mobile toggle */}
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

              <label htmlFor="draw-value" className="sr-only">
                {by === "cnic" ? "CNIC number" : "Mobile number"}
              </label>
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
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                {by === "cnic" ? "Enter your 13-digit CNIC. Dashes are added for you." : "Enter the mobile number registered with BISE Peshawar."}
              </p>

              <button
                type="submit"
                disabled={!ready || lookup.isPending}
                className={`${slimBtn} mt-4 w-full bg-gradient-to-b from-[hsl(45_95%_68%)] to-[hsl(38_88%_50%)] text-[hsl(158_45%_10%)] shadow-[0_10px_22px_-12px_hsl(38_85%_42%/.7)]`}
              >
                {lookup.isPending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Checking with BISE…</>) : (<><Search className="h-4 w-4" /> Check My Duty</>)}
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
                    {result.error || "Something went wrong."}
                    {result.official_page && (
                      <a href={result.official_page} target="_blank" rel="noopener noreferrer" className={`${slimBtn} mt-3 border border-border text-primary hover:bg-secondary`}>
                        Open official BISE page <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </Notice>
                ) : result.selected ? (
                  <div className="overflow-hidden rounded-3xl border border-gold/40 bg-card shadow-[0_18px_50px_-28px_hsl(var(--gold)/.55)]">
                    <div className="flex items-center gap-2 bg-gradient-to-r from-[hsl(45_90%_90%)] to-[hsl(150_35%_92%)] px-4 py-3 dark:from-gold/15 dark:to-primary/15">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                      <p className="break-words font-heading text-base font-bold text-foreground">You are selected for duty</p>
                    </div>
                    <dl className="divide-y divide-border px-4">
                      {FIELDS.map(({ key, label, icon: Icon }) =>
                        result.details?.[key] ? (
                          <div key={key} className="flex items-start gap-3 py-3">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
                              <dd className="break-words font-body text-[15px] font-semibold leading-snug text-foreground">{result.details[key]}</dd>
                            </div>
                          </div>
                        ) : null,
                      )}
                    </dl>
                    <div className="flex flex-wrap gap-2 px-4 pb-4 pt-2">
                      {result.letter && (
                        <a href={result.letter} target="_blank" rel="noopener noreferrer" className={`${slimBtn} bg-primary text-primary-foreground`}>
                          <Printer className="h-3.5 w-3.5" /> Duty Order
                        </a>
                      )}
                      <a href={result.official_page} target="_blank" rel="noopener noreferrer" className={`${slimBtn} border border-border text-primary hover:bg-secondary`}>
                        Official page <ExternalLink className="h-3.5 w-3.5" />
                      </a>
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
                    Try the other duty type or the other detail, or verify on the Board's page.
                    <a href={result.official_page} target="_blank" rel="noopener noreferrer" className={`${slimBtn} mt-3 border border-border text-primary hover:bg-secondary`}>
                      Official BISE page <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Notice>
                )}
                {result.fetched_at && (
                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    Fetched live from BISE Peshawar · {new Date(result.fetched_at).toLocaleString()}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Recently drawn preview (mobiles masked server-side) ── */}
          {preview.data?.ok && preview.data.entries && preview.data.entries.length > 0 && (
            <div className="mt-10">
              <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-foreground">
                <Landmark className="h-4 w-4 text-gold-strong" /> Recently drawn staff
              </h2>
              <ul className="space-y-2">
                {preview.data.entries.map((e, i) => (
                  <li key={i} className="rounded-2xl border border-border bg-card px-4 py-3">
                    <p className="break-words text-[15px] font-semibold text-foreground">{e.name}</p>
                    <p className="break-words text-[12px] text-muted-foreground">
                      {[e.designation, e.institute].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                      {e.centerNo && <span className="inline-flex items-center gap-1 text-primary"><MapPin className="h-3 w-3" /> Center {e.centerNo}</span>}
                      {e.appointedAs && <span className="rounded-full bg-gold-soft px-2 py-0.5 font-semibold text-gold-ink dark:bg-gold/15 dark:text-gold">{e.appointedAs}</span>}
                      {e.mobile && <span className="text-muted-foreground">{e.mobile}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── BISE corner ─────────────────────────────────────────── */}
          <div className="mt-10 rounded-3xl border border-border bg-secondary/40 p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" /> BISE Corner
            </h2>
            <div className="flex flex-wrap gap-2">
              {BISE_LINKS.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={`${slimBtn} border border-border bg-card text-primary hover:bg-secondary`}>
                  {l.label} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
              Results come directly from the Board of Intermediate and Secondary Education Peshawar. This page is an
              independent convenience by GHSS Ghallanai; the Board's own page is always the final authority.
            </p>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

const Notice = ({ tone, icon: Icon, title, children }: { tone: "info" | "warn"; icon: typeof Info; title: string; children: React.ReactNode }) => (
  <div className={`rounded-3xl border p-4 sm:p-5 ${tone === "warn" ? "border-amber-400/50 bg-amber-50 dark:bg-amber-500/10" : "border-border bg-card"}`}>
    <p className="mb-1 flex items-center gap-2 font-heading text-base font-bold text-foreground">
      <Icon className={`h-4 w-4 shrink-0 ${tone === "warn" ? "text-amber-600" : "text-primary"}`} /> <span className="min-w-0 break-words">{title}</span>
    </p>
    <div className="break-words text-[14px] leading-relaxed text-muted-foreground">{children}</div>
  </div>
);

export default Duties;
