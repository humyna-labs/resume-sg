// resume-sg#14 criteria 1-5: personalInfoFindings(resume) rules, synthetic strings only.
// Contract: the checks module (src/checks/personalInfo.ts) exports personalInfoFindings(resume: Resume)
//   => { id: "photo"|"age"|"id-number"|"marital"|"religion"; where: string; match: string }[]
import { describe, expect, it } from "vitest";
import { personalInfoFindings } from "../../src/checks/personalInfo.ts";
import { emptyResume } from "../../src/resume/model.ts";
import type { Resume } from "../../src/resume/model.ts";

type Id = "photo" | "age" | "id-number" | "marital" | "religion";
const withSummary = (s: string): Resume => ({ ...emptyResume(), summary: s });
const ids = (s: string) => personalInfoFindings(withSummary(s)).map((f) => f.id);

function rule(id: Id, positives: string[], negatives: string[]) {
  describe(`rule ${id}`, () => {
    for (const p of positives)
      it(`flags ${JSON.stringify(p)}`, () => {
        const found = personalInfoFindings(withSummary(`Intro. ${p} Outro.`)).filter((f) => f.id === id);
        expect(found.length).toBeGreaterThan(0);
        expect(typeof found[0]?.where).toBe("string");
        expect(found[0]?.where).not.toBe("");
        expect(found[0]?.match).not.toBe("");
        expect(p.toLowerCase()).toContain((found[0]?.match ?? "").toLowerCase());
      });
    for (const n of negatives)
      it(`does not flag ${JSON.stringify(n)}`, () => {
        expect(ids(`Intro. ${n} Outro.`)).not.toContain(id);
      });
  });
}

describe("criterion 1: photo", () => {
  rule("photo", ["Photo: attached", "photograph attached", "照片"], ["photography club", "Photoshop", "Adobe Photoshop expert"]);
});
describe("criterion 2: age", () => {
  rule(
    "age",
    ["Age: 32", "age 32", "32 years old", "Date of birth", "DOB", "dob: 1 Jan", "born 1990", "出生日期", "年龄", "1990年5月出生"],
    ["agency", "page 2", "Stage: 3", "image", "DOBBY"],
  );
});
describe("criterion 3: id-number", () => {
  rule(
    "id-number",
    ["S0000000Z", "t0000000a", "F0000000B", "G0000000C", "M0000000D", "110101199001010000", "11010119900101000X", "NRIC", "FIN No", "身份证", "passport no", "护照号"],
    ["S$1,000", "T-shirt", "+65 9000 0000", "#12345678", "FINANCE", "Order 12345678"],
  );
});
describe("criterion 4: marital", () => {
  rule(
    "marital",
    ["marital status", "I am married", "Married", "Status: single", "已婚", "未婚", "婚姻状况"],
    ["remarried", "single sign-on", "single-page app"],
  );
});
describe("criterion 5: religion", () => {
  rule("religion", ["religion", "RELIGION: none", "宗教", "宗教信仰"], ["religiously tested", "irreligious"]);
});

describe("scans every text field", () => {
  const T = "Religion: none";
  const cases: [string, (r: Resume) => void][] = [
    ["summary", (r) => (r.summary = T)],
    ["basics.name", (r) => (r.basics.name = T)],
    ["basics.headline", (r) => (r.basics.headline = T)],
    ["basics.location", (r) => (r.basics.location = T)],
    ["basics.links", (r) => (r.basics.links = [T])],
    ["experience bullet", (r) => (r.experience = [{ id: "e1", company: "Acme", title: "Dev", location: "", start: "", end: "", bullets: [T] }])],
    ["education detail", (r) => (r.education = [{ id: "d1", school: "Uni", degree: "BSc", start: "", end: "", details: [T] }])],
    ["skill item", (r) => (r.skills = [{ id: "s1", name: "Tools", items: [T] }])],
    ["skill group name", (r) => (r.skills = [{ id: "s1", name: T, items: [] }])],
    ["certificate", (r) => (r.certificates = [T])],
    ["language", (r) => (r.languages = [T])],
  ];
  for (const [name, set] of cases)
    it(name, () => {
      const r = emptyResume();
      set(r);
      expect(personalInfoFindings(r).map((f) => f.id)).toContain("religion");
    });

  it("an empty resume has no findings", () => {
    expect(personalInfoFindings(emptyResume())).toEqual([]);
  });
  it("reports the field it was found in", () => {
    const a = personalInfoFindings({ ...emptyResume(), summary: "Age: 32" });
    const b = personalInfoFindings({ ...emptyResume(), languages: ["Age: 32"] });
    expect(a[0]?.where).toBeTruthy();
    expect(a[0]?.where).not.toBe(b[0]?.where);
  });
});
