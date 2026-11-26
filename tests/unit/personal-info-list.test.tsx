// resume-sg#14 criteria 6, 7, 8, 10: the "Before you send it" list on #/app, and the dictionaries.
// Test hooks the builder must provide:
//  - data-testid="personal-info-list" on the list container (not rendered at all when there is no finding);
//    it contains the heading text and one <li> per finding id, each with buttons named "Show me" / "Ignore"
//    (zh: "定位" / "忽略"); the list sits under the preview (same page).
//  - dictionary keys (both en.ts and zh.ts, flat strings): pi.title ("Before you send it" / "发送前看一看"),
//    pi.show ("Show me" / "定位"), pi.ignore ("Ignore" / "忽略"), and keys starting "pi.line"
//    (the suggestion sentences; at least 5, one per finding id). Every "pi." value is checked by criterion 8.
//  - "Show me" focuses the field's input (the summary field has id "summary").
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import en from "../../src/i18n/en.ts";
import zh from "../../src/i18n/zh.ts";

const setup = (lang = "en-US") => {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(lang);
  window.location.hash = "#/app";
  return render(<App />);
};
const editor = () => screen.getByTestId("resume-editor");
const list = () => screen.queryByTestId("personal-info-list");
const need = (): HTMLElement => {
  const l = list();
  if (!l) throw new Error("personal-info-list is not rendered");
  return l;
};
const type = (label: RegExp, value: string) =>
  fireEvent.change(within(editor()).getByLabelText(label, { selector: "input,textarea" }), { target: { value } });
const summaryValue = () => (document.getElementById("summary") as HTMLTextAreaElement).value;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("criterion 6: the list", () => {
  it("is not rendered with no finding", () => {
    setup();
    expect(list()).toBeNull();
    type(/^summary$/i, "Backend engineer with six years of experience.");
    expect(list()).toBeNull();
  });
  it("typing the trigger shows the line, removing it hides the list", () => {
    setup();
    type(/^summary$/i, "Age: 32");
    const l = need();
    expect(within(l).getByText(/before you send it/i)).toBeTruthy();
    expect(l.textContent).toContain("Your summary mentions your age. Many employers do not need this; you can remove it.");
    expect(within(l).getAllByRole("listitem")).toHaveLength(1);
    type(/^summary$/i, "Backend engineer.");
    expect(list()).toBeNull();
  });
  it("one line per finding id", () => {
    setup();
    type(/^summary$/i, "Age: 32. Photo attached. Religion: none. NRIC S0000000Z. Married. DOB 1 Jan. 照片");
    expect(within(need()).getAllByRole("listitem")).toHaveLength(5);
  });
  it("shows the Chinese line in Chinese", () => {
    setup("zh-CN");
    type(/^简介$/, "年龄：32");
    const l = need();
    expect(l.textContent).toContain("简介中提到了年龄。许多雇主不需要这项信息，你可以删掉。");
    expect(within(l).getByText(/发送前看一看/)).toBeTruthy();
  });
});

describe("criterion 7: Show me and Ignore", () => {
  it("Show me focuses the field and removes nothing", () => {
    setup();
    type(/^summary$/i, "Age: 32");
    fireEvent.click(within(need()).getByRole("button", { name: /^show me/i }));
    expect(document.activeElement?.id).toBe("summary");
    expect(summaryValue()).toBe("Age: 32");
    expect(list()).toBeTruthy();
  });
  it("Ignore hides that finding for the session, keeps the text, other findings stay", () => {
    setup();
    type(/^summary$/i, "Age: 32. Religion: none");
    const items = within(need()).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const ageItem = items.find((i) => /age/i.test(i.textContent ?? ""));
    if (!ageItem) throw new Error("no age line");
    fireEvent.click(within(ageItem).getByRole("button", { name: /^ignore/i }));
    expect(within(need()).getAllByRole("listitem")).toHaveLength(1);
    expect(need().textContent).not.toMatch(/your age/i);
    type(/^summary$/i, "Age: 33. Religion: none");
    expect(need().textContent).not.toMatch(/your age/i);
    expect(summaryValue()).toBe("Age: 33. Religion: none");
  });
  it("Chinese buttons are 定位 and 忽略", () => {
    setup("zh-CN");
    type(/^简介$/, "年龄：32");
    expect(within(need()).getByRole("button", { name: /^定位/ })).toBeTruthy();
    fireEvent.click(within(need()).getByRole("button", { name: /^忽略/ }));
    expect(list()).toBeNull();
  });
});

describe("criteria 8 and 10: dictionaries", () => {
  const FORBIDDEN = /law|legal|illegal|discriminat|违法|法律|歧视/i;
  const pi = (d: object) => Object.entries(d).filter(([k]) => k.startsWith("pi.")) as [string, string][];
  const E = pi(en);
  const Z = pi(zh);

  it("10: new strings exist in both dictionaries with the same keys", () => {
    expect(E.length).toBeGreaterThanOrEqual(8);
    expect(E.map(([k]) => k).sort()).toEqual(Z.map(([k]) => k).sort());
    const e = Object.fromEntries(E);
    const z = Object.fromEntries(Z);
    expect([e["pi.title"], e["pi.show"], e["pi.ignore"]]).toEqual(["Before you send it", "Show me", "Ignore"]);
    expect([z["pi.title"], z["pi.show"], z["pi.ignore"]]).toEqual(["发送前看一看", "定位", "忽略"]);
    for (const [k, v] of [...E, ...Z]) expect(v.trim(), k).not.toBe("");
  });
  it("8: no suggestion text is a legal claim", () => {
    expect(E.length).toBeGreaterThan(0);
    for (const [k, v] of [...E, ...Z]) expect(v, k).not.toMatch(FORBIDDEN);
  });
  it("8: each suggestion line says many employers do not need it", () => {
    const le = E.filter(([k]) => k.startsWith("pi.line"));
    const lz = Z.filter(([k]) => k.startsWith("pi.line"));
    expect(le.length).toBeGreaterThanOrEqual(5);
    expect(lz.length).toBe(le.length);
    for (const [k, v] of le) expect(v, k).toContain("Many employers do not need");
    for (const [k, v] of lz) expect(v, k).toContain("许多雇主不需要");
  });
});
