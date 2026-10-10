import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { JsonLdBreadcrumb } from "./json-ld";

/**
 * PageHeader — nested-page hero with breadcrumbs (§4.3)
 * and gold-underline H1 per the type scale (§5.4).
 */
export function PageHeader({
  kicker,
  title,
  lead,
  breadcrumbs = [{ name: "", href: "#" }],
  children,
}: {
  kicker: string;
  title: React.ReactNode;
  lead?: string;
  breadcrumbs?: { name: string; href: string }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/70 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbs.slice(0, -1).map((b) => (
              <Fragment key={b.href}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href={b.href}>{b.name}</BreadcrumbLink>
                </BreadcrumbItem>
              </Fragment>
            ))}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{breadcrumbs[breadcrumbs.length - 1]?.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <JsonLdBreadcrumb items={breadcrumbs} />
        <p className="kicker mt-6">{kicker}</p>
        <h1 className="mt-2 text-h1">{title}</h1>
        {lead && <p className="mt-4 max-w-2xl text-lead text-muted-foreground">{lead}</p>}
        {children}
      </div>
    </div>
  );
}
