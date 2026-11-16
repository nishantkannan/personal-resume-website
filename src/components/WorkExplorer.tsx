"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Project, ProjectCategory, SkillGroup, SkillId, Role } from "@/data/resume";
import { setUi } from "@/lib/drive-store";
import { ProjectVisual } from "./ProjectVisual";

type Props = {
  skillGroups: SkillGroup[];
  company: string;
  roles: Role[];
  projectCategories: { id: ProjectCategory; name: string }[];
  projects: Project[];
};

export function WorkExplorer({ skillGroups, company, roles, projectCategories, projects }: Props) {
  const [selected, setSelected] = useState<SkillId | null>(null);

  // Projects grouped under their category headings; empty categories are left out.
  const groups = projectCategories
    .map((c) => ({ ...c, items: projects.filter((p) => p.category === c.id) }))
    .filter((g) => g.items.length > 0);

  const skillName = useMemo(() => {
    const m = new Map<SkillId, string>();
    skillGroups.forEach((g) => g.skills.forEach((s) => m.set(s.id, s.name)));
    return m;
  }, [skillGroups]);

  const usage = useMemo(() => {
    const m = new Map<SkillId, number>();
    const count = (ids: SkillId[]) => ids.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1));
    roles.forEach((r) => r.bullets.forEach((b) => count(b.skills)));
    projects.forEach((p) => count(p.skills));
    return m;
  }, [roles, projects]);

  function choose(id: SkillId | null) {
    setSelected(id);
    // Light up the matching district in the 3D city.
    const group = id === null ? null : skillGroups.findIndex((g) => g.skills.some((s) => s.id === id));
    setUi({ skillGroup: group === -1 ? null : group });
  }

  const matches = (ids: SkillId[]) => selected === null || ids.includes(selected);
  const selectedCount = selected ? usage.get(selected) ?? 0 : 0;

  const status = selected && (
    <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-contour bg-bg/60 px-4 py-2.5 text-sm">
      <span>
        {selectedCount > 0 ? (
          <>
            <strong>{selectedCount}</strong> {selectedCount === 1 ? "item uses" : "items use"}{" "}
            <strong>{skillName.get(selected)}</strong>
          </>
        ) : (
          <>
            <strong>{skillName.get(selected)}</strong> is on my resume but not tied to one item here
          </>
        )}
      </span>
      <button type="button" onClick={() => choose(null)} className="font-semibold text-contour underline-offset-4 hover:underline">
        Show all
      </button>
    </div>
  );

  return (
    <>
      <section id="skills" aria-labelledby="skills-title" className="stop">
        <div className="panel">
          <h2 id="skills-title" className="section-title">
            Skills
          </h2>
          <p className="mt-3 text-ink-soft">
            Choose a skill to light up its district and the work where I used it.
          </p>
          <div className="mt-6 flex flex-col gap-6">
            {skillGroups.map((group) => (
              <div key={group.name}>
                <h3 className="font-semibold">{group.name}</h3>
                <p className="text-sm text-ink-soft">{group.description}</p>
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {group.skills.map((s) => {
                    const on = selected === s.id;
                    const n = usage.get(s.id) ?? 0;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => choose(on ? null : s.id)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.92rem] transition-colors ${
                            on ? "border-contour bg-contour text-bg" : "border-line bg-bg/50 text-ink hover:border-contour"
                          }`}
                        >
                          {s.name}
                          {n > 0 && (
                            <>
                              <span aria-hidden="true" className={`text-xs ${on ? "text-bg/80" : "text-ink-soft"}`}>
                                {n}
                              </span>
                              <span className="sr-only">, used in {n} {n === 1 ? "item" : "items"}</span>
                            </>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {status && <div className="mt-6">{status}</div>}
        </div>
      </section>

      <section id="experience" aria-labelledby="experience-title" className="stop">
        <div className="panel panel-wide">
          <h2 id="experience-title" className="section-title">
            Experience
          </h2>
          <p className="mt-3 text-ink-soft">{company}, 2022 to now</p>
          {status && <div className="mt-5">{status}</div>}

          <ol className="relative mt-8 flex flex-col gap-10 border-l border-line pl-6">
            {roles.map((role) => (
              <li key={role.title} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-2 -left-[calc(1.5rem+5px)] size-[9px] rounded-full border-2 border-contour bg-surface"
                />
                <h3 className="text-lg font-semibold leading-snug">{role.title}</h3>
                <p className="text-ink-soft">
                  {role.team}
                  <span className="mx-2 text-line" aria-hidden="true">
                    |
                  </span>
                  <time>{role.start}</time> to <time>{role.end}</time>
                </p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {role.bullets.map((b) => {
                    const hit = matches(b.skills);
                    return (
                      <li
                        key={b.id}
                        id={b.id}
                        className={`relative rounded-sm py-1 pl-5 text-[0.98rem] transition-opacity duration-200 ${
                          hit ? "opacity-100" : "opacity-35"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute top-[0.85em] left-0 h-[3px] w-2.5 rounded-full ${
                            selected && hit ? "bg-signal" : "bg-line"
                          }`}
                        />
                        {b.text}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="projects" aria-labelledby="projects-title" className="stop">
        <div className="panel panel-wide">
          <h2 id="projects-title" className="section-title">
            {projects.length > 1 ? "Projects" : "Project"}
          </h2>
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`projects-${group.id}`} className="mt-9 first-of-type:mt-7">
              <div className="flex items-center gap-3">
                <h3 id={`projects-${group.id}`} className="font-display text-[1.15rem] font-bold">
                  {group.name}
                </h3>
                <span aria-hidden="true" className="h-px flex-1 bg-line" />
              </div>
              <div className="mt-5 flex flex-col">
                {group.items.map((p, i) => (
                  <article
                    key={p.id}
                    id={p.id}
                    className={`rounded-sm transition-opacity duration-200 ${i > 0 ? "mt-7 border-t border-line pt-7" : ""} ${
                      matches(p.skills) ? "opacity-100" : "opacity-35"
                    }`}
                  >
                    <ProjectVisual project={p} />
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <h4 className="text-lg font-semibold">{p.name}</h4>
                      <span className="text-ink-soft">{p.date}</span>
                    </div>
                    {p.result && (
                      <p className="mt-3 inline-block rounded-sm bg-signal px-2 py-0.5 text-sm font-semibold text-on-signal">
                        {p.result}
                      </p>
                    )}
                    <p className="mt-3">{p.text}</p>
                    {p.stats && (
                      <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
                        {p.stats.map((s) => (
                          <div key={s.label} className="flex flex-col-reverse justify-end bg-surface px-3 py-2.5">
                            <dt className="mt-0.5 text-[0.75rem] leading-snug text-ink-soft">{s.label}</dt>
                            <dd className="text-xl font-semibold leading-tight">{s.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Built with">
                      {p.skills.map((id) => (
                        <li
                          key={id}
                          className={`rounded-full border px-2.5 py-0.5 text-[0.8rem] ${
                            id === selected ? "border-contour bg-contour/10 text-ink" : "border-line text-ink-soft"
                          }`}
                        >
                          {skillName.get(id)}
                        </li>
                      ))}
                    </ul>
                    {p.href && (
                      <Link
                        href={p.href}
                        {...(p.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="mt-5 inline-flex items-center gap-2 rounded-full bg-contour px-5 py-2.5 text-[0.95rem] font-semibold text-bg transition-colors hover:bg-contour-strong"
                      >
                        {p.linkLabel ?? "View project"} <span aria-hidden="true">→</span>
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
