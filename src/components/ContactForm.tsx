"use client";

import { useState, type FormEvent } from "react";
import { contactSchema, type FieldErrors } from "@/lib/contact-schema";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; name: string }
  | { kind: "error"; message: string };

const fieldClass =
  "mt-1.5 w-full rounded-md border bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink-soft/70 focus:border-contour focus:outline-none focus-visible:outline-2 focus-visible:outline-contour";

export function ContactForm({ linkedin }: { linkedin: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [errors, setErrors] = useState<FieldErrors>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;

    const check = contactSchema.safeParse(data);
    if (!check.success) {
      const next: FieldErrors = {};
      for (const issue of check.error.issues) {
        const k = issue.path[0];
        if ((k === "name" || k === "email" || k === "message") && !next[k]) next[k] = issue.message;
      }
      setErrors(next);
      const first = (["name", "email", "message"] as const).find((k) => next[k]);
      if (first) (form.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }

    setErrors({});
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus({ kind: "sent", name: check.data.name.split(" ")[0] });
        form.reset();
      } else {
        if (body.fieldErrors) setErrors(body.fieldErrors);
        setStatus({ kind: "error", message: body.error ?? "The message didn't send. Try again." });
      }
    } catch {
      setStatus({ kind: "error", message: "No connection to the server. Check your internet and try again." });
    }
  }

  if (status.kind === "sent") {
    return (
      <div role="status" className="max-w-[52ch] rounded-md border border-contour bg-surface p-6">
        <p className="text-lg font-semibold">Message sent. Thanks, {status.name}.</p>
        <p className="mt-2 text-ink-soft">I&apos;ll reply to the email address you gave, usually within a couple of days.</p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-4 font-semibold text-contour underline-offset-4 hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  const describe = (k: keyof FieldErrors) => (errors[k] ? `${k}-error` : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-[52ch] flex-col gap-5">
      <div>
        <label htmlFor="name" className="font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describe("name")}
          className={`${fieldClass} ${errors.name ? "border-[#b4462f]" : "border-line"}`}
        />
        {errors.name && <FieldError id="name-error">{errors.name}</FieldError>}
      </div>

      <div>
        <label htmlFor="email" className="font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describe("email")}
          className={`${fieldClass} ${errors.email ? "border-[#b4462f]" : "border-line"}`}
        />
        {errors.email && <FieldError id="email-error">{errors.email}</FieldError>}
      </div>

      <div>
        <label htmlFor="message" className="font-medium">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describe("message")}
          className={`${fieldClass} resize-y ${errors.message ? "border-[#b4462f]" : "border-line"}`}
        />
        {errors.message && <FieldError id="message-error">{errors.message}</FieldError>}
      </div>

      {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {status.kind === "error" && (
        <p role="alert" className="rounded-md border border-[#b4462f] px-4 py-3 text-sm">
          {status.message}{" "}
          <a href={linkedin} className="font-semibold text-contour underline underline-offset-4">
            Open LinkedIn
          </a>
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={status.kind === "sending"}
          className="rounded-full bg-contour px-6 py-3 font-semibold text-bg transition-colors hover:bg-contour-strong disabled:opacity-60"
        >
          {status.kind === "sending" ? "Sending message…" : "Send message"}
        </button>
      </div>
    </form>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-[#b4462f] dark:text-[#f0a08e]">
      {children}
    </p>
  );
}
