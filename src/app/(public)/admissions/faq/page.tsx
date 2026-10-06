import type { Metadata } from "next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageHeader } from "@/components/site/page-header";
import { FAQS } from "@/content/news";
import { JsonLdFaq } from "@/components/site/json-ld";

export const metadata: Metadata = {
  title: "Admissions FAQ — Twenty Questions",
  description:
    "Answers to the twenty questions families ask most about admission, fees, results, documents and daily life at GHSS Ghallanai.",
};

export default function FaqPage() {
  const faqs = FAQS.map((f) => ({ q: f.q, a: f.a }));
  return (
    <>
      <JsonLdFaq faqs={faqs} />
      <PageHeader
        kicker="Admissions · FAQ"
        title={<>Twenty questions, <span className="text-gold">answered</span></>}
        lead="Collected from the office staff who answer these daily. If your question is not here, WhatsApp the school or use the contact form — both reach the same office."
        breadcrumbs={[
          { name: "Admissions", href: "/admissions" },
          { name: "FAQ", href: "/admissions/faq" },
        ]}
      />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`q-${i}`}>
              <AccordionTrigger className="text-left text-base font-semibold hover:text-primary hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-small leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </>
  );
}
