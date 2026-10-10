"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, X, Send, Copy, Pencil } from "lucide-react";

/**
 * AIAssistant — floating school assistant (Babi Khel feature).
 * Streams from POST /api/ai-chat (SSE, letter-by-letter typing). Mini
 * markdown rendering (bold, code, lists, links; internal paths become
 * Next.js links). Degrades gracefully when the API key is absent.
 */

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Which programmes does GHSS Ghallanai offer?",
  "How do I apply for admission?",
  "How can I check my result?",
  "Where is the school located?",
];

function renderInline(text: string): React.ReactNode[] {
  // **bold**, `code`, [label](path), bare internal paths
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\/(?:academics|admissions|results|notices|contact|about|gallery|library|calendar)[^\s]*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      parts.push(
        <code key={k++} className="rounded bg-secondary px-1 py-0.5 text-[0.85em] font-mono">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("[")) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!;
      parts.push(
        <Link key={k++} href={mm[2]} className="font-semibold text-primary underline underline-offset-2">
          {mm[1]}
        </Link>
      );
    } else {
      parts.push(
        <Link key={k++} href={tok} className="font-semibold text-primary underline underline-offset-2">
          {tok}
        </Link>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderMarkdown(src: string): React.ReactNode[] {
  const lines = src.split("\n");
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  let k = 0;
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={k++} className="my-1.5 ml-4 list-disc space-y-1">
          {list.map((li, i) => (
            <li key={i}>{li}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  for (const line of lines) {
    const t = line.trim();
    if (/^[-•]\s+/.test(t)) {
      list.push(<>{renderInline(t.replace(/^[-•]\s+/, ""))}</>);
      continue;
    }
    if (/^\d+[.)]\s+/.test(t)) {
      list.push(<>{renderInline(t.replace(/^\d+[.)]\s+/, ""))}</>);
      continue;
    }
    flush();
    if (t) out.push(<p key={k++} className="my-1">{renderInline(t)}</p>);
  }
  flush();
  return out;
}

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function send(text: string, history: Msg[]) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setNotice(null);
    const next: Msg[] = [...history, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;
    let assistant = "";
    setMessages([...next, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Assistant unavailable." }));
        throw new Error(err.error ?? `Assistant unavailable (${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotAny = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const json = JSON.parse(line.slice(5).trim());
            if (json.token) {
              gotAny = true;
              assistant += json.token;
              setMessages([...next, { role: "assistant", content: assistant }]);
            } else if (json.error) {
              setNotice(json.error as string);
            } else if (json.done) {
              if (!gotAny && !json.error) setNotice("The assistant returned an empty reply.");
            }
          } catch {
            /* skip malformed frame */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setNotice((err as Error).message || "The assistant could not be reached.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function editLastUser() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const idx = messages.findIndex((m) => m === lastUser);
    setMessages(messages.slice(0, idx));
    setInput(lastUser.content);
    inputRef.current?.focus();
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close the AI assistant" : "Open the AI school assistant"}
        aria-expanded={open}
        className="button-press fixed bottom-20 right-4 z-40 inline-flex h-11 items-center gap-2 rounded-full bg-primary-strong text-gold shadow-xl ring-2 ring-gold/40 transition-all hover:scale-105 lg:bottom-6 lg:right-6 lg:h-12 lg:px-5 dark:bg-[#0a1810]"
      >
        <Sparkles className="h-5 w-5" aria-hidden />
        <span className="hidden text-small font-bold lg:inline">Ask AI</span>
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="GHSS Ghallanai AI assistant"
          className="fixed bottom-36 right-4 z-40 flex max-h-[70svh] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl lg:bottom-24 lg:right-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 bg-primary-strong px-4 py-3 text-white dark:bg-[#0a1810]">
            <div className="min-w-0">
              <p className="truncate text-small font-bold">
                GHSS Ghallanai <span className="text-gold">AI Assistant</span>
              </p>
              <p className="flex items-center gap-1.5 text-[0.68rem] text-[#E8F5EC]/75">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                Online · Official school assistant
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                abortRef.current?.abort();
                setOpen(false);
              }}
              aria-label="Close assistant"
              className="button-press inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
            >
              <X className="h-4.5 w-4.5" aria-hidden />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto bg-secondary/30 p-4">
            {messages.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-small font-bold">Assalam-o-Alaikum! 👋</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Ask me about programmes, admissions, results or the school. I answer briefly and point
                  you to the right page.
                </p>
                <div className="mt-3 grid gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s, messages)}
                      className="button-press rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-semibold hover:border-primary/40 hover:bg-secondary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border border-border bg-card"
                  }`}
                >
                  {m.role === "assistant" && m.content === "" && streaming ? (
                    <span className="inline-flex items-center gap-1 py-0.5" aria-label="Assistant is typing">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" />
                    </span>
                  ) : m.role === "assistant" ? (
                    renderMarkdown(m.content)
                  ) : (
                    m.content
                  )}

                  {m.role === "user" && i === messages.length - 2 && !streaming && (
                    <span className="mt-1.5 flex items-center gap-2 border-t border-white/20 pt-1.5">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(m.content)}
                        aria-label="Copy message"
                        title="Copy"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/15"
                      >
                        <Copy className="h-3 w-3" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={editLastUser}
                        aria-label="Edit and resend"
                        title="Edit"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/15"
                      >
                        <Pencil className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            ))}

            {notice && (
              <p className="mb-3 rounded-lg border border-gold/40 bg-gold-soft/30 px-3 py-2 text-xs font-semibold text-gold-strong dark:bg-gold-soft/15 dark:text-gold">
                {notice}
              </p>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input, messages);
            }}
            className="flex items-end gap-2 border-t border-border bg-background p-3"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input, messages);
                }
              }}
              rows={1}
              placeholder="Ask about admissions, results…"
              aria-label="Message the assistant"
              className="scroll-thin max-h-24 min-h-11 flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-small outline-none focus:border-primary/50"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              aria-label="Send message"
              className="button-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-4.5 w-4.5" aria-hidden />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
