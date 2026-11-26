/* eslint-disable @typescript-eslint/no-non-null-assertion */
// resume-sg#29 criterion 1 (editor part): the base-resume editor on #/app edits projects, extras and education details.
// Contract (English labels, same style as base-resume-editor.test.tsx):
//   buttons "Add project", "Add extra section", "Add tech item", "Add extra item", "Add bullet" (also inside a project),
//   "Move up: <name>" / "Move down: <name>" / "Remove: <name>" for projects (name) and extras (heading);
//   fields "Project name", "Project role", "Organisation", "Under role" (a <select>: first option = none, then one per
//   experience entry, value = the experience id), "Tech item", "Section heading", "Extra item".
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import zhDict from "../../src/i18n/zh.ts";
import { leafValues } from "./dict-helpers.ts";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function setup() {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");
  window.location.hash = "#/app";
  return render(<App />);
}
const editor = () => screen.getByTestId("resume-editor");
const preview = () => screen.getByTestId("resume-preview");
const btn = (name: RegExp) => within(editor()).getByRole("button", { name });
const click = (name: RegExp) => fireEvent.click(btn(name));
const fields = (label: RegExp) =>
  within(editor()).queryAllByLabelText(label).filter((e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)) as HTMLInputElement[];
const vals = (label: RegExp) => fields(label).map((f) => f.value);
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const loadExample = () => click(/^load example$/i);
const remove = (text: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Remove: ${esc(text)}$`) }));

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("criterion 1: projects in the editor", () => {
  it("add, edit, reorder and remove projects", () => {
    setup();
    click(/^add project$/i);
    click(/^add project$/i);
    expect(fields(/^project name$/i)).toHaveLength(2);
    expect(fields(/^project role$/i)).toHaveLength(2);
    expect(fields(/^organi[sz]ation$/i)).toHaveLength(2);
    type(fields(/^project name$/i)[0]!, "Alpha");
    type(fields(/^project name$/i)[1]!, "Beta");
    type(fields(/^project role$/i)[0]!, "Lead");
    expect(vals(/^project role$/i)).toEqual(["Lead", ""]);
    fireEvent.click(screen.getByRole("button", { name: /^Move up: Beta$/ }));
    expect(vals(/^project name$/i)).toEqual(["Beta", "Alpha"]);
    fireEvent.click(screen.getByRole("button", { name: /^Move down: Beta$/ }));
    expect(vals(/^project name$/i)).toEqual(["Alpha", "Beta"]);
    remove("Alpha");
    expect(vals(/^project name$/i)).toEqual(["Beta"]);
  });

  it("project bullets and tech items: add, edit, remove", () => {
    setup();
    click(/^add project$/i);
    type(fields(/^project name$/i)[0]!, "Alpha");
    click(/^add bullet/i);
    type(fields(/bullet/i)[0]!, "Shipped it");
    expect(vals(/bullet/i)).toEqual(["Shipped it"]);
    click(/^add tech item$/i);
    type(fields(/^tech item$/i)[0]!, "Java");
    expect(vals(/^tech item$/i)).toEqual(["Java"]);
    remove("Shipped it");
    expect(fields(/bullet/i)).toHaveLength(0);
    remove("Java");
    expect(fields(/^tech item$/i)).toHaveLength(0);
  });

  it("'Under role' offers none plus every experience entry and moves the project into the role in the preview", () => {
    setup();
    loadExample();
    click(/^add project$/i);
    type(fields(/^project name$/i)[0]!, "Dashboard rebuild");
    const select = fields(/^under role$/i)[0] as unknown as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    const options = Array.from(select.options);
    expect(options).toHaveLength(3);
    expect(options[0]!.value).toBe("");
    expect(options.map((o) => o.value).slice(1)).toEqual(["exp-1", "exp-2"]);
    expect(options[1]!.textContent).toContain("Senior Operations Analyst");
    expect(select.value).toBe("");
    expect(preview().querySelector('[data-section="projects"]')?.textContent).toContain("Dashboard rebuild");
    expect(preview().querySelector("[data-nest]")).toBeNull();

    type(select, "exp-1");
    expect(preview().querySelector("[data-nest]")?.textContent).toContain("Dashboard rebuild");
    expect(preview().querySelector('[data-section="projects"]')).toBeNull();
    type(select, "");
    expect(preview().querySelector("[data-nest]")).toBeNull();
  });

  it("projects show in the preview under a Projects heading", () => {
    setup();
    click(/^add project$/i);
    type(fields(/^project name$/i)[0]!, "Alpha");
    const heads = within(preview()).getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.trim());
    expect(heads).toContain("Projects");
  });
});

describe("criterion 1: extras and education details in the editor", () => {
  it("add, edit, reorder and remove extras and their items", () => {
    setup();
    click(/^add extra section$/i);
    click(/^add extra section$/i);
    expect(fields(/^section heading$/i)).toHaveLength(2);
    type(fields(/^section heading$/i)[0]!, "Awards");
    type(fields(/^section heading$/i)[1]!, "Patents");
    click(/^add extra item$/i);
    expect(fields(/^extra item$/i).length).toBeGreaterThanOrEqual(1);
    type(fields(/^extra item$/i)[0]!, "Best paper");
    expect(preview().textContent).toContain("Awards");
    expect(preview().textContent).toContain("Best paper");
    fireEvent.click(screen.getByRole("button", { name: /^Move up: Patents$/ }));
    expect(vals(/^section heading$/i)).toEqual(["Patents", "Awards"]);
    remove("Best paper");
    remove("Patents");
    expect(vals(/^section heading$/i)).toEqual(["Awards"]);
  });

  it("education details can be added, edited and removed (and show in the preview)", () => {
    setup();
    loadExample();
    const n = fields(/detail/i).length;
    fireEvent.click(within(editor()).getAllByRole("button", { name: /^add detail/i })[0]!);
    type(fields(/detail/i)[n]!, "Thesis prize");
    expect(preview().textContent).toContain("Thesis prize");
    remove("Thesis prize");
    expect(fields(/detail/i)).toHaveLength(n);
  });

  it("every input in the editor still has a visible label with projects and extras present", () => {
    setup();
    loadExample();
    click(/^add project$/i);
    click(/^add extra section$/i);
    click(/^add extra item$/i);
    click(/^add tech item$/i);
    const controls = Array.from(editor().querySelectorAll<HTMLInputElement>("input, textarea, select")).filter((e) => e.type !== "hidden");
    for (const el of controls) {
      const text = Array.from(el.labels ?? []).map((l) => l.textContent?.trim() ?? "").join("");
      expect(text, el.outerHTML.slice(0, 80)).not.toBe("");
    }
  });

  it("the Chinese dictionary has the new labels", () => {
    const zh = leafValues(zhDict as unknown as Record<string, unknown>);
    expect(zh.some((v) => /项目/.test(v))).toBe(true);
    expect(zh.some((v) => /^(添加|新增).*项目/.test(v.trim()))).toBe(true);
  });
});
