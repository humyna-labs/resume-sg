/* eslint-disable @typescript-eslint/no-non-null-assertion */
// resume-sg#29 criteria 1 and 2 (unit): model, emptyResume/sampleResume, order, edit helpers, dictionaries, route.
//
// Naming contract (the issue leaves names open; these tests fix them):
//   src/resume/model.ts: Resume gains projects: Project[], extras: Extra[], order: SectionId[].
//     SectionId = "summary" | "experience" | "projects" | "education" | "skills" | "certificates" | "extras" | "languages".
//   src/resume/order.ts: defaultOrder(mode, yearsOfWork): SectionId[]; validateOrder(order, mode, yearsOfWork): boolean.
//     mode = "balanced" | "results-first" | "career-change".
//   src/resume/edit.ts: addProject(r), updateProject(r, id, patch), moveProject(r, id, dir), removeProject(r, id),
//     addProjectBullet(r, projectId), updateProjectBullet(r, projectId, i, text), removeProjectBullet(r, projectId, i);
//     addExtra(r), updateExtra(r, id, patch), moveExtra(r, id, dir), removeExtra(r, id),
//     addExtraItem(r, extraId), updateExtraItem(r, extraId, i, text), removeExtraItem(r, extraId, i).
//   src/templates/heavySample.ts: heavySample(lang) returns exactly tests/fixtures/heavy-sample.ts.
import { describe, expect, it } from "vitest";
import { parseRoute } from "../../src/app/route.ts";
import * as enMod from "../../src/i18n/en.ts";
import * as zhMod from "../../src/i18n/zh.ts";
import { emptyResume } from "../../src/resume/model.ts";
import type { Resume } from "../../src/resume/model.ts";
import * as orderMod from "../../src/resume/order.ts";
import { sampleResume } from "../../src/resume/sample.ts";
import * as edit from "../../src/resume/edit.ts";
import { heavySample } from "../../src/templates/heavySample.ts";
import { DEFAULT_ORDER, HEAVY } from "../fixtures/heavy-sample.ts";
import { leafValues, shape } from "./dict-helpers.ts";

type Dir = "up" | "down";
const E = edit as unknown as Record<string, (...a: unknown[]) => Resume>;
const pick = (m: Record<string, unknown>, name: string) => (m.default ?? m[name]) as Record<string, unknown>;
const en = pick(enMod, "en");
const zh = pick(zhMod, "zh");
const defaultOrder = orderMod.defaultOrder as unknown as (mode: string, years: number) => string[];
const validateOrder = orderMod.validateOrder as unknown as (order: string[], mode: string, years: number) => boolean;

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}
const frozenHeavy = () => deepFreeze(structuredClone(HEAVY.en));
const ids = (l: { id: string }[]) => l.map((x) => x.id);

describe("criterion 1: model defaults", () => {
  it("emptyResume has empty projects and extras and the default order", () => {
    const r = emptyResume();
    expect(r.projects).toEqual([]);
    expect(r.extras).toEqual([]);
    expect(r.order).toEqual([...DEFAULT_ORDER]);
    for (const k of ["experience", "education", "certificates", "skills", "languages"] as const) expect(r[k]).toEqual([]);
  });

  it("emptyResume returns fresh lists each call", () => {
    const a = emptyResume();
    a.projects.push({ id: "x", name: "", role: "", org: "", start: "", end: "", tech: [], bullets: [] });
    a.extras.push({ id: "y", heading: "", items: [] });
    a.order.reverse();
    const b = emptyResume();
    expect(b.projects).toEqual([]);
    expect(b.extras).toEqual([]);
    expect(b.order).toEqual([...DEFAULT_ORDER]);
  });

  it("sampleResume has empty projects and extras and the default order; old fields keep their values", () => {
    const r = sampleResume();
    expect(r.projects).toEqual([]);
    expect(r.extras).toEqual([]);
    expect(r.order).toEqual([...DEFAULT_ORDER]);
    expect(r.basics.name).toBe("Alex Example");
    expect(r.experience).toHaveLength(2);
    expect(r.education[0]!.details).toHaveLength(2);
  });
});

describe("criterion 2: defaultOrder and validateOrder", () => {
  const BALANCED = ["summary", "experience", "projects", "education", "skills", "certificates", "extras", "languages"];
  const CAREER = ["summary", "skills", "projects", "experience", "education", "certificates", "extras", "languages"];

  it("Balanced and Results-first share one order", () => {
    expect(defaultOrder("balanced", 5)).toEqual(BALANCED);
    expect(defaultOrder("results-first", 5)).toEqual(BALANCED);
  });
  it("Career change puts Skills and Projects before Experience", () => {
    expect(defaultOrder("career-change", 5)).toEqual(CAREER);
  });
  it("fewer than 2 years of work puts Education right after Summary, otherwise unchanged", () => {
    for (const mode of ["balanced", "results-first", "career-change"]) {
      const base = defaultOrder(mode, 5);
      for (const years of [0, 1, 1.5]) {
        const o = defaultOrder(mode, years);
        expect(o[0], `${mode} ${years}`).toBe("summary");
        expect(o[1], `${mode} ${years}`).toBe("education");
        expect(o.filter((s) => s !== "education"), `${mode} ${years}`).toEqual(base.filter((s) => s !== "education"));
      }
      expect(defaultOrder(mode, 2)).toEqual(base);
    }
  });
  it("validateOrder accepts the default order of the same mode and years", () => {
    for (const mode of ["balanced", "results-first", "career-change"])
      for (const years of [0, 1, 2, 9]) expect(validateOrder(defaultOrder(mode, years), mode, years), `${mode} ${years}`).toBe(true);
  });
  it("validateOrder rejects other orders, duplicates, missing and unknown sections", () => {
    expect(validateOrder(CAREER, "balanced", 5)).toBe(false);
    expect(validateOrder(BALANCED, "career-change", 5)).toBe(false);
    expect(validateOrder([...BALANCED].reverse(), "balanced", 5)).toBe(false);
    expect(validateOrder(BALANCED.slice(0, -1), "balanced", 5)).toBe(false);
    expect(validateOrder([...BALANCED, "languages"], "balanced", 5)).toBe(false);
    expect(validateOrder([...BALANCED.slice(0, -1), "hobbies"], "balanced", 5)).toBe(false);
    expect(validateOrder([], "balanced", 5)).toBe(false);
  });
});

describe("criterion 1: the heavy fixture and the sample used by the route", () => {
  it("heavySample returns exactly the fixture for en and zh", () => {
    expect(heavySample("en")).toEqual(HEAVY.en);
    expect(heavySample("zh")).toEqual(HEAVY.zh);
  });
  it("the fixture is heavy enough (criterion 7)", () => {
    for (const lang of ["en", "zh"] as const) {
      const r = HEAVY[lang];
      const companies = new Set(r.experience.map((e) => e.company));
      expect(companies.size).toBeGreaterThanOrEqual(4);
      const perCompany = r.experience.reduce<Record<string, number>>((m, e) => ({ ...m, [e.company]: (m[e.company] ?? 0) + 1 }), {});
      expect(Math.max(...Object.values(perCompany))).toBeGreaterThanOrEqual(3);
      expect(r.projects.filter((p) => p.experienceId).length).toBeGreaterThanOrEqual(1);
      expect(r.projects.filter((p) => !p.experienceId).length).toBeGreaterThanOrEqual(3);
      expect(r.education.length).toBeGreaterThanOrEqual(2);
      expect(r.education.every((e) => e.details.length > 0)).toBe(true);
      expect(r.extras.length).toBeGreaterThanOrEqual(4);
    }
  });
  it("#/sections is a route", () => {
    expect(parseRoute("#/sections")).not.toBe("home");
  });
});

// ---- edit helpers ----
describe("criterion 1: project helpers are pure and keep ids stable", () => {
  it("exports every helper", () => {
    for (const n of ["addProject", "updateProject", "moveProject", "removeProject", "addProjectBullet", "updateProjectBullet", "removeProjectBullet",
      "addExtra", "updateExtra", "moveExtra", "removeExtra", "addExtraItem", "updateExtraItem", "removeExtraItem"])
      expect(typeof E[n], n).toBe("function");
  });

  it("addProject appends an empty standalone project with a new unique id", () => {
    const r = frozenHeavy();
    const n = E.addProject!(r);
    expect(n).not.toBe(r);
    expect(n.projects).toHaveLength(r.projects.length + 1);
    expect(new Set(ids(n.projects)).size).toBe(n.projects.length);
    expect(ids(n.projects).slice(0, r.projects.length)).toEqual(ids(r.projects));
    const p = n.projects[n.projects.length - 1]!;
    expect(p).toMatchObject({ name: "", role: "", org: "", start: "", end: "", tech: [], bullets: [] });
    expect(p.experienceId ?? "").toBe("");
  });
  it("add after remove never reuses an id", () => {
    const r = E.removeProject!(frozenHeavy(), "proj-1");
    const n = E.addProject!(r);
    expect(new Set(ids(n.projects)).size).toBe(n.projects.length);
  });
  it("updateProject changes only the target; experienceId can be set and cleared", () => {
    const r = frozenHeavy();
    const n = E.updateProject!(r, "proj-2", { name: "Changed", experienceId: "exp-4" });
    expect(n.projects.find((p) => p.id === "proj-2")).toMatchObject({ name: "Changed", experienceId: "exp-4" });
    expect(n.projects.filter((p) => p.id !== "proj-2")).toEqual(r.projects.filter((p) => p.id !== "proj-2"));
    expect(ids(n.projects)).toEqual(ids(r.projects));
    const back = E.updateProject!(n, "proj-2", { experienceId: undefined });
    expect(back.projects.find((p) => p.id === "proj-2")!.experienceId ?? "").toBe("");
  });
  it("moveProject reorders; edge moves are no-ops", () => {
    const r = frozenHeavy();
    const before = ids(r.projects);
    expect(ids(E.moveProject!(r, "proj-3", "up" as Dir).projects)).toEqual(["proj-1", "proj-3", "proj-2", "proj-4"]);
    expect(ids(E.moveProject!(r, "proj-2", "down" as Dir).projects)).toEqual(["proj-1", "proj-3", "proj-2", "proj-4"]);
    expect(ids(E.moveProject!(r, "proj-1", "up" as Dir).projects)).toEqual(before);
    expect(ids(E.moveProject!(r, "proj-4", "down" as Dir).projects)).toEqual(before);
  });
  it("removeProject removes only that project", () => {
    const r = frozenHeavy();
    expect(ids(E.removeProject!(r, "proj-2").projects)).toEqual(["proj-1", "proj-3", "proj-4"]);
  });
  it("project bullets: add, update, remove act on one project only", () => {
    const r = frozenHeavy();
    const n0 = r.projects[1]!.bullets.length;
    const a = E.addProjectBullet!(r, "proj-2");
    expect(a.projects[1]!.bullets).toHaveLength(n0 + 1);
    expect(a.projects[1]!.bullets[n0]).toBe("");
    expect(a.projects[0]).toEqual(r.projects[0]);
    expect(E.updateProjectBullet!(r, "proj-2", 0, "Edited").projects[1]!.bullets[0]).toBe("Edited");
    expect(E.removeProjectBullet!(r, "proj-2", 0).projects[1]!.bullets).toEqual(r.projects[1]!.bullets.slice(1));
  });
});

describe("criterion 1: extras helpers are pure and keep ids stable", () => {
  it("addExtra appends an empty extra with a new unique id", () => {
    const r = frozenHeavy();
    const n = E.addExtra!(r);
    expect(n.extras).toHaveLength(r.extras.length + 1);
    expect(new Set(ids(n.extras)).size).toBe(n.extras.length);
    expect(n.extras[n.extras.length - 1]).toMatchObject({ heading: "", items: [] });
    expect(n).not.toBe(r);
  });
  it("updateExtra, moveExtra, removeExtra", () => {
    const r = frozenHeavy();
    expect(E.updateExtra!(r, "extra-2", { heading: "Patents" }).extras[1]!.heading).toBe("Patents");
    expect(ids(E.moveExtra!(r, "extra-2", "up" as Dir).extras)).toEqual(["extra-2", "extra-1", "extra-3", "extra-4"]);
    expect(ids(E.moveExtra!(r, "extra-1", "down" as Dir).extras)).toEqual(["extra-2", "extra-1", "extra-3", "extra-4"]);
    expect(ids(E.moveExtra!(r, "extra-1", "up" as Dir).extras)).toEqual(ids(r.extras));
    expect(ids(E.removeExtra!(r, "extra-3").extras)).toEqual(["extra-1", "extra-2", "extra-4"]);
  });
  it("extra items: add, update, remove", () => {
    const r = frozenHeavy();
    const a = E.addExtraItem!(r, "extra-1");
    expect(a.extras[0]!.items).toEqual([...r.extras[0]!.items, ""]);
    expect(E.updateExtraItem!(r, "extra-1", 0, "Edited").extras[0]!.items[0]).toBe("Edited");
    expect(E.removeExtraItem!(r, "extra-1", 0).extras[0]!.items).toEqual(r.extras[0]!.items.slice(1));
    expect(E.removeExtraItem!(r, "extra-1", 0).extras[1]).toEqual(r.extras[1]);
  });
});

describe("criterion 9: dictionaries", () => {
  it("en and zh keep the same shape and hold the new section names and buttons", () => {
    expect(shape(en)).toEqual(shape(zh));
    const enVals = leafValues(en).map((v) => v.trim());
    const zhVals = leafValues(zh).map((v) => v.trim());
    for (const v of ["Add project", "Add extra section"]) expect(enVals).toContain(v);
    expect(zhVals.some((v) => /项目/.test(v))).toBe(true);
  });
});
