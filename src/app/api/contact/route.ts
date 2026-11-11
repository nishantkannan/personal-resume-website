import { Resend } from "resend";
import { contactSchema, type FieldErrors } from "@/lib/contact-schema";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/*
 * Basic per-visitor rate limit. It lives in memory, so it resets when the serverless
 * function restarts and isn't shared between instances. That's enough to stop casual
 * repeat sends; swap in Upstash or Vercel KV if the form ever gets real abuse.
 */
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

function json(body: unknown, status: number) {
  return Response.json(body, { status });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (rateLimited(ip)) {
    return json({ error: "Too many messages from this connection. Try again in 10 minutes." }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "The form data couldn't be read. Reload the page and try again." }, 400);
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "name" || key === "email" || key === "message") && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    // A filled honeypot means a bot. Pretend it worked so it doesn't retry.
    if (Object.keys(fieldErrors).length === 0) return json({ ok: true }, 200);
    return json({ error: "Some fields need fixing.", fieldErrors }, 400);
  }

  const { name, email, message } = parsed.data;
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL || "Resume site <onboarding@resend.dev>";

  if (!apiKey || !to) {
    console.error("Contact form is missing RESEND_API_KEY or CONTACT_TO_EMAIL.");
    return json(
      { error: "The contact form isn't set up yet. Reach me on LinkedIn instead." },
      503,
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: email,
    subject: `Resume site: message from ${name}`,
    text: `${message}\n\nFrom: ${name} <${email}>`,
    html: `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p><p>From: ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>`,
  });

  if (error) {
    console.error("Resend error:", error);
    return json({ error: "The message didn't send. Try again, or reach me on LinkedIn." }, 502);
  }

  return json({ ok: true }, 200);
}
