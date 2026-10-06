import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { ApplyForm } from "@/components/site/apply-form";

export const metadata: Metadata = {
  title: "Apply Online — Six-Step Application (1st & 2nd Year)",
  description:
    "Apply online for admission to GHSS Ghallanai in six guided steps. Choose 1st-year (Part-I) or 2nd-year (Part-II transfer) admission. The form mirrors the HED KPK OCAS portal structure. Progress saves automatically — one bus ride of connectivity is enough. Issues an application tracking number on submission.",
};

export default function ApplyPage() {
  return (
    <>
      <PageHeader
        kicker="Admissions · Apply"
        title={<>The six-step <span className="text-gold">application</span></>}
        lead="Fifteen minutes, on the phone in your hand. Choose 1st year (Part-I after matric) or 2nd year (Part-II transfer) and the form adjusts itself. Each step saves as you complete it, so an interrupted connection loses nothing. Need help? WhatsApp the school mid-form and someone will walk you through it."
        breadcrumbs={[
          { name: "Admissions", href: "/admissions" },
          { name: "Apply Online", href: "/admissions/apply" },
        ]}
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <ApplyForm />
      </section>
    </>
  );
}
