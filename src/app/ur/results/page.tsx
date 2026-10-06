import type { Metadata } from "next";
import Link from "next/link";
import { UR } from "@/content/urdu";

export const metadata: Metadata = {
  title: "نتیجہ دیکھیں",
  description: "رول نمبر سے مضمون وار نتیجہ دیکھیں — غلانئی کے سرکاری سکول کی سالانہ نتائج۔",
  alternates: { languages: { en: "/results/lookup" } },
};

export default function UrduResults() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="kicker">سالانہ نتائج</p>
      <h1 className="urdu-display mt-2">{UR.results.title}</h1>
      <p className="urdu-body mt-4 text-muted-foreground">{UR.results.lead}</p>

      {/* Link to the English lookup — the interactive form lives there (bilingual labels on page) */}
      <div className="card-lift mt-8 rounded-2xl border border-border bg-card p-6 text-center md:p-8">
        <p className="urdu-body !text-lg font-bold">نتیجہ چیک کرنے کا فارم</p>
        <p className="urdu-body mt-2 !text-sm text-muted-foreground">
          فارم پر صرف تین چیزز درکار ہیں — رول نمبر، سال اور شعبہ۔
        </p>
        <Link
          href="/results/lookup"
          className="mt-5 inline-flex h-12 items-center rounded-full bg-primary px-8 text-base font-bold text-primary-foreground"
        >
          {UR.results.check} →
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">
          ڈیمو رول نمبر: GH-12-101 · GH-11-201
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/results/merit-list"
          className="card-lift rounded-xl border border-border bg-card p-5 text-center"
        >
          <p className="urdu-body !text-base font-bold">{UR.results.meritLink}</p>
          <p className="mt-1 text-xs text-muted-foreground">Merit Lists (English)</p>
        </Link>
        <Link
          href="/results/toppers"
          className="card-lift rounded-xl border border-gold/40 bg-card p-5 text-center"
        >
          <p className="urdu-body !text-base font-bold">پوزیشن ہولڈرز دیکھیں</p>
          <p className="mt-1 text-xs text-muted-foreground">Toppers Wall (English)</p>
        </Link>
      </div>
    </section>
  );
}
