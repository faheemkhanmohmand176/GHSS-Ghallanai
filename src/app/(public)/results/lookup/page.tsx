import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";
import { ResultLookup } from "@/components/site/result-lookup";

export const metadata: Metadata = {
  title: "Result Lookup — Check by Roll Number",
  description:
    "Check GHSS Ghallanai intermediate results by roll number — full subject-wise card with grades, printable and shareable, published the day results release.",
};

export default function LookupPage() {
  return (
    <>
      <PageHeader
        kicker="Results · Transparency flagship"
        title={<>Check your <span className="text-gold">result</span></>}
        lead="One form: roll number, year and programme. The subject-wise card appears instantly — printable for the family record, shareable for the family group. No screenshots of uncertain origin."
        breadcrumbs={[
          { name: "Results", href: "/results" },
          { name: "Result Lookup", href: "/results/lookup" },
        ]}
      />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <ResultLookup />
        <p className="mx-auto mt-10 max-w-2xl text-center text-small">
          Also available:{" "}
          <Link href="/results/merit-list" className="font-semibold text-primary underline underline-offset-4">
            published merit lists
          </Link>{" "}
          ·{" "}
          <Link href="/results/toppers" className="font-semibold text-primary underline underline-offset-4">
            the toppers wall
          </Link>
        </p>
      </section>
    </>
  );
}
