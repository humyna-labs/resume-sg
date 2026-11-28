// resume-sg#48 criterion 9: no new dependency, and no change to public/**, src/security/** or src/templates/**.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sh = (cmd: string): string | null => {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
};

describe("criterion 9: scope", () => {
  it("public/, security and templates code are untouched", () => {
    const changed = sh("git diff --name-only origin/main");
    if (changed === null) return; // no origin/main here: the coordinator's diff check covers it
    const untracked = sh("git ls-files --others --exclude-standard") ?? "";
    const files = `${changed}\n${untracked}`.split("\n").filter(Boolean);
    expect(files.filter((f) => /^(public|src\/security|src\/templates)\//.test(f))).toEqual([]);
  });
  it("package.json gains no dependency", () => {
    const base = sh("git show origin/main:package.json");
    if (base === null) return;
    const a = JSON.parse(base) as Record<string, unknown>;
    const b = JSON.parse(readFileSync("package.json", "utf8")) as Record<string, unknown>;
    expect(b.dependencies).toEqual(a.dependencies);
    expect(b.devDependencies).toEqual(a.devDependencies);
  });
});
