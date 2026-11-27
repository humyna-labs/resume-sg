export type AiErrorKind = "auth" | "billing" | "permission" | "rate" | "server" | "network" | "bad-response" | "http";

/** An AI call failure. The message is fixed text per kind and never contains the key. */
export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status?: number;
  constructor(kind: AiErrorKind, status?: number) {
    super(`Anthropic request failed (${kind}${status === undefined ? "" : ` ${status}`})`);
    this.name = "AiError";
    this.kind = kind;
    if (status !== undefined) this.status = status;
  }
}

export interface AnthropicRequest {
  key: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** Called with the number of text characters received so far. */
  onText?: (charsSoFar: number) => void;
}

export interface AnthropicResult {
  text: string;
  stopReason: string | null;
  outputTokens: number | null;
}

const URL_MESSAGES = "https://api.anthropic.com/v1/messages";

function kindFor(status: number): AiErrorKind {
  if (status === 401) return "auth";
  if (status === 402) return "billing";
  if (status === 403) return "permission";
  if (status === 429) return "rate";
  if (status >= 500) return "server";
  return "http";
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

export async function callAnthropic(req: AnthropicRequest): Promise<AnthropicResult> {
  const doFetch: typeof fetch = req.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  const init: RequestInit = {
    method: "POST",
    headers: {
      "x-api-key": req.key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: req.maxTokens,
      stream: true,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    }),
  };
  if (req.signal) init.signal = req.signal;

  let res: Response;
  try {
    res = await doFetch(URL_MESSAGES, init);
  } catch {
    throw new AiError("network");
  }
  if (!res.ok) throw new AiError(kindFor(res.status), res.status);
  if (!res.body) throw new AiError("bad-response");

  const reader = res.body.getReader();
  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  if (req.signal) {
    if (req.signal.aborted) onAbort();
    else req.signal.addEventListener("abort", onAbort, { once: true });
  }
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let stopReason: string | null = null;
  let outputTokens: number | null = null;
  let done = false;

  const handle = (block: string): void => {
    const data = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""))
      .join("\n");
    if (data === "") return;
    let ev: unknown;
    try {
      ev = JSON.parse(data);
    } catch {
      throw new AiError("bad-response");
    }
    if (!isObj(ev)) return;
    switch (ev["type"]) {
      case "error":
        throw new AiError("bad-response");
      case "content_block_delta": {
        const d = ev["delta"];
        if (isObj(d) && d["type"] === "text_delta" && typeof d["text"] === "string") {
          text += d["text"];
          req.onText?.(text.length);
        }
        break;
      }
      case "message_delta": {
        const d = ev["delta"];
        if (isObj(d) && "stop_reason" in d) stopReason = typeof d["stop_reason"] === "string" ? d["stop_reason"] : null;
        const u = ev["usage"];
        if (isObj(u) && typeof u["output_tokens"] === "number") outputTokens = u["output_tokens"];
        break;
      }
      case "message_stop":
        done = true;
        break;
      default:
        break;
    }
  };

  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        throw new AiError("network");
      }
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      const parts = buf.split(/\r?\n\r?\n/);
      buf = parts.pop() ?? "";
      for (const part of parts) handle(part);
      if (done) break;
    }
    if (!done) {
      buf += decoder.decode();
      if (buf.trim() !== "") handle(buf);
    }
  } finally {
    req.signal?.removeEventListener("abort", onAbort);
    if (done) void reader.cancel().catch(() => undefined);
  }
  if (req.signal?.aborted) throw new AiError("network");
  if (!done) throw new AiError("bad-response");
  return { text, stopReason, outputTokens };
}
