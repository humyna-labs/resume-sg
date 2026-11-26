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

export async function callAnthropic(req: AnthropicRequest): Promise<{ text: string }> {
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

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new AiError("bad-response");
  }
  const content = (data as { content?: unknown } | null)?.content;
  if (!Array.isArray(content)) throw new AiError("bad-response");
  let text = "";
  for (const block of content as { type?: unknown; text?: unknown }[]) {
    if (block && block.type === "text" && typeof block.text === "string") text += block.text;
  }
  return { text };
}
