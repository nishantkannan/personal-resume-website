# Nishant Kannan: resume website

My personal resume site: an interactive 3D "data terrain" whose peaks are real career results, a skill filter that lights up the work where each skill was used, a downloadable PDF resume, and a contact form that emails me.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, React Three Fiber for the 3D, and Resend for email. Hosted on Vercel.

## Run it locally

You need Node.js 20.9 or newer (`brew install node`).

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

To test the contact form locally, copy `.env.example` to `.env.local` and fill in the values (see [Contact form](#contact-form)). Without them the form shows a "not set up yet" message instead of sending.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build (what Vercel runs) |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Check the code with ESLint |

## Edit my content

**All text lives in [`src/data/resume.ts`](src/data/resume.ts).** Edit it and the page updates; layout code doesn't need to change.

- `profile`: name, role, tagline, About paragraphs, LinkedIn and GitHub links.
- `highlights`: the results shown as peaks on the 3D terrain. `weight` (0 to 1) sets the peak's height; `target` is the `id` of the bullet or project the peak scrolls to. The terrain has room for up to 7 peaks.
- `skillGroups`: the skill chips. Each skill has an `id` that bullets refer to.
- `experience`: roles and bullets. Each bullet lists the skill `id`s it used; that's what powers the skill filter.
- `projects`, `education`, `certifications`.

**To update the PDF**, replace `public/resume.pdf` with the new file (keep the name).

## How it's put together

```
src/
  app/
    layout.tsx            fonts, metadata, light/dark theme bootstrap
    page.tsx              page sections
    globals.css           colour tokens (light + dark) and type styles
    api/contact/route.ts  contact form endpoint (validation, rate limit, Resend)
    icon.tsx              favicon, generated at build time
    opengraph-image.tsx   social share image, generated at build time
  components/
    HeroTerrain.tsx       results list + lazy-loads the 3D scene
    Terrain3D.tsx         the three.js terrain (React Three Fiber)
    WorkExplorer.tsx      skills, experience timeline and project, with the skill filter
    ContactForm.tsx       form with client-side checks and clear error states
    ThemeToggle.tsx
  data/resume.ts          all content
  lib/                    small helpers (theme, WebGL check, scroll-to-result, form schema)
public/resume.pdf
.claude/skills/frontend-design/   design guidance used to build the site
```

Design notes, so future changes stay consistent:

- **Palette** (in `globals.css`): Mist `#E9EEF0`, Basalt `#1F2B33`, Contour `#3E6F78`, Signal `#E3A81B` (results only), Shale `#56636B` (secondary text), Granite (rules only).
- **Type**: Archivo at an expanded width for headings, IBM Plex Sans for body text.
- **One bold element**: the 3D terrain. The rest of the page stays quiet. The terrain's rise on page load is the only motion that plays on its own; it's skipped for people who turn on reduced motion.
- **Performance**: three.js loads only once the terrain is on screen (and, on touch devices, after the first scroll or tap), so the first paint stays fast. Browsers without WebGL get a still version.

## Contact form

The form posts to `/api/contact`, which validates input on the server, drops bot submissions caught by a hidden honeypot field, limits each visitor to 5 messages per 10 minutes, and sends the message through [Resend](https://resend.com) with your visitor's address as reply-to. Your email address is never shown on the site.

Environment variables (also listed in [`.env.example`](.env.example)):

| Variable | Required | What it is |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes | API key from Resend |
| `CONTACT_TO_EMAIL` | Yes | The inbox that receives messages |
| `CONTACT_FROM_EMAIL` | No | Sender address. Leave blank to use Resend's test sender, which can only deliver to the email on your Resend account. Set it after verifying your own domain in Resend. |
| `NEXT_PUBLIC_SITE_URL` | No | Public URL for share links. Vercel sets this automatically unless you add a custom domain. |

The rate limit is kept in memory, so it resets when the serverless function restarts. That's fine for a personal site; switch to Upstash or Vercel KV if the form ever gets real abuse.

## Deployment

The site deploys on [Vercel](https://vercel.com) from this GitHub repo:

- Every push to `main` deploys to production automatically.
- Every pull request gets its own preview URL.

### One-time setup

1. **Create a Vercel account** at https://vercel.com/signup and choose **Continue with GitHub**.
2. **Import the repo**: on the Vercel dashboard, choose **Add New → Project**, find `personal-resume-website`, and select **Import**. Vercel detects Next.js; leave the build settings as they are.
3. **Set up Resend**:
   1. Create an account at https://resend.com.
   2. Go to **API Keys → Create API Key** and copy the key.
   3. Optional but recommended: under **Domains**, add a domain you own and follow its DNS steps, so you can send from your own address.
4. **Add environment variables** in Vercel: **Project → Settings → Environment Variables**. Add `RESEND_API_KEY` and `CONTACT_TO_EMAIL` (and `CONTACT_FROM_EMAIL` if you verified a domain), for Production and Preview.
5. **Deploy**: select **Deploy**, or redeploy from the **Deployments** tab if you added the variables after the first deploy. Your site will be at `https://<project-name>.vercel.app`.
6. **Optional custom domain**: **Project → Settings → Domains → Add**, then follow the DNS instructions. Afterward, set `NEXT_PUBLIC_SITE_URL` to the new address so share links use it.

Test the live contact form once after setup to confirm the email arrives.
