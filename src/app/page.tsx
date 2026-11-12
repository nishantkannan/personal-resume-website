import {
  certifications,
  education,
  experience,
  highlights,
  profile,
  projects,
  skillGroups,
} from "@/data/resume";
import { ContactForm } from "@/components/ContactForm";
import { DriveExperience } from "@/components/drive/DriveExperience";
import { ResultsList } from "@/components/ResultsList";
import { WorkExplorer } from "@/components/WorkExplorer";

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-20 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <DriveExperience />

      <main id="main" className="relative z-10 mx-auto max-w-[80rem] px-4 sm:px-8">
        <section id="top" aria-labelledby="hero-title" className="stop stop-hero">
          <div className="panel">
            <h1 id="hero-title" className="display text-[clamp(2.6rem,1.5rem+4.6vw,4.6rem)] font-extrabold">
              Nishant
              <br />
              Kannan
            </h1>
            <p className="mt-5 text-xl font-semibold">{profile.role}</p>
            <p className="mt-2 max-w-[40ch] text-lg text-ink-soft">{profile.tagline}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={profile.resumePdf}
                download="Nishant_Kannan_Resume.pdf"
                className="rounded-full bg-contour px-6 py-3 font-semibold text-bg transition-colors hover:bg-contour-strong"
              >
                Download resume (PDF)
              </a>
              <a
                href="#contact"
                className="rounded-full border border-ink/25 px-6 py-3 font-semibold transition-colors hover:border-contour hover:text-contour"
              >
                Get in touch
              </a>
            </div>
            <p className="drive-only mt-8 flex items-center gap-2 text-sm text-ink-soft">
              <svg viewBox="0 0 24 24" className="size-4 animate-[nudge_2.4s_ease-in-out_infinite]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Scroll to start driving
            </p>
          </div>
        </section>

        <section id="results" aria-labelledby="results-title" className="stop">
          <div className="panel">
            <h2 id="results-title" className="section-title">
              Results along the way
            </h2>
            <p className="mt-3 text-ink-soft">
              The billboards on this stretch. Select one to jump to the work behind it.
            </p>
            <ResultsList highlights={highlights} />
          </div>
        </section>

        <section id="about" aria-labelledby="about-title" className="stop">
          <div className="panel">
            <h2 id="about-title" className="section-title">
              About
            </h2>
            <div className="mt-5 flex flex-col gap-4 text-[1.05rem]">
              {profile.about.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        <WorkExplorer
          skillGroups={skillGroups}
          company={experience.company}
          roles={experience.roles}
          projects={projects}
        />

        <section id="education" aria-labelledby="education-title" className="stop">
          <div className="panel">
            <h2 id="education-title" className="section-title">
              Education
            </h2>
            <h3 className="mt-5 text-lg font-semibold leading-snug">{education.school}</h3>
            <p className="text-ink-soft">{education.location}</p>
            <p className="mt-3">{education.degree}</p>
            <p>Minor in {education.minor}</p>
            <h4 className="mt-5 font-semibold">Honors</h4>
            <ul className="mt-1 text-ink-soft">
              {education.honors.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <h3 className="mt-7 text-lg font-semibold">Certifications</h3>
            <ul className="mt-2">
              {certifications.map((c) => (
                <li key={c.name} className="flex items-baseline justify-between gap-4 border-b border-line py-2">
                  <span>{c.name}</span>
                  <span className="text-ink-soft">{c.year}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="contact" aria-labelledby="contact-title" className="stop stop-last">
          <div className="panel">
            <h2 id="contact-title" className="section-title">
              Contact
            </h2>
            <p className="mt-3 text-ink-soft">
              <span className="drive-only">You&apos;ve reached the end of the drive. </span>
              Hiring for analytics, BI or AI work? Send a message and it comes straight to my inbox.
            </p>
            <ul className="mt-4 flex gap-5">
              <li>
                <a href={profile.linkedin} className="font-semibold text-contour underline-offset-4 hover:underline">
                  LinkedIn
                </a>
              </li>
              <li>
                <a href={profile.github} className="font-semibold text-contour underline-offset-4 hover:underline">
                  GitHub
                </a>
              </li>
            </ul>
            <div className="mt-6">
              <ContactForm linkedin={profile.linkedin} />
            </div>
            <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-sm text-ink-soft">
              <p>{profile.name}</p>
              <a href={profile.resumePdf} download="Nishant_Kannan_Resume.pdf" className="underline-offset-4 hover:text-ink hover:underline">
                Download resume (PDF)
              </a>
            </footer>
          </div>
        </section>
      </main>
    </>
  );
}
