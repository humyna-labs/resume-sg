import { useState } from "react";
import type { StrKey } from "../../i18n/en.ts";
import { useT } from "../../i18n/index.ts";
import * as ed from "../../resume/edit.ts";
import type { Dir } from "../../resume/edit.ts";
import { emptyResume } from "../../resume/model.ts";
import type { Resume } from "../../resume/model.ts";
import { sampleResume } from "../../resume/sample.ts";
import { PersonalInfoList } from "../personal-info/PersonalInfoList.tsx";
import { Preview } from "./Preview.tsx";

type T = (key: StrKey) => string;

function Field({
  id,
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} className="input input-area" rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="input" type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function Controls({
  t,
  name,
  onMove,
  onRemove,
}: {
  t: T;
  name: string;
  onMove: (d: Dir) => void;
  onRemove: () => void;
}) {
  return (
    <div className="ctl">
      <button type="button" className="btn btn-sm btn-ghost" aria-label={`${t("ed.moveUp")}: ${name}`} onClick={() => onMove("up")}>
        <span aria-hidden="true">↑</span>
      </button>
      <button type="button" className="btn btn-sm btn-ghost" aria-label={`${t("ed.moveDown")}: ${name}`} onClick={() => onMove("down")}>
        <span aria-hidden="true">↓</span>
      </button>
      <button type="button" className="btn btn-sm btn-ghost" aria-label={`${t("ed.remove")}: ${name}`} onClick={onRemove}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

/** A list of single-line strings, each with its own label and move / remove buttons. */
function StringList({
  t,
  idPrefix,
  labelKey,
  addKey,
  items,
  onAdd,
  onUpdate,
  onMove,
  onRemove,
  numbered = true,
  addLabel,
}: {
  t: T;
  idPrefix: string;
  labelKey: StrKey;
  addKey: StrKey;
  items: string[];
  onAdd: () => void;
  onUpdate: (i: number, v: string) => void;
  onMove: (i: number, d: Dir) => void;
  onRemove: (i: number) => void;
  /** Labels read "Item 1", "Item 2"; false keeps the plain label. */
  numbered?: boolean;
  /** Accessible name of the add button when several lists share one add label. */
  addLabel?: string | undefined;
}) {
  return (
    <div className="list">
      {items.map((v, i) => {
        const id = `${idPrefix}-${i}`;
        return (
          <div className="list-row" key={i}>
            <div className="field">
              <label htmlFor={id}>{numbered ? `${t(labelKey)} ${i + 1}` : t(labelKey)}</label>
              <input id={id} className="input" type="text" value={v} onChange={(e) => onUpdate(i, e.target.value)} />
            </div>
            <Controls t={t} name={v || `${t("ed.entry")} ${i + 1}`} onMove={(d) => onMove(i, d)} onRemove={() => onRemove(i)} />
          </div>
        );
      })}
      <button type="button" className="btn btn-sm btn-ghost add" aria-label={addLabel} onClick={onAdd}>
        {t(addKey)}
      </button>
    </div>
  );
}

export function ResumeEditor() {
  const t = useT();
  const [r, setR] = useState<Resume>(emptyResume);
  const apply = (f: (r: Resume) => Resume) => setR((cur) => f(cur));

  function onClear() {
    if (window.confirm(t("ed.clearConfirm"))) setR(emptyResume());
  }

  return (
    <div className="editor-grid">
      <div className="editor" data-testid="resume-editor" role="group" aria-label={t("ed.editorLabel")}>
        <div className="card editor-bar">
          <div className="bar-actions">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setR(sampleResume())}>
              {t("ed.load")}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClear}>
              {t("ed.clear")}
            </button>
          </div>
          <p className="field-hint">{t("ed.memory")}</p>
        </div>

        <section className="card">
          <h2>{t("ed.basics")}</h2>
          <div className="cols">
            <Field id="b-name" label={t("ed.name")} value={r.basics.name} onChange={(v) => apply((x) => ed.updateBasics(x, { name: v }))} />
            <Field id="b-headline" label={t("ed.headline")} value={r.basics.headline} onChange={(v) => apply((x) => ed.updateBasics(x, { headline: v }))} />
            <Field id="b-email" label={t("ed.email")} value={r.basics.email} onChange={(v) => apply((x) => ed.updateBasics(x, { email: v }))} />
            <Field id="b-phone" label={t("ed.phone")} value={r.basics.phone} onChange={(v) => apply((x) => ed.updateBasics(x, { phone: v }))} />
            <Field id="b-location" label={t("ed.location")} value={r.basics.location} onChange={(v) => apply((x) => ed.updateBasics(x, { location: v }))} />
          </div>
          <StringList
            t={t}
            idPrefix="b-link"
            labelKey="ed.link"
            addKey="ed.addLink"
            items={r.basics.links}
            onAdd={() => apply(ed.addLink)}
            onUpdate={(i, v) => apply((x) => ed.updateLink(x, i, v))}
            onMove={(i, d) => apply((x) => ed.moveLink(x, i, d))}
            onRemove={(i) => apply((x) => ed.removeLink(x, i))}
          />
        </section>

        <section className="card">
          <h2>{t("ed.summary")}</h2>
          <Field id="summary" label={t("ed.summary")} multiline value={r.summary} onChange={(v) => apply((x) => ed.updateSummary(x, v))} />
        </section>

        <section className="card">
          <h2>{t("ed.experience")}</h2>
          <p className="field-hint">{t("ed.dateHint")}</p>
          {r.experience.map((e, n) => {
            const name = e.title || e.company || `${t("ed.entry")} ${n + 1}`;
            return (
              <div className="entry" key={e.id}>
                <Controls t={t} name={name} onMove={(d) => apply((x) => ed.moveExperience(x, e.id, d))} onRemove={() => apply((x) => ed.removeExperience(x, e.id))} />
                <div className="cols">
                  <Field id={`${e.id}-company`} label={t("ed.company")} value={e.company} onChange={(v) => apply((x) => ed.updateExperience(x, e.id, { company: v }))} />
                  <Field id={`${e.id}-title`} label={t("ed.jobTitle")} value={e.title} onChange={(v) => apply((x) => ed.updateExperience(x, e.id, { title: v }))} />
                  <Field id={`${e.id}-location`} label={t("ed.location")} value={e.location} onChange={(v) => apply((x) => ed.updateExperience(x, e.id, { location: v }))} />
                  <Field id={`${e.id}-start`} label={t("ed.start")} placeholder="2021-03" value={e.start} onChange={(v) => apply((x) => ed.updateExperience(x, e.id, { start: v }))} />
                  <Field id={`${e.id}-end`} label={t("ed.end")} placeholder="2023-08" value={e.end} onChange={(v) => apply((x) => ed.updateExperience(x, e.id, { end: v }))} />
                </div>
                <StringList
                  t={t}
                  idPrefix={`${e.id}-bullet`}
                  labelKey="ed.bullet"
                  addKey="ed.addBullet"
                  items={e.bullets}
                  onAdd={() => apply((x) => ed.addBullet(x, e.id))}
                  onUpdate={(i, v) => apply((x) => ed.updateBullet(x, e.id, i, v))}
                  onMove={(i, d) => apply((x) => ed.moveBullet(x, e.id, i, d))}
                  onRemove={(i) => apply((x) => ed.removeBullet(x, e.id, i))}
                />
              </div>
            );
          })}
          <button type="button" className="btn btn-sm btn-ghost add" onClick={() => apply(ed.addExperience)}>
            {t("ed.addExperience")}
          </button>
        </section>

        <section className="card">
          <h2>{t("ed.projects")}</h2>
          {r.projects.map((p, n) => {
            const name = p.name || `${t("ed.entry")} ${n + 1}`;
            return (
              <div className="entry" key={p.id}>
                <Controls t={t} name={name} onMove={(d) => apply((x) => ed.moveProject(x, p.id, d))} onRemove={() => apply((x) => ed.removeProject(x, p.id))} />
                <div className="cols">
                  <Field id={`${p.id}-name`} label={t("ed.projectName")} value={p.name} onChange={(v) => apply((x) => ed.updateProject(x, p.id, { name: v }))} />
                  <Field id={`${p.id}-role`} label={t("ed.projectRole")} value={p.role} onChange={(v) => apply((x) => ed.updateProject(x, p.id, { role: v }))} />
                  <Field id={`${p.id}-org`} label={t("ed.organisation")} value={p.org} onChange={(v) => apply((x) => ed.updateProject(x, p.id, { org: v }))} />
                  <div className="field">
                    <label htmlFor={`${p.id}-under`}>{t("ed.underRole")}</label>
                    <select
                      id={`${p.id}-under`}
                      className="input"
                      value={p.experienceId ?? ""}
                      onChange={(e) => apply((x) => ed.updateProject(x, p.id, { experienceId: e.target.value === "" ? undefined : e.target.value }))}
                    >
                      <option value="">{t("ed.noRole")}</option>
                      {r.experience.map((e, i) => (
                        <option key={e.id} value={e.id}>
                          {[e.title, e.company].filter((s) => s !== "").join(" · ") || `${t("ed.entry")} ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field id={`${p.id}-start`} label={t("ed.start")} placeholder="2021-03" value={p.start} onChange={(v) => apply((x) => ed.updateProject(x, p.id, { start: v }))} />
                  <Field id={`${p.id}-end`} label={t("ed.end")} placeholder="2023-08" value={p.end} onChange={(v) => apply((x) => ed.updateProject(x, p.id, { end: v }))} />
                </div>
                <StringList
                  t={t}
                  idPrefix={`${p.id}-tech`}
                  labelKey="ed.techItem"
                  addKey="ed.addTech"
                  numbered={false}
                  items={p.tech}
                  onAdd={() => apply((x) => ed.addProjectTech(x, p.id))}
                  onUpdate={(i, v) => apply((x) => ed.updateProjectTech(x, p.id, i, v))}
                  onMove={(i, d) => apply((x) => ed.moveProjectTech(x, p.id, i, d))}
                  onRemove={(i) => apply((x) => ed.removeProjectTech(x, p.id, i))}
                />
                <StringList
                  t={t}
                  idPrefix={`${p.id}-bullet`}
                  labelKey="ed.bullet"
                  addKey="ed.addBullet"
                  items={p.bullets}
                  onAdd={() => apply((x) => ed.addProjectBullet(x, p.id))}
                  onUpdate={(i, v) => apply((x) => ed.updateProjectBullet(x, p.id, i, v))}
                  onMove={(i, d) => apply((x) => ed.moveProjectBullet(x, p.id, i, d))}
                  onRemove={(i) => apply((x) => ed.removeProjectBullet(x, p.id, i))}
                />
              </div>
            );
          })}
          <button type="button" className="btn btn-sm btn-ghost add" onClick={() => apply(ed.addProject)}>
            {t("ed.addProject")}
          </button>
        </section>

        <section className="card">
          <h2>{t("ed.education")}</h2>
          {r.education.map((e, n) => {
            const name = [e.school, e.degree].filter((s) => s !== "").join(", ") || `${t("ed.entry")} ${n + 1}`;
            return (
              <div className="entry" key={e.id}>
                <Controls t={t} name={name} onMove={(d) => apply((x) => ed.moveEducation(x, e.id, d))} onRemove={() => apply((x) => ed.removeEducation(x, e.id))} />
                <div className="cols">
                  <Field id={`${e.id}-school`} label={t("ed.school")} value={e.school} onChange={(v) => apply((x) => ed.updateEducation(x, e.id, { school: v }))} />
                  <Field id={`${e.id}-degree`} label={t("ed.degree")} value={e.degree} onChange={(v) => apply((x) => ed.updateEducation(x, e.id, { degree: v }))} />
                  <Field id={`${e.id}-start`} label={t("ed.start")} placeholder="2014" value={e.start} onChange={(v) => apply((x) => ed.updateEducation(x, e.id, { start: v }))} />
                  <Field id={`${e.id}-end`} label={t("ed.end")} placeholder="2018" value={e.end} onChange={(v) => apply((x) => ed.updateEducation(x, e.id, { end: v }))} />
                </div>
                <StringList
                  t={t}
                  idPrefix={`${e.id}-detail`}
                  labelKey="ed.detail"
                  addKey="ed.addDetail"
                  items={e.details}
                  onAdd={() => apply((x) => ed.addDetail(x, e.id))}
                  onUpdate={(i, v) => apply((x) => ed.updateDetail(x, e.id, i, v))}
                  onMove={(i, d) => apply((x) => ed.moveDetail(x, e.id, i, d))}
                  onRemove={(i) => apply((x) => ed.removeDetail(x, e.id, i))}
                />
              </div>
            );
          })}
          <button type="button" className="btn btn-sm btn-ghost add" onClick={() => apply(ed.addEducation)}>
            {t("ed.addEducation")}
          </button>
        </section>

        <section className="card">
          <h2>{t("ed.skills")}</h2>
          {r.skills.map((g, n) => (
            <div className="entry" key={g.id}>
              <Controls t={t} name={g.name || `${t("ed.entry")} ${n + 1}`} onMove={(d) => apply((x) => ed.moveSkillGroup(x, g.id, d))} onRemove={() => apply((x) => ed.removeSkillGroup(x, g.id))} />
              <Field id={`${g.id}-name`} label={t("ed.groupName")} value={g.name} onChange={(v) => apply((x) => ed.updateSkillGroup(x, g.id, { name: v }))} />
              <StringList
                t={t}
                idPrefix={`${g.id}-item`}
                labelKey="ed.item"
                addKey="ed.addItem"
                items={g.items}
                onAdd={() => apply((x) => ed.addSkillItem(x, g.id))}
                onUpdate={(i, v) => apply((x) => ed.updateSkillItem(x, g.id, i, v))}
                onMove={(i, d) => apply((x) => ed.moveSkillItem(x, g.id, i, d))}
                onRemove={(i) => apply((x) => ed.removeSkillItem(x, g.id, i))}
              />
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-ghost add" onClick={() => apply(ed.addSkillGroup)}>
            {t("ed.addSkillGroup")}
          </button>
        </section>

        <section className="card">
          <h2>{t("ed.certificates")}</h2>
          <StringList
            t={t}
            idPrefix="cert"
            labelKey="ed.certificate"
            addKey="ed.addCertificate"
            items={r.certificates}
            onAdd={() => apply(ed.addCertificate)}
            onUpdate={(i, v) => apply((x) => ed.updateCertificate(x, i, v))}
            onMove={(i, d) => apply((x) => ed.moveCertificate(x, i, d))}
            onRemove={(i) => apply((x) => ed.removeCertificate(x, i))}
          />
        </section>

        <section className="card">
          <h2>{t("ed.extras")}</h2>
          {r.extras.map((x0, n) => (
            <div className="entry" key={x0.id}>
              <Controls t={t} name={x0.heading || `${t("ed.entry")} ${n + 1}`} onMove={(d) => apply((x) => ed.moveExtra(x, x0.id, d))} onRemove={() => apply((x) => ed.removeExtra(x, x0.id))} />
              <Field id={`${x0.id}-heading`} label={t("ed.sectionHeading")} value={x0.heading} onChange={(v) => apply((x) => ed.updateExtra(x, x0.id, { heading: v }))} />
              <StringList
                t={t}
                idPrefix={`${x0.id}-item`}
                labelKey="ed.extraItem"
                addKey="ed.addExtraItem"
                numbered={false}
                addLabel={n === 0 ? undefined : `${t("ed.addExtraItem")}: ${x0.heading || `${t("ed.entry")} ${n + 1}`}`}
                items={x0.items}
                onAdd={() => apply((x) => ed.addExtraItem(x, x0.id))}
                onUpdate={(i, v) => apply((x) => ed.updateExtraItem(x, x0.id, i, v))}
                onMove={(i, d) => apply((x) => ed.moveExtraItem(x, x0.id, i, d))}
                onRemove={(i) => apply((x) => ed.removeExtraItem(x, x0.id, i))}
              />
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-ghost add" onClick={() => apply(ed.addExtra)}>
            {t("ed.addExtra")}
          </button>
        </section>

        <section className="card">
          <h2>{t("ed.languages")}</h2>
          <StringList
            t={t}
            idPrefix="lang"
            labelKey="ed.language"
            addKey="ed.addLanguage"
            items={r.languages}
            onAdd={() => apply(ed.addLanguage)}
            onUpdate={(i, v) => apply((x) => ed.updateLanguage(x, i, v))}
            onMove={(i, d) => apply((x) => ed.moveLanguage(x, i, d))}
            onRemove={(i) => apply((x) => ed.removeLanguage(x, i))}
          />
        </section>
      </div>
      <div className="preview-col">
        <Preview resume={r} />
        <PersonalInfoList resume={r} />
      </div>
    </div>
  );
}
