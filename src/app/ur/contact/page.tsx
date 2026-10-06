import type { Metadata } from "next";
import { UR } from "@/content/urdu";
import { WHATSAPP_LINK, MAP_LINK } from "@/content/site";

export const metadata: Metadata = {
  title: "رابطہ",
  description: "غلانئی کے سرکاری سکول سے رابطہ — واٹس ایپ، فون اور دفتری اوقات۔",
  alternates: { languages: { en: "/contact" } },
};

export default function UrduContact() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="kicker">رابطہ</p>
      <h1 className="urdu-display mt-2">{UR.contact.title}</h1>
      <p className="urdu-body mt-4 text-muted-foreground">{UR.contact.lead}</p>

      <ul className="mt-8 space-y-3">
        <li className="rounded-xl border border-border bg-card p-5">
          <p className="urdu-body !text-base font-bold">پتہ</p>
          <p className="urdu-body mt-1 !text-sm text-muted-foreground">{UR.contact.address}</p>
        </li>
        <li className="rounded-xl border border-border bg-card p-5">
          <p className="urdu-body !text-base font-bold">دفتری اوقات</p>
          <p className="urdu-body mt-1 !text-sm text-muted-foreground">
            پیر تا ہفتہ · صبح ۸ بجے تا دوپہر ۲ بجے
          </p>
        </li>
        <li className="rounded-xl border border-border bg-[#075E54] p-5 text-white">
          <p className="urdu-body !text-base font-bold">{UR.contact.whatsapp}</p>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex h-11 items-center rounded-full bg-[#25D366] px-6 text-small font-bold text-white"
          >
            واٹس ایپ پیغام بھیجیں
          </a>
        </li>
      </ul>

      <a
        href={MAP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex h-12 items-center rounded-full border border-border px-6 text-small font-semibold hover:border-gold hover:text-gold"
      >
        گوگل میپس میں کھولیں
      </a>

      <p className="mt-8 text-xs text-muted-foreground">
        رائے اور شکایات کا فارم:{" "}
        <a href="/contact" className="font-semibold text-primary underline underline-offset-4">
          Contact (English)
        </a>
      </p>
    </section>
  );
}
