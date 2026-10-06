import type { Metadata } from "next";
import Link from "next/link";
import { UR } from "@/content/urdu";
import { ADMISSION_DATES } from "@/content/news";
import { formatDate, WHATSAPP_LINK } from "@/content/site";

export const metadata: Metadata = {
  title: "داخلہ — رہنمائی",
  description: "داخلے کی مکمل رہنمائی اردو میں — اہلیت، دستاویزات، آن لائن درخواست اور اہم تاریخیں۔",
  alternates: { languages: { en: "/admissions" } },
};

export default function UrduAdmissions() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="kicker">داخلہ ۲۰۲۶-۲۷</p>
      <h1 className="urdu-display mt-2">{UR.admissions.title}</h1>
      <p className="urdu-body mt-4 text-muted-foreground">{UR.admissions.lead}</p>

      {/* Steps */}
      <ol className="mt-8 space-y-3">
        {UR.admissions.steps.map(([t, d], i) => (
          <li key={i} className="flex gap-4 rounded-xl border border-border bg-card p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
              {i + 1}
            </span>
            <div>
              <p className="urdu-body !text-base font-bold">{t}</p>
              <p className="urdu-body mt-1 !text-sm text-muted-foreground">{d}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Dates */}
      <h2 className="urdu-display mt-10 !text-xl">اہم تاریخیں</h2>
      <ul className="mt-4 divide-y divide-border/60 rounded-xl border border-border bg-card">
        {ADMISSION_DATES.slice(0, 5).map((d) => (
          <li key={d.stage} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <span className="urdu-body !text-sm font-semibold">
              {d.stage === "Applications open"
                ? "درخواستیں کھلیں"
                : d.stage === "Application deadline"
                  ? "آخری تاریخ"
                  : d.stage === "Merit list published"
                    ? "میرٹ لسٹ"
                    : d.stage === "Interviews"
                      ? "انٹرویو"
                      : "داخلہ ٹیسٹ"}
            </span>
            <span className="text-small font-bold text-primary">{formatDate(d.date)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/admissions/apply"
          className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-base font-bold text-primary-foreground"
        >
          آن لائن درخواست (انگریزی فارم)
        </Link>
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center justify-center rounded-full border border-border px-8 text-base font-semibold hover:border-gold hover:text-gold"
        >
          واٹس ایپ پر مدد لیں
        </a>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        اہلیت کی مکمل جدول اور عمومی سوالات انگریزی صفحات پر موجود ہیں:{" "}
        <Link href="/admissions/eligibility" className="font-semibold text-primary underline underline-offset-4">
          Eligibility
        </Link>
        {" · "}
        <Link href="/admissions/faq" className="font-semibold text-primary underline underline-offset-4">
          FAQ
        </Link>
      </p>
    </section>
  );
}
