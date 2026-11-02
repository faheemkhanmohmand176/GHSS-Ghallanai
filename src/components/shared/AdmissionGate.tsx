import { Link } from "react-router-dom";
import { Lock, CalendarClock } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import AdmissionBackBar from "@/components/shared/AdmissionBackBar";
import {
  useAdmissionSettings, getAdmissionState, formatAdmissionDate,
  type AdmissionState,
} from "@/hooks/useAdmission";

export function AdmissionClosedCard({ state }: { state: AdmissionState }) {
  const notStarted = state.reason === "not_started";
  const ended = state.reason === "ended";
  const Icon = notStarted ? CalendarClock : Lock;
  const title = notStarted ? "Admissions Open Soon" : "Admissions Closed";
  const text = notStarted
    ? `Online admission opens on ${formatAdmissionDate(state.openDate)}.`
    : ended
    ? `The last date was ${formatAdmissionDate(state.lastDate)}. Online admission is now closed.`
    : "Online admission is currently closed. Please check back later.";
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-gold/30 bg-card px-6 py-10 text-center shadow-card">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-gold/[0.08]">
        <Icon className="h-6 w-6 text-gold" strokeWidth={1.4} />
      </span>
      <h1 className="mt-4 font-heading text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-9 items-center rounded-full bg-primary px-6 text-[13px] font-semibold text-primary-foreground"
      >
        Back to Home
      </Link>
    </div>
  );
}

/**
 * Wraps every /admission/* route except the public home. When the admin
 * closes admissions (or the date window has passed) nothing inside opens.
 * If the settings cannot be read at all we let the page load: the server
 * enforces the same rule, so this never bypasses the lock.
 */
export default function AdmissionGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useAdmissionSettings();
  if (isLoading) {
    return (
      <PageLayout>
        <div className="container mx-auto max-w-md space-y-3 px-4 py-16">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </PageLayout>
    );
  }
  const state = getAdmissionState(data);
  if (!isError && !state.open) {
    return (
      <PageLayout>
        <div className="container mx-auto max-w-xl px-4 py-12">
          <AdmissionBackBar to="/admission" />
          <AdmissionClosedCard state={state} />
        </div>
      </PageLayout>
    );
  }
  return <>{children}</>;
}
