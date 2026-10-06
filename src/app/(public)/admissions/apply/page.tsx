import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { ApplyWizard } from "@/components/site/apply-wizard";

export const metadata: Metadata = {
  title: "Apply Online — HED-Style 4-Step Admission Portal",
  description:
    "Apply online for admission to GHSS Ghallanai (1st Year & 2nd Year). Four guided steps: Create Account → Board Verification → Personal Information → Academic & Programme. Each step saves automatically. Issues a tracking token on submission.",
};

export default function ApplyPage() {
  return (
    <>
      <PageHeader
        kicker="Admissions · Apply"
        title={<>The four-step <span className="text-gold">admission portal</span></>}
        lead="Modeled on the HED KPK online admission system. Create your account, verify your matric board details, complete your personal information, then choose your programme, quota and subjects — fifteen minutes end-to-end. Each step saves as you go, so an interrupted connection loses nothing."
        breadcrumbs={[
          { name: "Admissions", href: "/admissions" },
          { name: "Apply Online", href: "/admissions/apply" },
        ]}
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <ApplyWizard />
      </section>
    </>
  );
}
