// resume-sg#7 criteria 3 and 4: callAnthropic against a fake fetch.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAnthropic } from "../../src/ai/anthropic.ts";
import { DEFAULT_MODEL } from "../../src/ai/settings.ts";

const KEY = "test-key-not-real";
const URL_ = "https://api.anthropic.com/v1/messages";

const okBody = (text = "ok") => JSON.stringify({ content: [{ type: "text", text }] });
const respond = (status: number, body = okBody()) => new Response(body, { status, headers: { "content-type": "application/json" } });

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
  it("sends exactly one POST with the contract url, headers and body", async () => {
    const f = vi.fn<typeof fetch>(async () => respond(200, okBody("Hel")));
    const out = await callAnthropic(req(f as unknown as typeof fetch));
    expect(out).toEqual({ text: "Hel" });
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
  it("returns the concatenated text blocks and ignores other blocks", async () => {
    const body = JSON.stringify({
      content: [
        { type: "text", text: "Hel" },
        { type: "thinking", thinking: "x" },
        { type: "text", text: "lo" },
      ],
    });
    const f = vi.fn(async () => respond(200, body));
    expect(await callAnthropic(req(f as unknown as typeof fetch))).toEqual({ text: "Hello" });
  });
  it("passes the abort signal to fetch", async () => {
    const f = vi.fn<typeof fetch>(async () => respond(200));
    const ac = new AbortController();
    await callAnthropic({ ...req(f as unknown as typeof fetch), signal: ac.signal });
    const init = f.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBe(ac.signal);
  });
});

describe("criterion 4: error kinds and no key leaks", () => {
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
  it("a 200 with invalid JSON gives kind bad-response", async () => {
    const e = await failure((async () => respond(200, `not json ${KEY}`)) as unknown as typeof fetch);
    expect(e.kind).toBe("bad-response");
    expectNoKey(e);
  });
});
