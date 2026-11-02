import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  /** Fixed destination (preferred over history so users never loop). */
  to?: string;
  /** Custom handler, e.g. to step back inside a multi step form. */
  onClick?: () => void;
  label?: string;
}

/** Thin, small back button shown at the top of every admission step. */
export default function AdmissionBackBar({ to, onClick, label = "Back" }: Props) {
  const navigate = useNavigate();
  return (
    <div className="mb-4 no-print">
      <button
        type="button"
        onClick={() => (onClick ? onClick() : to ? navigate(to) : navigate(-1))}
        className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card/80 pl-2 pr-3 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground active:scale-[0.97]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        {label}
      </button>
    </div>
  );
}
