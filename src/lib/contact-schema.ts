import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100, "Keep your name under 100 characters."),
  email: z.string().trim().email("Enter an email address I can reply to, like name@company.com.").max(200),
  message: z
    .string()
    .trim()
    .min(10, "Write at least a sentence so I know what this is about.")
    .max(4000, "Keep the message under 4,000 characters."),
  /** Honeypot: hidden from people, so only bots fill it in. */
  website: z.string().max(0).optional().or(z.literal("")),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type FieldErrors = Partial<Record<"name" | "email" | "message", string>>;
