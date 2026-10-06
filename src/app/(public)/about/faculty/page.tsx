import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { getFaculty } from "@/lib/data";

export const metadata: Metadata = {
  title: "Faculty Directory",
  description:
    "Meet the teaching staff of Government Higher Secondary School Ghallanai — subject specialists across ICS, Pre-Medical, Pre-Engineering and Arts.",
};

export default async function FacultyPage() {
  const faculty = await getFaculty();
  const departments = [...new Set(faculty.map((f) => f.department))];

  return (
    <>
      <PageHeader
        kicker="Our people"
        title={<>The teachers behind the <span className="text-gold">results</span></>}
        lead="Subject specialists with the qualifications and the years to teach the intermediate syllabus at the depth the board — and the university — expects. Filter by department; print the wall-poster version with the print button."
        breadcrumbs={[
          { name: "About", href: "/about" },
          { name: "Faculty Directory", href: "/about/faculty" },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading
          kicker="Directory"
          title={`${faculty.length} teaching staff · ${departments.length} departments`}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {faculty.map((f, i) => (
            <Reveal key={f.id} delay={(i % 6) * 60}>
              <article className="card-lift print-card flex h-full gap-4 rounded-xl border border-border bg-card p-5">
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary"
                >
                  <GraduationCap className="h-6 w-6 text-primary" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-bold leading-snug">{f.name}</h3>
                  <p className="mt-0.5 text-small font-medium text-primary">{f.designation}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">{f.qualification}</p>
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {f.subjects.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-secondary px-2.5 py-0.5 text-[0.7rem] font-semibold text-primary"
                      >
                        {s}
                      </span>
                    ))}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {f.department} · {f.years} years of service
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted-foreground no-print">
          SAMPLE directory — replace with the official staff list through the admin dashboard or the
          Supabase seed file. Print view produces the wall-poster layout (Master Plan §6.2).
        </p>
      </section>
    </>
  );
}
