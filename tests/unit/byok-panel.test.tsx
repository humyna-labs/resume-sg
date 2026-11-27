// resume-sg#7 criteria 1, 2, 5, 5a, 5b, 5c, 6 and 10: the AI settings panel on the App page.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import * as enMod from "../../src/i18n/en.ts";
import * as zhMod from "../../src/i18n/zh.ts";
import { clearKey } from "../../src/security/keyStore.ts";
import { sseText } from "../fixtures/sse.ts";
import { leafValues, shape } from "./dict-helpers.ts";

type L = "en" | "zh";
const TAG = { en: "en-US", zh: "zh-CN" } as const;
const KEY = "test-key-not-real";
const SLOT = "jd2cv.apiKey";
const norm = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const pick = (m: Record<string, unknown>, name: string) => (m.default ?? m[name]) as Record<string, unknown>;
const en = pick(enMod, "en");
const zh = pick(zhMod, "zh");

const T = {
  en: {
    keyLabel: "Anthropic API key",
    remember: "Remember on this device",
    warn: "Anyone who can use this browser can use your key. Use a separate key with a spending limit.",
    test: "Test connection",
    modelId: "Model ID",
    other: "Other (custom)",
    show: /show/i,
    hide: /hide/i,
    help: "No key yet? Get one in 3 steps",
    steps: [
      "Open the Claude Console (platform.claude.com) and sign up or log in. It is Anthropic's developer platform, separate from your claude.ai chat account.",
      "Buy prepaid credits under Billing. The API is pay-as-you-go and stops working at a zero balance.",
      "On the API keys page, click Create key, copy the key that starts with sk-ant- and paste it above. It is shown only once.",
    ],
    tip: "Tip: create a separate key for JD2CV with a spending limit, and delete it in the Console when you no longer need it.",
    protect: "How we protect your key ›",
    hint: "Anthropic keys usually start with sk-ant-. Check that you copied all of it.",
    msgs: {
      ok: "Connected.",
      401: "The key is not valid. Check it or create a new one in the Console.",
      402: "No credit or payment method. Buy credits under Billing in the Console.",
      403: "This key has no access. Check its workspace in the Console.",
      429: "Too many requests or the spending limit was reached. Try again later.",
      server: "Anthropic is busy. Try again in a moment.",
      network: "Cannot reach Anthropic. Check your connection.",
    },
  },
  zh: {
    keyLabel: "Anthropic API key（密钥）",
    remember: "在这台设备上记住",
    warn: "能使用这个浏览器的人都能使用你的 key。建议单独建一个 key 并设置用量上限。",
    test: "测试连接",
    modelId: "模型 ID",
    other: "其他（自定义）",
    show: /显示|show/i,
    hide: /隐藏|hide/i,
    help: "还没有 key？3 步获取",
    steps: [
      "打开 Claude 控制台（platform.claude.com），注册或登录。它是 Anthropic 的开发者平台，和 claude.ai 的聊天账号是分开的。",
      "在 Billing（账单）里购买预付额度。API 按用量付费，余额为 0 时无法使用。",
      "在 API keys 页面点 Create key，复制以 sk-ant- 开头的 key，粘贴到上面。key 只显示一次。",
    ],
    tip: "建议为 JD2CV 单独建一个 key 并设置用量上限；不用时可以在控制台删除它。",
    protect: "我们怎么保护你的 key ›",
    hint: "Anthropic 的 key 通常以 sk-ant- 开头，请检查是否复制完整。",
    msgs: {
      ok: "连接成功。",
      401: "key 无效，请检查是否复制完整，或在控制台重新创建。",
      402: "账户额度不足或没有付款方式，请在控制台的 Billing 里购买额度。",
      403: "这个 key 没有访问权限，请检查它所属的工作区。",
      429: "请求太频繁或达到了用量上限，请稍后再试。",
      server: "Anthropic 暂时繁忙，请稍后再试。",
      network: "无法连接 Anthropic，请检查网络。",
    },
  },
};

// resume-sg#41: the key row and the model select are on step 4 of the wizard, so #/app is walked to step 4.
function setup(lang: L, hash = "#/app") {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(TAG[lang]);
  window.location.hash = hash;
  const view = render(<App />);
  if (hash === "#/app") {
    const label = lang === "en" ? ["Your current resume", "Job description"] : ["你的原始简历", "职位描述（JD）"];
    const next = () => fireEvent.click(screen.getByTestId("step-next"));
    fireEvent.change(within(main()).getByLabelText(label[0] as string), { target: { value: "Sam Sample, backend engineer" } });
    next();
    fireEvent.change(within(main()).getByLabelText(label[1] as string), { target: { value: "Any backend job" } });
    next();
    next();
  }
  return view;
}
const main = () => screen.getByRole("main");
const mainText = () => norm(main().textContent ?? "");
const keyInput = (lang: L) => within(main()).getByLabelText(T[lang].keyLabel) as HTMLInputElement;
const panel = (lang: L) => within(screen.getByRole("region", { name: lang === "en" ? "AI settings" : "AI 设置" }));
const modelSelect = (lang: L) => panel(lang).getByRole("combobox", { name: lang === "en" ? "Model" : "模型" }) as HTMLSelectElement;
const chooseOther = (lang: L) => {
  const opt = Array.from(modelSelect(lang).options).find((o) => norm(o.textContent ?? "") === norm(T[lang].other));
  expect(opt, "Other (custom) option").toBeTruthy();
  fireEvent.change(modelSelect(lang), { target: { value: opt?.value } });
};
const modelInput = (lang: L) => panel(lang).getByLabelText(T[lang].modelId) as HTMLInputElement;
const rememberBox = (lang: L) => within(main()).getByLabelText(T[lang].remember) as HTMLInputElement;
const testBtn = (lang: L) => within(main()).getByRole("button", { name: T[lang].test }) as HTMLButtonElement;
const typeKey = (lang: L, v = KEY) => fireEvent.change(keyInput(lang), { target: { value: v } });
const resp = (status: number, body = "{}") =>
  status === 200 ? sseText(body, { stopReason: "max_tokens", outputTokens: 1 }) : new Response(body, { status, headers: { "content-type": "application/json" } });
const OK = "ok";

let logs: string[] = [];
beforeEach(() => {
  localStorage.clear();
  clearKey();
  window.location.hash = "";
  logs = [];
  for (const m of ["log", "info", "warn", "error", "debug"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(" ")));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearKey();
  localStorage.clear();
});

for (const lang of ["en", "zh"] as const) {
  const c = T[lang];
  describe(`AI settings panel, ${lang}`, () => {
    it(`criterion 1: key field is a password input with label, placeholder and show/hide toggle`, () => {
      setup(lang);
      const k = keyInput(lang);
      expect(k.tagName).toBe("INPUT");
      expect(k.type).toBe("password");
      expect(k.getAttribute("placeholder")).toBe("sk-ant-...");
      const toggle = within(main()).getByRole("button", { name: c.show });
      fireEvent.click(toggle);
      expect(keyInput(lang).type).toBe("text");
      fireEvent.click(within(main()).getByRole("button", { name: c.hide }));
      expect(keyInput(lang).type).toBe("password");
    });

    it(`criterion 1: typing a key writes nothing to localStorage`, () => {
      setup(lang);
      typeKey(lang);
      expect(keyInput(lang).value).toBe(KEY);
      expect(localStorage.length).toBe(0);
    });

    it(`criterion 2: remember box is unchecked by default and the warning is hidden`, () => {
      setup(lang);
      expect(rememberBox(lang).type).toBe("checkbox");
      expect(rememberBox(lang).checked).toBe(false);
      expect(mainText()).not.toContain(norm(c.warn));
    });

    it(`criterion 2: ticking shows the warning and stores the key; unticking removes it`, () => {
      setup(lang);
      typeKey(lang);
      fireEvent.click(rememberBox(lang));
      expect(rememberBox(lang).checked).toBe(true);
      expect(mainText()).toContain(norm(c.warn));
      expect(localStorage.getItem(SLOT)).toBe(KEY);
      fireEvent.click(rememberBox(lang));
      expect(rememberBox(lang).checked).toBe(false);
      expect(localStorage.getItem(SLOT)).toBeNull();
      expect(mainText()).not.toContain(norm(c.warn));
    });

    it(`criterion 2: with the box ticked, a later key edit is stored too`, () => {
      setup(lang);
      fireEvent.click(rememberBox(lang));
      typeKey(lang);
      expect(localStorage.getItem(SLOT)).toBe(KEY);
    });

    it(`criterion 2: on load a remembered key is read back and the box is ticked`, () => {
      localStorage.setItem(SLOT, KEY);
      setup(lang);
      expect(keyInput(lang).value).toBe(KEY);
      expect(rememberBox(lang).checked).toBe(true);
    });

    it(`criterion 5: Test connection is disabled without a key and enabled with one`, () => {
      setup(lang);
      expect(testBtn(lang).disabled).toBe(true);
      typeKey(lang);
      expect(testBtn(lang).disabled).toBe(false);
    });

    it(`criterion 5: one request with max_tokens 1 and a one-word message; button disabled while it runs`, async () => {
      let release: (r: Response) => void = () => {};
      const f = vi.fn(() => new Promise<Response>((r) => (release = r)));
      vi.stubGlobal("fetch", f);
      setup(lang);
      typeKey(lang);
      fireEvent.click(testBtn(lang));
      await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
      expect(testBtn(lang).disabled).toBe(true);
      fireEvent.click(testBtn(lang));
      expect(f).toHaveBeenCalledTimes(1);
      const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
      expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
      const body = JSON.parse(String(init.body)) as { max_tokens: number; model: string; messages: { role: string; content: string }[] };
      expect(body.max_tokens).toBe(1);
      expect(body.model).toBe("claude-sonnet-5-5");
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0]?.role).toBe("user");
      expect(body.messages[0]?.content).toMatch(/^\S+$/);
      await act(async () => release(resp(200, OK)));
      await waitFor(() => expect(testBtn(lang).disabled).toBe(false));
    });

    const ROWS: [string, () => Response | Promise<Response>, string][] = [
      ["200", () => resp(200, OK), c.msgs.ok],
      ["401", () => resp(401), c.msgs[401]],
      ["402", () => resp(402), c.msgs[402]],
      ["403", () => resp(403), c.msgs[403]],
      ["429", () => resp(429), c.msgs[429]],
      ["500", () => resp(500), c.msgs.server],
      ["529", () => resp(529), c.msgs.server],
      ["503 (other 5xx)", () => resp(503), c.msgs.server],
      ["network error", () => Promise.reject(new TypeError(`Failed to fetch ${KEY}`)), c.msgs.network],
    ];
    it.each(ROWS)(`criterion 5: %s shows the exact message`, async (_n, make, message) => {
      vi.stubGlobal("fetch", vi.fn(async () => make()));
      setup(lang);
      typeKey(lang);
      fireEvent.click(testBtn(lang));
      await waitFor(() => expect(mainText()).toContain(norm(message)));
      // a status message from an earlier row must not be shown next to it
      const others = Object.values(c.msgs).filter((m) => m !== message);
      for (const o of others) expect(mainText()).not.toContain(norm(o));
      // criterion 4: nothing the UI shows or logs contains the key (the password input's value excepted)
      expect(main().textContent ?? "").not.toContain(KEY);
      expect(document.title).not.toContain(KEY);
      expect(logs.join("\n")).not.toContain(KEY);
      for (const el of Array.from(document.querySelectorAll("input, textarea")))
        if (el !== keyInput(lang)) expect((el as HTMLInputElement).value).not.toContain(KEY);
    });

    it(`criterion 5a: help line, ordered steps, tip and links`, () => {
      setup(lang);
      const toggle = within(main()).getByRole("button", { name: c.help });
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      const ol = Array.from(main().querySelectorAll("ol")).find((o) => o.querySelectorAll(":scope > li").length === 3);
      expect(ol, "ordered list with three steps").toBeTruthy();
      const items = Array.from(ol?.querySelectorAll(":scope > li") ?? []);
      c.steps.forEach((s, i) => expect(norm(items[i]?.textContent ?? "")).toBe(norm(s)));
      expect(mainText()).toContain(norm(c.tip));
      const console_ = items[0]?.querySelector("a") as HTMLAnchorElement;
      expect(console_.textContent?.trim()).toBe("platform.claude.com");
      expect(console_.getAttribute("href")).toBe("https://platform.claude.com");
      const keys = items[2]?.querySelector("a") as HTMLAnchorElement;
      expect(keys.textContent?.trim()).toBe("API keys");
      expect(keys.getAttribute("href")).toBe("https://platform.claude.com/settings/keys");
      for (const a of [console_, keys]) {
        expect(a.getAttribute("target")).toBe("_blank");
        const rel = (a.getAttribute("rel") ?? "").split(/\s+/);
        expect(rel).toContain("noopener");
        expect(rel).toContain("noreferrer");
      }
      const protect = within(main()).getByRole("link", { name: c.protect });
      expect(protect.getAttribute("href")).toMatch(/^#\/faq(\/key-safety)?$/);
    });

    it(`criterion 5a: the help collapses and expands with aria-expanded`, () => {
      setup(lang);
      const toggle = within(main()).getByRole("button", { name: c.help });
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(mainText()).not.toContain(norm(c.steps[1] ?? ""));
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(mainText()).toContain(norm(c.steps[1] ?? ""));
    });

    it(`criterion 5a: not expanded by default when a remembered key is already present`, () => {
      localStorage.setItem(SLOT, KEY);
      setup(lang);
      expect(within(main()).getByRole("button", { name: c.help }).getAttribute("aria-expanded")).toBe("false");
    });

    it(`criterion 5b: the format hint shows for a wrong prefix, never for sk-ant- or an empty field, and never blocks`, () => {
      setup(lang);
      expect(mainText()).not.toContain(norm(c.hint));
      typeKey(lang, "test-key-not-real");
      expect(mainText()).toContain(norm(c.hint));
      expect(testBtn(lang).disabled).toBe(false);
      typeKey(lang, "sk-ant-test-not-real");
      expect(mainText()).not.toContain(norm(c.hint));
      typeKey(lang, "");
      expect(mainText()).not.toContain(norm(c.hint));
    });

    it(`criterion 6: model id defaults to claude-sonnet-5-5`, () => {
      setup(lang);
      chooseOther(lang);
      expect(modelInput(lang).value).toBe("claude-sonnet-5-5");
    });

    it.each(["a", "-abc", "Claude-Sonnet", "has space", "a".repeat(65), "bad/id", ""])(
      `criterion 6: invalid model id %j shows an inline error and disables Test connection`,
      (id) => {
        const f = vi.fn(async () => resp(200, OK));
        vi.stubGlobal("fetch", f);
        setup(lang);
        typeKey(lang);
        expect(testBtn(lang).disabled).toBe(false);
        chooseOther(lang);
        fireEvent.change(modelInput(lang), { target: { value: id } });
        expect(testBtn(lang).disabled).toBe(true);
        const flagged =
          modelInput(lang).getAttribute("aria-invalid") === "true" || main().querySelector("[role=alert]") !== null;
        expect(flagged, "inline error (aria-invalid or role=alert)").toBe(true);
        fireEvent.click(testBtn(lang));
        expect(f).not.toHaveBeenCalled();
      },
    );

    it.each(["claude-opus-5-5", "ab", "a1.b-2", `a${"b".repeat(63)}`])(
      `criterion 6: valid model id %s is accepted and sent`,
      async (id) => {
        const f = vi.fn(async () => resp(200, OK));
        vi.stubGlobal("fetch", f);
        setup(lang);
        typeKey(lang);
        chooseOther(lang);
        fireEvent.change(modelInput(lang), { target: { value: id } });
        expect(testBtn(lang).disabled).toBe(false);
        expect(main().querySelector("[role=alert]")).toBeNull();
        fireEvent.click(testBtn(lang));
        await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
        const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
        expect((JSON.parse(String(init.body)) as { model: string }).model).toBe(id);
      },
    );

    it(`criterion 10: the panel controls are keyboard reachable`, () => {
      setup(lang);
      chooseOther(lang);
      for (const el of [keyInput(lang), modelSelect(lang), modelInput(lang), rememberBox(lang), testBtn(lang)]) {
        expect(el.getAttribute("tabindex")).not.toBe("-1");
      }
      // owner 2026-11-27: the focused step heading of the wizard (resume-sg#41 criterion 10) is the one allowed tabindex=-1
      const offenders = Array.from(main().querySelectorAll("[tabindex='-1']")).filter((e) => e.getAttribute("data-testid") !== "step-heading");
      expect(offenders.length).toBe(0);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    });
  });
}

describe("criterion 5c: FAQ entry for the key and the anchor", () => {
  for (const lang of ["en", "zh"] as const) {
    it(`#/faq/key-safety renders the FAQ page with that entry, ${lang}`, () => {
      setup(lang, "#/faq/key-safety");
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(screen.getByRole("heading", { level: 1 }).textContent?.trim()).toBe(lang === "en" ? "FAQ" : "常见问题");
      const entry = document.getElementById("key-safety");
      expect(entry, "element with id key-safety").not.toBeNull();
      expect(norm(entry?.textContent ?? "")).toContain(lang === "en" ? "Is my API key safe?" : "我的 API key 安全吗？");
    });
  }
});

describe("criterion 10: dictionaries", () => {
  it("en and zh have the same shape and no empty string", () => {
    expect(shape(zh)).toEqual(shape(en));
    for (const d of [en, zh]) for (const v of leafValues(d)) expect(v.trim()).not.toBe("");
  });
  it("every new plain string exists in its dictionary", () => {
    for (const lang of ["en", "zh"] as const) {
      const all = leafValues(lang === "en" ? en : zh).map(norm).join("\n");
      const c = T[lang];
      const wanted = [c.keyLabel, c.remember, c.warn, c.test, c.help, c.tip, c.protect, c.hint, ...Object.values(c.msgs)];
      for (const w of wanted) expect(all, `${lang}: ${w}`).toContain(norm(w));
    }
  });
});
