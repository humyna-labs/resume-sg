/* eslint-disable @typescript-eslint/no-non-null-assertion */
// resume-sg#6 criteria 1, 2 and 3: model, sample, pure edit helpers, date formatting.
import { describe, expect, it } from "vitest";
import { emptyResume } from "../../src/resume/model.ts";
import type { Resume } from "../../src/resume/model.ts";
import { sampleResume } from "../../src/resume/sample.ts";
import { formatDate, formatRange } from "../../src/resume/dates.ts";
import * as edit from "../../src/resume/edit.ts";

type Dir = "up" | "down";
const E = edit as unknown as Record<string, (...a: unknown[]) => Resume>;

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}
const frozenSample = () => deepFreeze(sampleResume());
const ids = (l: { id: string }[]) => l.map((x) => x.id);

describe("criterion 1: emptyResume and sampleResume", () => {
  it("emptyResume has empty strings and empty lists", () => {
    const r = emptyResume();
    expect(r.basics).toEqual({ name: "", headline: "", email: "", phone: "", location: "", links: [] });
    expect(r.summary).toBe("");
    for (const k of ["experience", "education", "certificates", "skills", "languages"] as const) expect(r[k]).toEqual([]);
  });
  it("emptyResume returns a fresh object each call", () => {
    const a = emptyResume();
    a.experience.push({ id: "x", company: "", title: "", location: "", start: "", end: "", bullets: [] });
    expect(emptyResume().experience).toEqual([]);
  });
  it("sampleResume is Alex Example as described", () => {
    const r = sampleResume();
    expect(r.basics.name).toBe("Alex Example");
    expect(r.basics.email).toBe("alex@example.com");
    expect(r.basics.phone).toBe("+65 9000 0000");
    expect(r.basics.location).toMatch(/Singapore/);
    expect(r.experience).toHaveLength(2);
    expect(r.experience.map((e) => e.bullets.length)).toEqual([3, 2]);
    expect(r.education).toHaveLength(1);
    expect(r.certificates).toHaveLength(1);
    expect(r.skills).toHaveLength(2);
    expect(r.languages).toHaveLength(2);
    expect(r.summary.length).toBeGreaterThan(0);
    expect(ids(r.experience)).toEqual(["exp-1", "exp-2"]);
    expect(ids(r.education)).toEqual(["edu-1"]);
    expect(ids(r.skills)).toEqual(["skill-1", "skill-2"]);
  });
});

describe("criterion 3: formatDate and formatRange", () => {
  it("formats en", () => {
    expect(formatDate("2021-03", "en")).toBe("Mar 2021");
    expect(formatDate("2015", "en")).toBe("2015");
    expect(formatRange("2021-03", "", "en")).toBe("Mar 2021 – Present");
    expect(formatRange("2019-01", "2021-02", "en")).toBe("Jan 2019 – Feb 2021");
  });
  it("formats zh", () => {
    expect(formatDate("2021-03", "zh")).toBe("2021.03");
    expect(formatDate("2015", "zh")).toBe("2015");
    expect(formatRange("2021-03", "", "zh")).toBe("2021.03 – 至今");
  });
  it("returns invalid input unchanged", () => {
    expect(formatDate("13/2021", "en")).toBe("13/2021");
    expect(formatDate("13/2021", "zh")).toBe("13/2021");
  });
});

// Naming contract for the edit module (the issue leaves names open; these tests fix them):
//   add<X>(r) appends an empty entry with a new unique id (or "" for string lists);
//   update<X>(r, id|index, ...), move<X>(r, id|index, "up"|"down"), remove<X>(r, id|index).
// X in Experience, Education, SkillGroup (by id); Link, Certificate, Language (by index);
// Bullet (r, expId, index), Detail (r, eduId, index), SkillItem (r, groupId, index).
// updateExperience/Education/SkillGroup take (r, id, patch); updateBasics(r, patch); updateSummary(r, text).
describe("criterion 2: edit helpers are pure and keep ids stable", () => {
  it("exports every helper", () => {
    for (const x of ["Experience", "Education", "SkillGroup", "Link", "Certificate", "Language", "Bullet", "Detail", "SkillItem"])
      for (const p of ["add", "update", "move", "remove"]) expect(typeof E[p + x], p + x).toBe("function");
    expect(typeof E.updateBasics).toBe("function");
    expect(typeof E.updateSummary).toBe("function");
  });

  it("updateBasics and updateSummary", () => {
    const r = frozenSample();
    const b = E.updateBasics!(r, { name: "Sam Sample" });
    expect(b).not.toBe(r);
    expect(b.basics.name).toBe("Sam Sample");
    expect(b.basics.email).toBe("alex@example.com");
    expect(r.basics.name).toBe("Alex Example");
    expect(E.updateSummary!(r, "Hi").summary).toBe("Hi");
  });

  const byId = [
    ["Experience", "experience", "exp", { company: "Changed Pte Ltd" }, "company"],
    ["Education", "education", "edu", { school: "Changed University" }, "school"],
    ["SkillGroup", "skills", "skill", { name: "Changed" }, "name"],
  ] as const;
  for (const [X, key, prefix, patch, field] of byId) {
    describe(X, () => {
      it("add appends an empty entry with a new unique id", () => {
        const r = frozenSample();
        const n = E["add" + X]!(r);
        expect(n).not.toBe(r);
        expect(n[key]).toHaveLength(r[key].length + 1);
        expect(new Set(ids(n[key])).size).toBe(n[key].length);
        expect(ids(n[key]).slice(0, r[key].length)).toEqual(ids(r[key]));
        const last = n[key][n[key].length - 1] as unknown as Record<string, unknown>;
        expect(last[field]).toBe("");
      });
      it("add after remove never reuses an id of a remaining entry", () => {
        let r = frozenSample();
        r = E["remove" + X]!(r, `${prefix}-1`);
        const n = E["add" + X]!(r);
        expect(new Set(ids(n[key])).size).toBe(n[key].length);
      });
      it("update changes only the target and keeps ids", () => {
        const r = frozenSample();
        const n = E["update" + X]!(r, `${prefix}-1`, patch);
        expect(n).not.toBe(r);
        expect((n[key][0] as unknown as Record<string, unknown>)[field]).toBe((patch as Record<string, string>)[field]);
        expect(ids(n[key])).toEqual(ids(r[key]));
        expect(n[key].slice(1)).toEqual(r[key].slice(1));
      });
      it("remove removes only that entry", () => {
        const r = frozenSample();
        const n = E["remove" + X]!(r, `${prefix}-1`);
        expect(ids(n[key])).toEqual(ids(r[key]).filter((i) => i !== `${prefix}-1`));
        expect(n).not.toBe(r);
      });
      it("move up/down reorders, keeps ids, and edge moves are no-ops", () => {
        const r = frozenSample();
        const before = ids(r[key]);
        if (before.length >= 2) {
          const up = E["move" + X]!(r, `${prefix}-2`, "up" as Dir);
          expect(ids(up[key])).toEqual([`${prefix}-2`, `${prefix}-1`]);
          expect(up).not.toBe(r);
          const down = E["move" + X]!(r, `${prefix}-1`, "down" as Dir);
          expect(ids(down[key])).toEqual([`${prefix}-2`, `${prefix}-1`]);
          expect(ids(E["move" + X]!(r, `${prefix}-2`, "down" as Dir)[key])).toEqual(before);
        }
        expect(ids(E["move" + X]!(r, `${prefix}-1`, "up" as Dir)[key])).toEqual(before);
        expect(ids(r[key])).toEqual(before);
      });
    });
  }

  const lists = [
    ["Link", (r: Resume) => r.basics.links],
    ["Certificate", (r: Resume) => r.certificates],
    ["Language", (r: Resume) => r.languages],
  ] as const;
  for (const [X, get] of lists) {
    describe(X, () => {
      const base = () => {
        let r = deepFreeze(emptyResume());
        r = E["add" + X]!(r);
        r = E["update" + X]!(r, 0, "one");
        r = E["add" + X]!(r);
        r = E["update" + X]!(r, 1, "two");
        return deepFreeze(r);
      };
      it("add, update, move, remove", () => {
        const r = base();
        expect(get(r)).toEqual(["one", "two"]);
        expect(get(E["move" + X]!(r, 1, "up" as Dir))).toEqual(["two", "one"]);
        expect(get(E["move" + X]!(r, 0, "down" as Dir))).toEqual(["two", "one"]);
        expect(get(E["move" + X]!(r, 0, "up" as Dir))).toEqual(["one", "two"]);
        expect(get(E["move" + X]!(r, 1, "down" as Dir))).toEqual(["one", "two"]);
        expect(get(E["remove" + X]!(r, 0))).toEqual(["two"]);
        expect(get(r)).toEqual(["one", "two"]);
        expect(E["remove" + X]!(r, 0)).not.toBe(r);
      });
    });
  }

  const nested = [
    ["Bullet", "exp-1", (r: Resume) => r.experience[0]!.bullets, (r: Resume) => r.experience.map((e) => e.bullets.length)],
    ["Detail", "edu-1", (r: Resume) => r.education[0]!.details, (r: Resume) => r.education.map((e) => e.details.length)],
    ["SkillItem", "skill-1", (r: Resume) => r.skills[0]!.items, (r: Resume) => r.skills.map((e) => e.items.length)],
  ] as const;
  for (const [X, id, get, counts] of nested) {
    describe(X, () => {
      it("add, update, move, remove act on one entry only", () => {
        const r = frozenSample();
        const n0 = get(r).length;
        const a = E["add" + X]!(r, id);
        expect(get(a)).toHaveLength(n0 + 1);
        expect(get(a)[n0]).toBe("");
        expect(a).not.toBe(r);
        const u = E["update" + X]!(r, id, 0, "Edited");
        expect(get(u)[0]).toBe("Edited");
        expect(get(u).slice(1)).toEqual(get(r).slice(1));
        const first = get(r)[0];
        const second = get(r)[1];
        if (second !== undefined) {
          expect(get(E["move" + X]!(r, id, 1, "up" as Dir)).slice(0, 2)).toEqual([second, first]);
          expect(get(E["move" + X]!(r, id, 0, "down" as Dir)).slice(0, 2)).toEqual([second, first]);
        }
        expect(get(E["move" + X]!(r, id, 0, "up" as Dir))).toEqual(get(r));
        const d = E["remove" + X]!(r, id, 0);
        expect(get(d)).toEqual(get(r).slice(1));
        expect(counts(d).slice(1)).toEqual(counts(r).slice(1));
        expect(ids(d.experience)).toEqual(ids(r.experience));
        expect(get(r)).toHaveLength(n0);
      });
    });
  }
});
