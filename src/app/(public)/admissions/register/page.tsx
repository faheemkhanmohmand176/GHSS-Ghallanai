import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { RegistrationForm } from "@/components/site/registration-form";

export const metadata: Metadata = {
  title: "Create Applicant Account",
  description: "Create an applicant account with nationality, CNIC/Form-B, password and a simple verification challenge before starting your GHSS Ghallanai admission application.",
};

export default function RegisterPage() {
  return (
    <>
      <PageHeader
        kicker="Admissions · Account"
        title={<>Create your applicant <span className="text-gold">account</span></>}
        lead="Create one secure account before you begin. Your account keeps your application, receipt and status alerts together so you can return without losing progress."
        breadcrumbs={[{ name: "Admissions", href: "/admissions" }, { name: "Register", href: "/admissions/register" }]}
      />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <RegistrationForm />
      </section>
    </>
  );
}
