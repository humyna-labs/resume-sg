/* eslint-disable @typescript-eslint/no-non-null-assertion */
// resume-sg#6 criteria 4, 5, 6, 7, 10, 11: the editor and live preview on #/app.
// Test hooks the builder must provide: data-testid="resume-editor" and data-testid="resume-preview".
// Button names (English): "Load example", "Clear", "Add experience", "Add education", "Add skill group",
// "Add bullet", "Add detail", "Add item", "Add link", "Add certificate", "Add language",
// "Move up: <text>", "Move down: <text>", "Remove: <text>" where <text> is the entry's title / school /
// group name / the string itself.
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openEditor } from "./flow-helpers.tsx";
import en from "../../src/i18n/en.ts";
import zh from "../../src/i18n/zh.ts";
import { formatRange } from "../../src/resume/dates.ts";
import { sampleResume } from "../../src/resume/sample.ts";
import { shape } from "./dict-helpers.ts";

const S = sampleResume();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CJK = /[一-鿿]/;

async function setup() {
  await openEditor("en");
}
const editor = () => screen.getByTestId("resume-editor");
const preview = () => screen.getByTestId("resume-preview");
const btn = (name: string | RegExp) => within(editor()).getByRole("button", { name });
const btns = (name: string | RegExp) => within(editor()).getAllByRole("button", { name });
const click = (name: string | RegExp) => fireEvent.click(btn(name));
const fields = (label: string | RegExp) =>
  within(editor())
    .queryAllByLabelText(label)
    .filter((e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)) as HTMLInputElement[];
const vals = (label: string | RegExp) => fields(label).map((f) => f.value);
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const loadExample = () => click(/^load example$/i);
const switchLang = () => fireEvent.click(document.querySelector("button.lang") as HTMLElement);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("criterion 4: labelled fields for every model field (en)", () => {
  it("empty editor shows basics, summary and the add buttons", async () => {
    await setup();
    for (const l of [/^name$/i, /^headline$/i, /^email$/i, /^phone$/i, /^location$/i, /^summary$/i])
      expect(fields(l), String(l)).toHaveLength(1);
    for (const b of [/^add experience$/i, /^add education$/i, /^add skill group$/i, /^add link$/i, /^add certificate$/i, /^add language$/i, /^load example$/i, /^clear$/i])
      expect(btn(b)).toBeTruthy();
  });

  it("with the example loaded every model field has a labelled input", async () => {
    await setup();
    loadExample();
    const n = (l: RegExp) => fields(l).length;
    expect(n(/^company$/i)).toBe(2);
    expect(n(/^(job )?title$/i)).toBe(2);
    expect(n(/^location$/i)).toBe(3); // basics + 2 experience entries
    expect(n(/^start$/i)).toBe(3); // 2 experience + 1 education
    expect(n(/^end$/i)).toBe(3);
    expect(n(/bullet/i)).toBe(5);
    expect(n(/^school$/i)).toBe(1);
    expect(n(/^degree$/i)).toBe(1);
    expect(n(/detail/i)).toBe(S.education[0]!.details.length);
    expect(n(/group name/i)).toBe(2);
    expect(n(/item/i)).toBe(S.skills.reduce((a, g) => a + g.items.length, 0));
    expect(n(/certificate/i)).toBe(1);
    expect(n(/language/i)).toBe(2);
    expect(n(/link/i)).toBe(S.basics.links.length);
    expect(vals(/^name$/i)).toEqual(["Alex Example"]);
    expect(vals(/^email$/i)).toEqual(["alex@example.com"]);
    expect(vals(/^company$/i)).toEqual(S.experience.map((e) => e.company));
  });

  const allControls = () =>
    Array.from(editor().querySelectorAll<HTMLInputElement>("input, textarea, select")).filter((e) => e.type !== "hidden");

  it("every input has a visible label (en)", async () => {
    await setup();
    loadExample();
    const list = allControls();
    expect(list.length).toBeGreaterThan(20);
    for (const el of list) {
      const text = Array.from(el.labels ?? []).map((l) => l.textContent?.trim() ?? "").join("");
      expect(text, el.outerHTML.slice(0, 80)).not.toBe("");
    }
  });

  it("every input has a visible label in Chinese, different from English", async () => {
    await setup();
    loadExample();
    const enLabels = allControls().map((el) => Array.from(el.labels ?? []).map((l) => l.textContent?.trim()).join(""));
    switchLang();
    const list = allControls();
    expect(list).toHaveLength(enLabels.length);
    list.forEach((el, i) => {
      const text = Array.from(el.labels ?? []).map((l) => l.textContent?.trim() ?? "").join("");
      expect(text, `control ${i}`).not.toBe("");
      expect(text, `control ${i}`).toMatch(CJK);
      expect(text).not.toBe(enLabels[i]);
    });
  });
});

describe("criterion 5: add, edit, reorder, remove (en)", () => {
  it("experience: add, edit, move, remove", async () => {
    await setup();
    loadExample();
    const [t1, t2] = S.experience.map((e) => e.title);
    click(/^add experience$/i);
    expect(fields(/^company$/i)).toHaveLength(3);
    type(fields(/^company$/i)[2]!, "New Co");
    expect(vals(/^company$/i)[2]).toBe("New Co");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Move up: ${esc(t2!)}$`) }));
    expect(vals(/^company$/i).slice(0, 2)).toEqual([S.experience[1]!.company, S.experience[0]!.company]);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Move down: ${esc(t2!)}$`) }));
    expect(vals(/^company$/i).slice(0, 2)).toEqual([S.experience[0]!.company, S.experience[1]!.company]);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Remove: ${esc(t1!)}$`) }));
    expect(vals(/^company$/i)).toEqual([S.experience[1]!.company, "New Co"]);
  });

  it("bullets: add, edit, move, remove", async () => {
    await setup();
    loadExample();
    const b = S.experience[0]!.bullets;
    const bullets = () => vals(/bullet/i);
    fireEvent.click(btns(/^add bullet/i)[0]!);
    expect(bullets()).toHaveLength(6);
    expect(bullets().slice(0, 3)).toEqual(b);
    expect(bullets()[3]).toBe("");
    type(fields(/bullet/i)[3]!, "Added bullet");
    expect(bullets()[3]).toBe("Added bullet");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Move down: ${esc(b[0]!)}$`) }));
    expect(bullets().slice(0, 2)).toEqual([b[1], b[0]]);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Remove: ${esc(b[1]!)}$`) }));
    expect(bullets()).toHaveLength(5);
    expect(bullets()[0]).toBe(b[0]);
  });

  it("education: add, edit, remove", async () => {
    await setup();
    loadExample();
    click(/^add education$/i);
    expect(fields(/^school$/i)).toHaveLength(2);
    type(fields(/^school$/i)[1]!, "Second School");
    expect(vals(/^school$/i)).toEqual([S.education[0]!.school, "Second School"]);
    const e0 = S.education[0]!;
    const name = new RegExp(`(${esc(e0.school)}|${esc(e0.degree)})$`);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Move down: .*${name.source}`) }));
    expect(vals(/^school$/i)).toEqual(["Second School", e0.school]);
    fireEvent.click(screen.getByRole("button", { name: /^Remove: .*Second School/ }));
    expect(vals(/^school$/i)).toEqual([e0.school]);
  });

  it("education details: add and remove", async () => {
    await setup();
    loadExample();
    const n = fields(/detail/i).length;
    fireEvent.click(btns(/^add detail/i)[0]!);
    expect(fields(/detail/i)).toHaveLength(n + 1);
    type(fields(/detail/i)[n]!, "Extra detail");
    fireEvent.click(screen.getByRole("button", { name: /^Remove: Extra detail$/ }));
    expect(fields(/detail/i)).toHaveLength(n);
  });

  it("skill groups and items: add, edit, move, remove", async () => {
    await setup();
    loadExample();
    const [g1, g2] = S.skills;
    click(/^add skill group$/i);
    expect(fields(/group name/i)).toHaveLength(3);
    type(fields(/group name/i)[2]!, "Tools");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Move up: ${esc(g2!.name)}$`) }));
    expect(vals(/group name/i).slice(0, 2)).toEqual([g2!.name, g1!.name]);
    const items = fields(/item/i).length;
    fireEvent.click(btns(/^add item/i)[0]!);
    expect(fields(/item/i)).toHaveLength(items + 1);
    fireEvent.click(screen.getByRole("button", { name: /^Remove: Tools$/ }));
    expect(vals(/group name/i)).toEqual([g2!.name, g1!.name]);
  });

  const lists: [string, RegExp, RegExp, string[]][] = [
    ["certificates", /certificate/i, /^add certificate$/i, S.certificates],
    ["languages", /language/i, /^add language$/i, S.languages],
    ["links", /link/i, /^add link$/i, S.basics.links],
  ];
  for (const [name, label, add, initial] of lists) {
    it(`${name}: add, edit, move, remove`, async () => {
      await setup();
      loadExample();
      click(add);
      expect(fields(label)).toHaveLength(initial.length + 1);
      type(fields(label)[initial.length]!, "Zed Entry");
      expect(vals(label)).toEqual([...initial, "Zed Entry"]);
      if (initial.length > 0) {
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Move up: Zed Entry$`) }));
        expect(vals(label)).toEqual([...initial.slice(0, -1), "Zed Entry", initial[initial.length - 1]]);
      }
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Remove: Zed Entry$`) }));
      expect(vals(label)).toEqual(initial);
    });
  }
});

describe("criterion 6: live preview (en)", () => {
  it("typing a name shows it in the preview at once", async () => {
    await setup();
    type(fields(/^name$/i)[0]!, "Sam Sample");
    expect(preview().textContent).toContain("Sam Sample");
    type(fields(/^name$/i)[0]!, "Sam S");
    expect(preview().textContent).not.toContain("Sam Sample");
    expect(preview().textContent).toContain("Sam S");
  });

  it("shows sections in order and leaves out empty ones", async () => {
    await setup();
    loadExample();
    const heads = within(preview()).getAllByRole("heading");
    const wanted = ["Summary", "Experience", "Education", "Skills", "Certificates", "Languages"];
    const found = wanted.map((w) => heads.find((h) => h.textContent?.trim() === w));
    found.forEach((h, i) => expect(h, wanted[i]).toBeTruthy());
    for (let i = 1; i < found.length; i++)
      expect(found[i - 1]!.compareDocumentPosition(found[i]!) & Node.DOCUMENT_POSITION_FOLLOWING, wanted[i]).toBeTruthy();
    const nameEl = within(preview()).getByText("Alex Example");
    expect(nameEl.compareDocumentPosition(found[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("empty editor previews no section headings; summary alone shows only Summary", async () => {
    await setup();
    expect(within(preview()).queryAllByRole("heading", { name: /^(Summary|Experience|Education|Skills|Certificates|Languages)$/ })).toHaveLength(0);
    type(fields(/^summary$/i)[0]!, "Only a summary.");
    const names = within(preview()).getAllByRole("heading").map((h) => h.textContent?.trim());
    expect(names).toContain("Summary");
    for (const n of ["Experience", "Education", "Skills", "Certificates", "Languages"]) expect(names).not.toContain(n);
  });

  it("dates use formatRange in English", async () => {
    await setup();
    loadExample();
    for (const e of S.experience) expect(preview().textContent).toContain(formatRange(e.start, e.end, "en"));
    const edu = S.education[0]!;
    expect(preview().textContent).toContain(formatRange(edu.start, edu.end, "en"));
  });

  it("dates use formatRange in Chinese after switching language", async () => {
    await setup();
    loadExample();
    switchLang();
    for (const e of S.experience) expect(preview().textContent).toContain(formatRange(e.start, e.end, "zh"));
    expect(preview().textContent).not.toMatch(/Present|Mar 2021/);
  });
});

describe("criterion 7: Load example and Clear", () => {
  it("Load example fills the editor with sampleResume", async () => {
    await setup();
    loadExample();
    expect(vals(/^name$/i)).toEqual([S.basics.name]);
    expect(vals(/^phone$/i)).toEqual([S.basics.phone]);
    expect(vals(/^summary$/i)).toEqual([S.summary]);
    expect(preview().textContent).toContain("Alex Example");
  });

  it("Clear asks for confirmation; declining keeps the data, accepting empties it", async () => {
    await setup();
    loadExample();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    click(/^clear$/i);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(vals(/^name$/i)).toEqual(["Alex Example"]);
    confirm.mockReturnValue(true);
    click(/^clear$/i);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(vals(/^name$/i)).toEqual([""]);
    expect(fields(/^company$/i)).toHaveLength(0);
    expect(preview().textContent).not.toContain("Alex Example");
  });
});

describe("criterion 10: dictionaries", () => {
  it("en and zh have the same structure", async () => {
    expect(shape(zh)).toEqual(shape(en));
  });
  it("zh has no English-only editor labels (see the Chinese label test in criterion 4)", async () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });
});

describe("criterion 11: typed text is rendered as text", () => {
  it("an img tag in the summary is shown literally", async () => {
    await setup();
    const payload = "<img src=x onerror=alert(1)>";
    type(fields(/^summary$/i)[0]!, payload);
    expect(preview().textContent).toContain(payload);
    expect(document.querySelector("img")).toBeNull();
    expect(preview().querySelector("img")).toBeNull();
  });
  it("script-like text in a bullet and name stays text", async () => {
    await setup();
    loadExample();
    type(fields(/^name$/i)[0]!, "<b>Bold</b>");
    type(fields(/bullet/i)[0]!, "<script>alert(1)</script>");
    expect(preview().textContent).toContain("<b>Bold</b>");
    expect(preview().querySelector("b, script")).toBeNull();
  });
});

describe("memory only (unit part of criterion 8)", () => {
  it("editing writes nothing to localStorage, sessionStorage or cookies", async () => {
    await setup();
    loadExample();
    type(fields(/^name$/i)[0]!, "Sam Sample");
    click(/^add experience$/i);
    expect(localStorage.length).toBe(0);
    // openEditor goes through the flow, so the autosave entry may exist; the editor itself adds nothing else.
    expect(Object.keys(sessionStorage).filter((k) => k !== "jd2cv.session")).toEqual([]);
    for (let i = 0; i < sessionStorage.length; i++) {
      expect(sessionStorage.getItem(sessionStorage.key(i) as string)).not.toContain("Sam Sample");
    }
    expect(document.cookie).toBe("");
  });
});
