import { Reveal } from "./reveal";

/** Section heading with gold kicker eyebrow (§5.4 Table 7). */
export function SectionHeading({
  kicker,
  title,
  lead,
  align = "left",
  id,
}: {
  kicker: string;
  title: React.ReactNode;
  lead?: string;
  align?: "left" | "center";
  id?: string;
}) {
  return (
    <Reveal className={`mb-8 sm:mb-10 ${align === "center" ? "text-center" : ""}`}>
      <p className="kicker">{kicker}</p>
      <h2 className={`mt-2 text-h2 ${align === "center" ? "mx-auto max-w-2xl" : ""}`}>{title}</h2>
      {lead && (
        <p
          className={`mt-3 text-lead text-muted-foreground ${align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl"}`}
          id={id}
        >
          {lead}
        </p>
      )}
    </Reveal>
  );
}
