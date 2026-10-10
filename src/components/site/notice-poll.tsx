"use client";

import { useEffect, useState } from "react";
import { BarChart3, Check } from "lucide-react";
import { supabaseBrowser } from "@/lib/auth";

/**
 * NoticePoll — WhatsApp-style single-choice poll embedded in a notice
 * (Babi Khel feature). Votes go through the cast_poll_vote RPC (SECURITY
 * DEFINER, validated server-side); one vote per anonymous device token.
 */
interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export function NoticePoll({
  noticeId,
  question,
  options,
  closesAt,
}: {
  noticeId: string;
  question: string;
  options: PollOption[];
  closesAt?: string | null;
}) {
  const [opts, setOpts] = useState<PollOption[]>(options ?? []);
  const [voted, setVoted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closed = Boolean(closesAt && new Date(closesAt) < new Date());
  const total = opts.reduce((a, o) => a + (o.votes ?? 0), 0);

  useEffect(() => {
    try {
      setVoted(localStorage.getItem(`ghss-poll-${noticeId}`));
    } catch {
      /* ignore */
    }
  }, [noticeId]);

  async function vote(optionId: string) {
    if (voted || closed || busy) return;
    setBusy(true);
    setError(null);
    let token: string;
    try {
      token = localStorage.getItem("ghss_voter_token") ?? "";
      if (!token) {
        token = crypto.randomUUID();
        localStorage.setItem("ghss_voter_token", token);
      }
    } catch {
      token = crypto.randomUUID();
    }

    const sb = supabaseBrowser();
    if (sb) {
      const { data, error: err } = await sb.rpc("cast_poll_vote", {
        p_notice_id: noticeId,
        p_option_id: optionId,
        p_voter_token: token,
      });
      const res = (data ?? {}) as { ok?: boolean; error?: string; options?: PollOption[] };
      if (err || !res.ok) {
        setError(
          res?.error === "already_voted"
            ? "You have already voted on this poll."
            : err?.message ?? res.error ?? "Vote failed — please retry."
        );
        if (res?.options) setOpts(res.options);
        setBusy(false);
        return;
      }
      if (res.options) setOpts(res.options);
    } else {
      // Demo mode: local-only vote
      setOpts((prev) => prev.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)));
    }
    try {
      localStorage.setItem(`ghss-poll-${noticeId}`, optionId);
    } catch {
      /* ignore */
    }
    setVoted(optionId);
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4">
      <p className="flex items-center gap-2 text-small font-bold">
        <BarChart3 className="h-4 w-4 text-primary" aria-hidden />
        Poll: {question}
        {closed && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
            Closed
          </span>
        )}
      </p>

      <div className="mt-3 space-y-2">
        {opts.map((o) => {
          const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
          const mine = voted === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={Boolean(voted) || closed || busy}
              onClick={() => vote(o.id)}
              className={`relative block w-full overflow-hidden rounded-lg border px-3.5 py-2.5 text-left text-small font-semibold transition-colors disabled:cursor-default ${
                mine ? "border-primary/60" : "border-border hover:border-primary/40"
              } ${!voted && !closed ? "button-press" : ""}`}
              aria-pressed={mine}
            >
              {voted || closed ? (
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 ${mine ? "bg-primary/20" : "bg-secondary"} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              ) : null}
              <span className="relative flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2">
                  {mine && <Check className="h-4 w-4 text-primary" aria-hidden />}
                  {o.text}
                </span>
                {(voted || closed) && (
                  <span className="shrink-0 text-xs font-bold text-muted-foreground">
                    {pct}% · {o.votes}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {(voted || closed) && (
        <p className="mt-2.5 text-xs text-muted-foreground">
          {total} vote{total === 1 ? "" : "s"} recorded{closesAt && !closed ? " · poll closes " + new Date(closesAt).toLocaleDateString("en-PK") : ""}
        </p>
      )}
      {!voted && !closed && (
        <p className="mt-2.5 text-xs text-muted-foreground">Select one option — one vote per device.</p>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}
