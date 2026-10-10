"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Dialog — lightweight modal (no external dependency).
 * Overlay click / Escape close, body scroll lock, focus-safe.
 */
export function Dialog({
  open,
  onClose,
  title,
  desc,
  children,
  wide,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: string;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-primary-strong/45 backdrop-blur-[2px]"
      />
      <div
        ref={ref}
        className={`relative flex max-h-[92svh] w-full flex-col rounded-t-2xl border border-border bg-background shadow-2xl sm:rounded-2xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-small font-bold leading-snug">{title}</h2>
            {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="button-press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirm dialog for destructive actions (two-step-safe). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  desc,
  confirmLabel = "Delete",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  desc: string;
  confirmLabel?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} desc={desc}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="button-press h-10 rounded-full border border-border px-5 text-small font-semibold hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="button-press h-10 rounded-full bg-destructive px-5 text-small font-bold text-destructive-foreground hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-small text-muted-foreground">
        This action is audit-logged. Type-sensitive rows are soft-deleted where a recovery window exists.
      </p>
    </Dialog>
  );
}
