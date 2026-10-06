import type { Metadata } from "next";
import Link from "next/link";
import { UR } from "@/content/urdu";
import { WHATSAPP_LINK } from "@/content/site";

export const metadata: Metadata = {
  title: "فیس کی تفصیل",
  description: "سرکاری سکول کی فیس — داخلہ فیس، لیبارٹری فنڈ اور بورڈ فیس کی مکمل تفصیل اردو میں۔",
  alternates: { languages: { en: "/admissions/fees" } },
};

export default function UrduFees() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="kicker">والدین کے لیے</p>
      <h1 className="urdu-display mt-2">{UR.fees.title}</h1>
      <p className="urdu-body mt-4 text-muted-foreground">{UR.fees.lead}</p>

      <table className="mt-8 w-full overflow-hidden rounded-xl border border-border bg-card text-right">
        <thead>
          <tr className="border-b border-border bg-secondary/60">
            <th className="urdu-body px-5 py-3.5 !text-sm font-bold">سرخی</th>
            <th className="urdu-body px-5 py-3.5 !text-sm font-bold">رقم</th>
          </tr>
        </thead>
        <tbody>
          {UR.fees.rows.map(([h, a]) => (
            <tr key={h} className="border-b border-border/50 last:border-0">
              <td className="urdu-body px-5 py-3.5 !text-sm font-medium">{h}</td>
              <td className="urdu-body px-5 py-3.5 !text-sm font-bold text-primary">{a}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="urdu-display mt-10 !text-xl">رعایتیں</h2>
      <ul className="mt-4 space-y-3">
        {UR.fees.concessions.map(([t, d]) => (
          <li key={t} className="rounded-xl border border-gold/40 bg-gold-soft/30 p-5 dark:bg-gold-soft/20">
            <p className="urdu-body !text-base font-bold">{t}</p>
            <p className="urdu-body mt-1 !text-sm text-muted-foreground">{d}</p>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/admissions/apply"
          className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-base font-bold text-primary-foreground"
        >
          آن لائن درخواست دیں
        </Link>
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center justify-center rounded-full border border-border px-8 text-base font-semibold hover:border-gold hover:text-gold"
        >
          فیس کے بارے میں پوچھیں
        </a>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        فیس کا مکمل انگریزی جدول:{" "}
        <Link href="/admissions/fees" className="font-semibold text-primary underline underline-offset-4">
          Fee Structure
        </Link>
      </p>
    </section>
  );
}
