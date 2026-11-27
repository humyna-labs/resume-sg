import type { ReactElement } from "react";
import { formatRange } from "../resume/dates.ts";
import { DEFAULT_ORDER } from "../resume/model.ts";
import type { Experience, Project, Resume, SectionId } from "../resume/model.ts";
import { SECTION_NAMES, educationIsEmpty, experienceIsEmpty, filled, groupLabel, joinItems, joinLanguages, projectIsEmpty } from "./common.ts";
import type { TemplateLang } from "./common.ts";

export type Variant = "classic" | "modern";

/** A wrapper element shared by consecutive units (section, company group, nested project, bullet list). */
export interface Wrap {
  key: string;
  tag: "section" | "div" | "ul";
  props: Record<string, string>;
}

/** One block of the resume that is measured and placed on a page as a whole. */
export interface Unit {
  node: ReactElement;
  /** Stays on the same page as the next unit. */
  keep: boolean;
  /** An entry line (company, role, project, education); loses `keep` at the end of its section. */
  line: boolean;
  wrap: Wrap[];
}

const dates = (a: string, b: string, lang: TemplateLang): ReactElement | null => {
  const d = formatRange(a.trim(), b.trim(), lang);
  return d === "" ? null : (
    <span className="date" data-part="dates">
      {d}
    </span>
  );
};

/** Flat list of units in reading order. Empty sections and empty fields produce nothing. */
export function buildUnits(resume: Resume, lang: TemplateLang, variant: Variant): Unit[] {
  const names = SECTION_NAMES[lang];
  const units: Unit[] = [];
  let lists = 0;

  const add = (node: ReactElement, wrap: Wrap[], keep: boolean, line = false) => units.push({ node, keep, line, wrap });
  const bullets = (items: readonly string[], wrap: Wrap[]) => {
    const list = filled(items);
    const ul: Wrap = { key: `ul-${lists++}`, tag: "ul", props: {} };
    list.forEach((text, i) => {
      add(
        <li className="u bul" data-bullet="">
          {text}
        </li>,
        [...wrap, ul],
        list.length > 1 && i === list.length - 2,
      );
    });
  };
  /** Runs `body`; when it produced units, puts the heading in front of them. */
  const section = (id: string, dataName: string, heading: string, body: (sec: Wrap) => void) => {
    const sec: Wrap = { key: `sec-${id}`, tag: "section", props: { "data-section": dataName } };
    const mark = units.length;
    body(sec);
    if (units.length === mark) return;
    if (heading.trim() === "") return;
    units.splice(
      mark,
      0,
      {
        node: (
          <div className="u u-h">
            <h2 className="sec-h">{heading}</h2>
          </div>
        ),
        keep: true,
        line: false,
        wrap: [sec],
      },
    );
  };

  const experienceIds = new Set(resume.experience.filter((e) => !experienceIsEmpty(e)).map((e) => e.id));
  const nestedIn = (id: string): Project[] => resume.projects.filter((p) => !projectIsEmpty(p) && p.experienceId === id);
  const isNested = (p: Project): boolean => p.experienceId !== undefined && p.experienceId !== "" && experienceIds.has(p.experienceId);
  const loose = resume.projects.filter((p) => !projectIsEmpty(p) && !isNested(p));

  const builders: Record<Exclude<SectionId, "extras">, () => void> = {
    summary: () =>
      section("summary", "summary", names.summary, (sec) => {
        if (resume.summary.trim() !== "") add(<p className="u u-p">{resume.summary.trim()}</p>, [sec], false);
      }),

    experience: () =>
      section("experience", "experience", names.experience, (sec) => {
        const groups: Experience[][] = [];
        for (const e of resume.experience) {
          if (experienceIsEmpty(e)) continue;
          const last = groups[groups.length - 1];
          if (last && (last[0]?.company ?? "").trim() === e.company.trim()) last.push(e);
          else groups.push([e]);
        }
        groups.forEach((g, gi) => {
          const first = g[0] as Experience;
          const lastRole = g[g.length - 1] as Experience;
          const grp: Wrap = { key: `grp-${gi}`, tag: "div", props: { "data-group": "" } };
          const wrap = [sec, grp];
          const company = first.company.trim();
          if (company !== "") {
            const location = (g.map((e) => e.location.trim()).find((l) => l !== "") ?? "");
            add(
              <div className={`u row co-l${gi > 0 ? " gap" : ""}`} data-level="company">
                <span className="ld">
                  <span className="co" data-part="company">
                    {company}
                  </span>
                  {location !== "" ? (
                    <span className="loc" data-part="location">
                      {location}
                    </span>
                  ) : null}
                </span>
                {dates(lastRole.start, first.end, lang)}
              </div>,
              wrap,
              true,
              true,
            );
          }
          for (const e of g) {
            const title = e.title.trim();
            const range = formatRange(e.start.trim(), e.end.trim(), lang);
            if (title !== "" || range !== "") {
              add(
                <div className="u row rl" data-level="role">
                  <span className="ld">
                    <span className="role" data-part="title">
                      {title}
                    </span>
                  </span>
                  {dates(e.start, e.end, lang)}
                </div>,
                wrap,
                true,
                true,
              );
            }
            bullets(e.bullets, wrap);
            for (const p of nestedIn(e.id)) {
              const nest: Wrap = { key: `nest-${p.id}`, tag: "div", props: { "data-nest": "" } };
              const inner = [...wrap, nest];
              add(
                <div className="u row pl" data-level="project">
                  <span className="ld">
                    <span className="ptag" data-part="tag">
                      {lang === "zh" ? "项目" : "Project"}
                    </span>
                    {p.name.trim() !== "" ? (
                      <span className="ptitle" data-part="name">
                        {p.name.trim()}
                      </span>
                    ) : null}
                  </span>
                  {dates(p.start, p.end, lang)}
                </div>,
                inner,
                true,
                true,
              );
              bullets(p.bullets, inner);
            }
          }
        });
      }),

    projects: () =>
      section("projects", "projects", names.projects, (sec) => {
        loose.forEach((p, i) => {
          const meta = [p.role.trim(), p.org.trim()].filter((s) => s !== "").join(" · ");
          const tech = filled(p.tech).map((x) => x.trim());
          const body = filled(p.bullets);
          add(
            <div className={`u row pj${i > 0 ? " gap" : ""}`} data-level="project-standalone">
              <span className="ld">
                {p.name.trim() !== "" ? (
                  <span className="pname" data-part="name">
                    {p.name.trim()}
                  </span>
                ) : null}
                {meta !== "" ? (
                  <span className="pmeta" data-part="meta">
                    {meta}
                  </span>
                ) : null}
              </span>
              {dates(p.start, p.end, lang)}
            </div>,
            [sec],
            tech.length > 0 || body.length > 0,
            true,
          );
          if (tech.length > 0) {
            add(
              <div className="u tech" data-part="tech">
                <span className="tl" data-part="tech-label">
                  {lang === "zh" ? "技术栈" : "Tech:"}
                </span>
                {tech.map((x, k) => (
                  <span className="tk" data-part="tech-tag" key={k}>
                    {x}
                  </span>
                ))}
              </div>,
              [sec],
              body.length > 0,
            );
          }
          bullets(body, [sec]);
        });
      }),

    education: () =>
      section("education", "education", names.education, (sec) => {
        resume.education
          .filter((e) => !educationIsEmpty(e))
          .forEach((e, i) => {
            const details = filled(e.details).map((d) => d.trim());
            add(
              <div className={`u row edu${i > 0 ? " gap2" : ""}`} data-level="education">
                <span className="ld">
                  {e.school.trim() !== "" ? (
                    <span className="school" data-part="school">
                      {e.school.trim()}
                    </span>
                  ) : null}
                  {e.degree.trim() !== "" ? (
                    <span className="deg" data-part="degree">
                      {e.degree.trim()}
                    </span>
                  ) : null}
                </span>
                {dates(e.start, e.end, lang)}
              </div>,
              [sec],
              details.length > 0,
              true,
            );
            if (details.length > 0)
              add(
                <div className="u tech det" data-part="details">
                  {details.join(" · ")}
                </div>,
                [sec],
                false,
              );
          });
      }),

    skills: () =>
      section("skills", "skills", names.skills, (sec) => {
        for (const g of resume.skills) {
          const items = filled(g.items).map((x) => x.trim());
          if (items.length === 0 && g.name.trim() === "") continue;
          if (variant === "classic") {
            add(
              <p className="u ex">
                {g.name.trim() !== "" ? <strong>{groupLabel(g.name.trim(), lang)}</strong> : null}
                {joinItems(items, lang)}
              </p>,
              [sec],
              false,
            );
          } else {
            add(
              <div className="u chips">
                {g.name.trim() !== "" ? <span className="grp">{groupLabel(g.name.trim(), lang)}</span> : null}
                {items.map((x, k) => (
                  <span className="chip" data-part="chip" key={k}>
                    {x}
                  </span>
                ))}
              </div>,
              [sec],
              false,
            );
          }
        }
      }),

    certificates: () => section("certificates", "certificates", names.certificates, (sec) => bullets(resume.certificates, [sec])),

    languages: () =>
      section("languages", "languages", names.languages, (sec) => {
        const text = joinLanguages(resume.languages, lang);
        if (text !== "") add(<p className="u u-p">{text}</p>, [sec], false);
      }),
  };

  const extras = () => {
    for (const x of resume.extras) section(`extra-${x.id}`, "extra", x.heading.trim() === "" ? names.other : x.heading.trim(), (sec) => bullets(x.items, [sec]));
  };

  const order: SectionId[] = [...(resume.order ?? DEFAULT_ORDER)].filter((s, i, all) => all.indexOf(s) === i);
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);
  for (const id of order) {
    if (id === "extras") extras();
    else builders[id]?.();
  }

  // an entry line at the end of its section has nothing to stay with
  units.forEach((u, i) => {
    if (!u.line || !u.keep) return;
    const next = units[i + 1];
    if (!next || next.wrap[0]?.key !== u.wrap[0]?.key) u.keep = false;
  });
  return units;
}
