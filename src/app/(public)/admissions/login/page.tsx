import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { ApplicantLoginForm } from "@/components/site/applicant-login-form";

export const metadata: Metadata = { title: "Applicant Login", description: "Sign in to your GHSS Ghallanai applicant account." };

export default function ApplicantLoginPage() {
  return <><PageHeader kicker="Admissions · Account" title={<>Applicant <span className="text-gold">login</span></>} lead="Sign in with the CNIC/Form-B and password used when you created your applicant account." breadcrumbs={[{ name: "Admissions", href: "/admissions" }, { name: "Applicant Login", href: "/admissions/login" }]} /><section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16"><ApplicantLoginForm /></section></>;
}
