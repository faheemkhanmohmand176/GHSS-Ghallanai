import { NextResponse } from "next/server";

/**
 * AI ASSISTANT — SSE streaming proxy (Babi Khel pattern).
 *
 * POST /api/ai-chat  { messages: [{role, content}] }
 *   → text/event-stream of `data:{"token":"…"}` frames + `data:{"done":true}`
 *
 * The Z.AI GLM key stays server-side (never shipped to the browser). Without
 * ZAI_API_KEY the route answers honestly instead of pretending, so the
 * floating assistant degrades gracefully on demo deployments.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are the GHSS Ghallanai school assistant — a helpful, concise guide for a government higher secondary school in Ghallanai, Mohmand District, Khyber Pakhtunkhwa, Pakistan.
The school offers 1st Year and 2nd Year programmes: ICS (Computer Science), Pre-Medical (F.Sc), Pre-Engineering (F.Sc) and Arts (FA Humanities), under BISE.
Answer in short, friendly paragraphs or lists (max ~120 words). If asked about specific dates, results or fees, say the visitor should check the school office or the website's results/admissions pages, and never invent numbers.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function sseFrame(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(request: Request) {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "The AI assistant is not configured on this deployment. Set ZAI_API_KEY (and optionally ZAI_MODEL) to enable it.",
      },
      { status: 503 }
    );
  }

  let messages: ChatMessage[];
  try {
    const body = (await request.json()) as { messages?: ChatMessage[] };
    messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  // Validate and clamp each message (defensive — never trust the wire).
  messages = messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0 &&
        m.content.length < 4000
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages." }, { status: 400 });
  }

  const model = process.env.ZAI_MODEL || "glm-4.5-flash";
  const apiUrl =
    process.env.ZAI_API_URL && process.env.ZAI_API_URL.startsWith("https://api.z.ai/")
      ? `${process.env.ZAI_API_URL}/chat/completions`
      : "https://api.z.ai/api/paas/v4/chat/completions";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(sseFrame(obj)));
      try {
        const upstream = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
            stream: true,
            max_tokens: 550,
            temperature: 0.6,
            thinking: { type: "disabled" },
          }),
          signal: AbortSignal.timeout(27_000),
        });

        if (!upstream.ok || !upstream.body) {
          send({ error: `Assistant unavailable (${upstream.status}).` });
          send({ done: true });
          controller.close();
          return;
        }

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let emitted = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const token: string | undefined =
                json?.choices?.[0]?.delta?.content ??
                json?.choices?.[0]?.message?.content;
              if (token) {
                // Emit letter-by-letter chunks so the client can type it out.
                for (const ch of token) {
                  send({ token: ch });
                  emitted++;
                }
              }
            } catch {
              /* skip malformed frame */
            }
          }
        }

        if (emitted === 0) send({ error: "The assistant returned an empty reply. Try again." });
        send({ done: true });
      } catch (err) {
        send({ error: `Assistant failed: ${(err as Error).name === "TimeoutError" ? "timed out" : "network error"}.` });
        send({ done: true });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
