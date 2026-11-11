"use client";

import { useMemo, useState } from "react";
import type { SkillGroup, SkillId, Role } from "@/data/resume";

type Project = {
  id: string;
  name: string;
  date: string;
  result: string;
  text: string;
  skills: SkillId[];
};

type Props = {
  skillGroups: SkillGroup[];
  company: string;
  roles: Role[];
  projects: Project[];
};

export function WorkExplorer({ skillGroups, company, roles, projects }: Props) {
  const [selected, setSelected] = useState<SkillId | null>(null);

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

  const matches = (ids: SkillId[]) => selected === null || ids.includes(selected);
  const selectedCount = selected ? usage.get(selected) ?? 0 : 0;

  return (
    <>
      <section id="skills" aria-labelledby="skills-title" className="border-t border-line py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <h2 id="skills-title" className="section-title">
              Skills
            </h2>
            <p className="mt-4 max-w-[36ch] text-ink-soft">
              Choose a skill to see where I&apos;ve used it. Matching work lights up in the experience
              section below.
            </p>
          </div>

          <div className="flex flex-col gap-8">
            {skillGroups.map((group) => (
              <div key={group.name}>
                <h3 className="font-semibold">{group.name}</h3>
                <p className="text-sm text-ink-soft">{group.description}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {group.skills.map((s) => {
                    const on = selected === s.id;
                    const n = usage.get(s.id) ?? 0;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => setSelected(on ? null : s.id)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.95rem] transition-colors ${
                            on
                              ? "border-contour bg-contour text-bg"
                              : "border-line bg-surface text-ink hover:border-contour"
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
        </div>
      </section>

      <section id="experience" aria-labelledby="experience-title" className="border-t border-line py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <h2 id="experience-title" className="section-title">
              Experience
            </h2>
            <p className="mt-4 text-ink-soft">{company}, 2022 to now</p>

            <div
              aria-live="polite"
              className={`mt-6 rounded-md border px-4 py-3 text-sm transition-colors ${
                selected ? "border-contour bg-surface" : "border-transparent"
              }`}
            >
              {selected && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {selectedCount > 0 ? (
                      <>
                        <strong>{selectedCount}</strong> {selectedCount === 1 ? "item uses" : "items use"}{" "}
                        <strong>{skillName.get(selected)}</strong>
                      </>
                    ) : (
                      <>
                        <strong>{skillName.get(selected)}</strong> is listed on my resume but not tied to a
                        single item here
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="font-semibold text-contour underline-offset-4 hover:underline"
                  >
                    Show all
                  </button>
                </div>
              )}
            </div>
          </div>

          <ol className="relative flex flex-col gap-14 border-l border-line pl-6 sm:pl-10">
            {roles.map((role) => (
              <li key={role.title} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-2 -left-[calc(1.5rem+5px)] size-[9px] rounded-full border-2 border-contour bg-bg sm:-left-[calc(2.5rem+5px)]"
                />
                <h3 className="text-xl font-semibold leading-snug">{role.title}</h3>
                <p className="text-ink-soft">
                  {role.team}
                  <span className="mx-2 text-line" aria-hidden="true">
                    |
                  </span>
                  <time>{role.start}</time> to <time>{role.end}</time>
                </p>
                <ul className="mt-5 flex max-w-[68ch] flex-col gap-3">
                  {role.bullets.map((b) => {
                    const hit = matches(b.skills);
                    return (
                      <li
                        key={b.id}
                        id={b.id}
                        className={`relative rounded-sm py-1 pl-5 transition-opacity duration-200 ${
                          hit ? "opacity-100" : "opacity-35"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute top-[0.8em] left-0 h-[3px] w-2.5 rounded-full ${
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

      <section id="projects" aria-labelledby="projects-title" className="border-t border-line py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <h2 id="projects-title" className="section-title">
            Project
          </h2>
          <div className="flex flex-col gap-8">
            {projects.map((p) => (
              <article
                key={p.id}
                id={p.id}
                className={`max-w-[68ch] rounded-sm transition-opacity duration-200 ${
                  matches(p.skills) ? "opacity-100" : "opacity-35"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h3 className="text-xl font-semibold">{p.name}</h3>
                  <span className="text-ink-soft">{p.date}</span>
                </div>
                <p className="mt-3 inline-block rounded-sm bg-signal px-2 py-0.5 text-sm font-semibold text-on-signal">
                  {p.result}
                </p>
                <p className="mt-3">{p.text}</p>
                <p className="mt-3 text-sm text-ink-soft">
                  Built with {p.skills.map((id) => skillName.get(id)).join(", ")}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
