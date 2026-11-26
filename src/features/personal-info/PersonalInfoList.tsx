import { useState } from "react";
import type { StrKey } from "../../i18n/en.ts";
import { useT } from "../../i18n/index.ts";
import { personalInfoFindingsIn } from "../../checks/personalInfo.ts";
import type { PersonalInfoId } from "../../checks/personalInfo.ts";
import type { Resume } from "../../resume/model.ts";

const LINE: Record<PersonalInfoId, StrKey> = {
  photo: "pi.line.photo",
  age: "pi.line.age",
  "id-number": "pi.line.id",
  marital: "pi.line.marital",
  religion: "pi.line.religion",
};

/** "Before you send it": gentle suggestions. Ignoring lasts for this session only; nothing is stored or removed. */
export function PersonalInfoList({ resume }: { resume: Resume }) {
  const t = useT();
  const [ignored, setIgnored] = useState<ReadonlySet<PersonalInfoId>>(new Set());
  const seen = new Set<PersonalInfoId>();
  const items = personalInfoFindingsIn(resume).filter((f) => {
    if (ignored.has(f.id) || seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
  if (items.length === 0) return null;
  return (
    <section className="card" data-testid="personal-info-list">
      <h2>{t("pi.title")}</h2>
      <ul>
        {items.map((f) => (
          <li key={f.id}>
            <p>{t(LINE[f.id]).replace("{where}", t(`pi.in.${f.kind}` as StrKey))}</p>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => document.getElementById(f.where)?.focus()}
            >
              {t("pi.show")}
            </button>{" "}
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setIgnored((s) => new Set(s).add(f.id))}
            >
              {t("pi.ignore")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
