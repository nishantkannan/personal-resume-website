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
import { HeroTerrain } from "@/components/HeroTerrain";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WorkExplorer } from "@/components/WorkExplorer";

const nav = [
  { href: "#about", label: "About" },
  { href: "#skills", label: "Skills" },
  { href: "#experience", label: "Experience" },
  { href: "#contact", label: "Contact" },
];

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <div className="mx-auto max-w-[76rem] px-4 sm:px-8">
        <header className="flex items-center justify-between gap-4 py-5">
          <a href="#main" className="font-semibold">
            {profile.name}
          </a>
          <nav aria-label="Sections" className="flex items-center gap-1 sm:gap-2">
            <ul className="hidden items-center gap-1 md:flex">
              {nav.map((n) => (
                <li key={n.href}>
                  <a
                    href={n.href}
                    className="rounded-full px-3 py-2 text-ink-soft transition-colors hover:text-ink"
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
            <ThemeToggle />
          </nav>
        </header>

        <main id="main">
          <section
            aria-labelledby="hero-title"
            className="grid items-start gap-10 pt-8 pb-16 sm:pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:pb-24"
          >
            <div className="lg:pt-10">
              <h1 id="hero-title" className="display text-[clamp(2.9rem,1.6rem+5.5vw,5.6rem)] font-extrabold">
                Nishant
                <br />
                Kannan
              </h1>
              <p className="mt-6 text-xl font-semibold">{profile.role}</p>
              <p className="mt-3 max-w-[38ch] text-lg text-ink-soft">{profile.tagline}</p>
              <div className="mt-8 flex flex-wrap gap-3">
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
            </div>

            <HeroTerrain highlights={highlights} />
          </section>

          <section id="about" aria-labelledby="about-title" className="border-t border-line py-16 sm:py-24">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <h2 id="about-title" className="section-title">
                About
              </h2>
              <div className="flex max-w-[64ch] flex-col gap-5 text-lg">
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

          <section id="education" aria-labelledby="education-title" className="border-t border-line py-16 sm:py-24">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <h2 id="education-title" className="section-title">
                Education
              </h2>
              <div className="grid gap-10 md:grid-cols-2">
                <div>
                  <h3 className="text-xl font-semibold leading-snug">{education.school}</h3>
                  <p className="mt-1 text-ink-soft">{education.location}</p>
                  <p className="mt-4">{education.degree}</p>
                  <p>Minor in {education.minor}</p>
                  <h4 className="mt-5 font-semibold">Honors</h4>
                  <ul className="mt-1 text-ink-soft">
                    {education.honors.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Certifications</h3>
                  <ul className="mt-3">
                    {certifications.map((c) => (
                      <li key={c.name} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
                        <span>{c.name}</span>
                        <span className="text-ink-soft">{c.year}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section id="contact" aria-labelledby="contact-title" className="border-t border-line py-16 sm:py-24">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div>
                <h2 id="contact-title" className="section-title">
                  Contact
                </h2>
                <p className="mt-4 max-w-[34ch] text-ink-soft">
                  Hiring for analytics, BI or AI work? Send a message and it comes straight to my inbox.
                </p>
                <ul className="mt-6 flex flex-col gap-2">
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
              </div>
              <ContactForm linkedin={profile.linkedin} />
            </div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-8 text-sm text-ink-soft">
          <p>{profile.name}</p>
          <a href={profile.resumePdf} download="Nishant_Kannan_Resume.pdf" className="underline-offset-4 hover:text-ink hover:underline">
            Download resume (PDF)
          </a>
        </footer>
      </div>
    </>
  );
}
