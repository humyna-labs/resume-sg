// resume-sg#7 criteria 3 and 4, updated for resume-sg#56 (streaming): callAnthropic against a fake fetch that answers with SSE.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiError, callAnthropic } from "../../src/ai/anthropic.ts";
import { DEFAULT_MODEL } from "../../src/ai/settings.ts";
import { liveSse, sseBrokenResponse, sseErrorResponse, sseResponse, sseText } from "../fixtures/sse.ts";

const KEY = "test-key-not-real";
const URL_ = "https://api.anthropic.com/v1/messages";

const respond = (status: number, body = "ok") =>
  status === 200 ? sseText(body) : new Response(body, { status, headers: { "content-type": "application/json" } });

const req = (fetchImpl: typeof fetch) => ({
  key: KEY,
  model: DEFAULT_MODEL,
  system: "You are a test.",
  user: "hello",
  maxTokens: 7,
  fetchImpl,
});

let logs: string[] = [];
beforeEach(() => {
  logs = [];
  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      logs.push(a.map((x) => (x instanceof Error ? `${x.name}: ${x.message}\n${x.stack ?? ""}` : String(x))).join(" "));
    });
  }
});
afterEach(() => vi.restoreAllMocks());

describe("settings", () => {
  it("default model id", () => {
    expect(DEFAULT_MODEL).toBe("claude-sonnet-5-5");
  });
});

describe("criterion 3: request shape", () => {
  it("sends exactly one POST with the contract url, headers and body (stream: true)", async () => {
    const f = vi.fn<typeof fetch>(async () => respond(200, "Hel"));
    const out = await callAnthropic(req(f as unknown as typeof fetch));
    expect(out).toEqual({ text: "Hel", stopReason: "end_turn", outputTokens: 1234 });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as [string | URL | Request, RequestInit];
    expect(String(url)).toBe(URL_);
    expect(init.method).toBe("POST");
    const h = new Headers(init.headers);
    expect(h.get("x-api-key")).toBe(KEY);
    expect(h.get("anthropic-version")).toBe("2023-06-01");
    expect(h.get("anthropic-dangerous-direct-browser-access")).toBe("true");
    expect(h.get("content-type")).toBe("application/json");
    expect([...h.keys()].sort()).toEqual(
      ["anthropic-dangerous-direct-browser-access", "anthropic-version", "content-type", "x-api-key"],
    );
    expect(JSON.parse(String(init.body))).toEqual({
      model: DEFAULT_MODEL,
      max_tokens: 7,
      stream: true,
      system: "You are a test.",
      messages: [{ role: "user", content: "hello" }],
    });
  });
  it("the key appears only in the x-api-key header", async () => {
    const f = vi.fn<typeof fetch>(async () => respond(200));
    await callAnthropic(req(f as unknown as typeof fetch));
    const [url, init] = f.mock.calls[0] as [string | URL | Request, RequestInit];
    expect(String(url)).not.toContain(KEY);
    expect(String(init.body)).not.toContain(KEY);
    const h = new Headers(init.headers);
    for (const [k, v] of h.entries()) if (k !== "x-api-key") expect(v).not.toContain(KEY);
  });
  it("the request body has no thinking, effort or output_config field", async () => {
    const f = vi.fn<typeof fetch>(async () => respond(200));
    await callAnthropic(req(f as unknown as typeof fetch));
    const body = JSON.parse(String((f.mock.calls[0]?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body["stream"]).toBe(true);
    for (const k of ["thinking", "effort", "output_config"]) expect(k in body).toBe(false);
  });
  it("passes the abort signal to fetch", async () => {
    const f = vi.fn<typeof fetch>(async () => respond(200));
    const ac = new AbortController();
    await callAnthropic({ ...req(f as unknown as typeof fetch), signal: ac.signal });
    const init = f.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBe(ac.signal);
  });
});

describe("criterion 1 (#56): streaming", () => {
  it("joins text deltas only; thinking and other blocks are ignored; stopReason and outputTokens come from message_delta", async () => {
    const f = vi.fn(async () =>
      sseResponse({ text: "Hello, world!", chunk: 3, thinking: ["secret thought one", "two"], otherBlocks: true, stopReason: "end_turn", outputTokens: 321 }),
    );
    const out = await callAnthropic(req(f as unknown as typeof fetch));
    expect(out).toEqual({ text: "Hello, world!", stopReason: "end_turn", outputTokens: 321 });
  });
  it("events split at arbitrary byte positions (also inside a multi-byte character) give the same text", async () => {
    const text = "你好，世界。Alex Example 的简历";
    const f = vi.fn(async () => sseResponse({ text, chunk: 2 }, { splitAt: 7 }));
    const out = await callAnthropic(req(f as unknown as typeof fetch));
    expect(out.text).toBe(text);
  });
  it("stop_reason max_tokens is returned, not thrown", async () => {
    const f = vi.fn(async () => sseResponse({ text: '{"a":', stopReason: "max_tokens", outputTokens: 32000 }));
    expect(await callAnthropic(req(f as unknown as typeof fetch))).toEqual({ text: '{"a":', stopReason: "max_tokens", outputTokens: 32000 });
  });
  it("onText reports the characters of text received so far, growing, and never counts thinking", async () => {
    const seen: number[] = [];
    const f = vi.fn(async () => sseResponse({ text: "x".repeat(100), chunk: 25, thinking: ["y".repeat(500)] }));
    await callAnthropic({ ...req(f as unknown as typeof fetch), onText: (n: number) => seen.push(n) });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(100);
    expect([...seen].sort((p, q) => p - q)).toEqual(seen);
  });
});

describe("criterion 2: error kinds and no key leaks", () => {
  const leaky = (status: number) =>
    respond(status, JSON.stringify({ error: { type: "x", message: `bad credential ${KEY}` } }));
  const STATUS: [number, string][] = [
    [401, "auth"],
    [402, "billing"],
    [403, "permission"],
    [429, "rate"],
    [500, "server"],
    [529, "server"],
    [503, "server"],
    [504, "server"],
    [400, "http"],
    [404, "http"],
  ];
  async function failure(fetchImpl: typeof fetch) {
    try {
      await callAnthropic(req(fetchImpl));
    } catch (e) {
      return e as Error & { kind?: string };
    }
    throw new Error("callAnthropic did not throw");
  }
  function expectNoKey(e: Error) {
    expect(e.message).not.toContain(KEY);
    expect(String(e)).not.toContain(KEY);
    expect(e.stack ?? "").not.toContain(KEY);
    expect(JSON.stringify(e)).not.toContain(KEY);
    expect(logs.join("\n")).not.toContain(KEY);
  }
  it.each(STATUS)("HTTP %i gives kind %s", async (status, kind) => {
    const e = await failure((async () => leaky(status)) as unknown as typeof fetch);
    expect(e.kind).toBe(kind);
    expect(e.message.length).toBeGreaterThan(0);
    expectNoKey(e);
  });
  it("a rejected fetch gives kind network, even if the cause mentions the key", async () => {
    const e = await failure((async () => {
      throw new TypeError(`Failed to fetch (${KEY})`);
    }) as unknown as typeof fetch);
    expect(e.kind).toBe("network");
    expectNoKey(e);
  });
  it("a 200 that is not an event stream gives kind bad-response", async () => {
    const e = await failure((async () => new Response(`not json ${KEY}`, { status: 200 })) as unknown as typeof fetch);
    expect(e).toBeInstanceOf(AiError);
    expect(e.kind).toBe("bad-response");
    expectNoKey(e);
  });
  it("an error event mid-stream gives an AiError (bad-response or network) without the key or the server text", async () => {
    const e = await failure((async () => sseErrorResponse(KEY)) as unknown as typeof fetch);
    expect(e).toBeInstanceOf(AiError);
    expect(["bad-response", "network"]).toContain(e.kind);
    expect(e.message).not.toContain("Overloaded");
    expectNoKey(e);
  });
  it("a broken stream gives an AiError (network or bad-response)", async () => {
    const e = await failure((async () => sseBrokenResponse()) as unknown as typeof fetch);
    expect(e).toBeInstanceOf(AiError);
    expect(["bad-response", "network"]).toContain(e.kind);
    expectNoKey(e);
  });
  it("a stream that ends without message_stop gives an AiError", async () => {
    const body = 'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":1,"output_tokens":1}}}\n\n';
    const e = await failure((async () => new Response(body, { status: 200 })) as unknown as typeof fetch);
    expect(e).toBeInstanceOf(AiError);
  });
});

describe("criterion 3 (#56): abort during the stream", () => {
  it("cancels the read and rejects; nothing is returned", async () => {
    const live = liveSse();
    const ac = new AbortController();
    const f = vi.fn(async () => live.response);
    const settled = callAnthropic({ ...req(f as unknown as typeof fetch), signal: ac.signal }).then(
      () => "resolved" as unknown,
      (e: unknown) => e,
    );
    live.start();
    live.text("partial");
    await new Promise((r) => setTimeout(r, 20));
    ac.abort();
    const out = await settled;
    expect(out).not.toBe("resolved");
    await new Promise((r) => setTimeout(r, 20));
    expect(live.cancelled()).toBe(true);
    expect(String(out instanceof Error ? out.message : out)).not.toContain(KEY);
  });
});
