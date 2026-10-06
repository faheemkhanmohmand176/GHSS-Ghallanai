import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { TrackingLookup } from "@/components/site/tracking-lookup";

export const metadata: Metadata = {
  title: "Track Application",
  description: "Look up the latest GHSS Ghallanai admission application status using the application tracking ID printed on the receipt.",
};

export default function TrackPage() {
  return (
    <>
      <PageHeader
        kicker="Admissions · Track"
        title={<>Follow your application <span className="text-gold">status</span></>}
        lead="Enter the application tracking ID from your receipt. The status timeline shows what the office has completed and what happens next."
        breadcrumbs={[{ name: "Admissions", href: "/admissions" }, { name: "Track Application", href: "/admissions/track" }]}
      />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <TrackingLookup />
      </section>
    </>
  );
}
