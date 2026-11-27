// Shared SSE fixture for resume-sg#56: Anthropic streaming answers as a fake fetch Response.
// Synthetic data only. Every test that mocks the Messages API uses these helpers.

export interface SseOptions {
  /** text deltas, in order; a long string is split into chunks of `chunk` characters */
  text: string;
  /** thinking deltas sent before the text (must never reach the result) */
  thinking?: string[];
  stopReason?: string | null;
  outputTokens?: number | null;
  /** split the text into deltas of this many characters (default 40) */
  chunk?: number;
  /** send an extra non-text block (tool_use / redacted_thinking) that must be ignored */
  otherBlocks?: boolean;
}

const ev = (name: string, data: unknown): string => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

export function sseEvents(o: SseOptions): string[] {
  const out: string[] = [];
  out.push(ev("message_start", { type: "message_start", message: { id: "msg_fake", type: "message", role: "assistant", content: [], usage: { input_tokens: 10, output_tokens: 1 } } }));
  out.push(ev("ping", { type: "ping" }));
  let index = 0;
  if (o.thinking && o.thinking.length > 0) {
    out.push(ev("content_block_start", { type: "content_block_start", index, content_block: { type: "thinking", thinking: "" } }));
    for (const t of o.thinking) out.push(ev("content_block_delta", { type: "content_block_delta", index, delta: { type: "thinking_delta", thinking: t } }));
    out.push(ev("content_block_delta", { type: "content_block_delta", index, delta: { type: "signature_delta", signature: "sig-fake" } }));
    out.push(ev("content_block_stop", { type: "content_block_stop", index }));
    index++;
  }
  if (o.otherBlocks) {
    out.push(ev("content_block_start", { type: "content_block_start", index, content_block: { type: "tool_use", id: "tu_fake", name: "noop", input: {} } }));
    out.push(ev("content_block_delta", { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: "{\"x\":\"IGNORED-TOOL\"}" } }));
    out.push(ev("content_block_stop", { type: "content_block_stop", index }));
    index++;
  }
  out.push(ev("content_block_start", { type: "content_block_start", index, content_block: { type: "text", text: "" } }));
  const n = o.chunk ?? 40;
  for (let i = 0; i < o.text.length; i += n) {
    out.push(ev("content_block_delta", { type: "content_block_delta", index, delta: { type: "text_delta", text: o.text.slice(i, i + n) } }));
  }
  out.push(ev("content_block_stop", { type: "content_block_stop", index }));
  out.push(
    ev("message_delta", {
      type: "message_delta",
      delta: { stop_reason: o.stopReason === undefined ? "end_turn" : o.stopReason, stop_sequence: null },
      usage: { output_tokens: o.outputTokens === undefined ? 1234 : o.outputTokens },
    }),
  );
  out.push(ev("message_stop", { type: "message_stop" }));
  return out;
}

/** The whole SSE body as one string. */
export const sseBody = (o: SseOptions): string => sseEvents(o).join("");

const HEADERS = { "content-type": "text/event-stream" };

/** A 200 streaming Response. Events are enqueued one by one, split at arbitrary byte positions on request. */
export function sseResponse(o: SseOptions, opts: { splitAt?: number } = {}): Response {
  const bytes = new TextEncoder().encode(sseBody(o));
  const step = opts.splitAt ?? bytes.length;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += step) c.enqueue(bytes.slice(i, i + step));
      c.close();
    },
  });
  return new Response(stream, { status: 200, headers: HEADERS });
}

/** Shortcut: a normal end carrying `text`. */
export const sseText = (text: string, extra: Partial<SseOptions> = {}): Response => sseResponse({ text, ...extra });

/** A stream with a server `error` event after some text. */
export function sseErrorResponse(secret = ""): Response {
  const body =
    ev("message_start", { type: "message_start", message: { id: "m", type: "message", role: "assistant", content: [], usage: { input_tokens: 1, output_tokens: 1 } } }) +
    ev("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }) +
    ev("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "partial" } }) +
    ev("error", { type: "error", error: { type: "overloaded_error", message: `Overloaded ${secret}` } });
  return new Response(body, { status: 200, headers: HEADERS });
}

/** A stream that delivers a few events, then errors (a broken connection). */
export function sseBrokenResponse(): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode(ev("message_start", { type: "message_start", message: { id: "m", type: "message", role: "assistant", content: [], usage: { input_tokens: 1, output_tokens: 1 } } })));
      c.enqueue(enc.encode(ev("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "par" } })));
      c.error(new TypeError("network connection lost"));
    },
  });
  return new Response(stream, { status: 200, headers: HEADERS });
}

/** A live stream controlled by the test: push text deltas, then end. `cancelled` flips when the reader cancels it. */
export function liveSse(): {
  response: Response;
  start: () => void;
  text: (t: string) => void;
  thinking: (t: string) => void;
  end: (stopReason?: string, outputTokens?: number) => void;
  cancelled: () => boolean;
} {
  const enc = new TextEncoder();
  let ctl!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = false;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctl = c;
    },
    cancel() {
      cancelled = true;
    },
  });
  const push = (s: string) => {
    if (!closed && !cancelled) ctl.enqueue(enc.encode(s));
  };
  return {
    response: new Response(stream, { status: 200, headers: HEADERS }),
    start: () => {
      push(ev("message_start", { type: "message_start", message: { id: "m", type: "message", role: "assistant", content: [], usage: { input_tokens: 1, output_tokens: 1 } } }));
      push(ev("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } }));
    },
    thinking: (t) => push(ev("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: t } })),
    text: (t) => push(ev("content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: t } })),
    end: (stopReason = "end_turn", outputTokens = 100) => {
      push(ev("message_delta", { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: outputTokens } }));
      push(ev("message_stop", { type: "message_stop" }));
      if (!closed && !cancelled) ctl.close();
      closed = true;
    },
    cancelled: () => cancelled,
  };
}
