import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, createSessionToken, setSessionCookie, clearSessionCookie, getSessionUser } from "@/lib/auth";
import { ok, bad, unauthorized, toApiError, parseJson, rateLimit } from "@/lib/api";
import { auditForUser } from "@/lib/audit";
import { CURRENT_VERSIONS } from "@/lib/legal-versions";

/**
 * Signup schema — Terms + Privacy acceptance is REQUIRED server-side.
 *
 * A malicious client cannot bypass this: even if they POST directly without
 * the checkboxes, the Zod parse fails with a 400 before the user is created.
 * The version fields pin the acceptance to the current policy version so we
 * know exactly what the user agreed to.
 */
const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the Terms of Service." }),
  }),
  acknowledgePrivacy: z.literal(true, {
    errorMap: () => ({ message: "You must acknowledge the Privacy Policy." }),
  }),
  // Versions are informational — we always pin to CURRENT_VERSIONS on the
  // server, so a client cannot claim to have accepted a different version.
  termsVersion: z.string().optional(),
  privacyVersion: z.string().optional(),
});

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "signin";

  if (mode === "signup") {
    if (!rateLimit(`signup:${req.headers.get("x-forwarded-for") ?? "anon"}`, 5, 60_000)) {
      return bad("Too many attempts. Try again in a minute.");
    }
    const parsed = SignUpSchema.safeParse(body);
    if (!parsed.success) return bad("Invalid input", parsed.error.flatten());
    const { email, password, name } = parsed.data;
    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return bad("An account with that email already exists.");
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash: await hashPassword(password),
      },
    });
    await db.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, timezone: "UTC", theme: "nordic" },
    });
    await db.notificationPreferences.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        prefsJson: JSON.stringify({
          trading: { sessionReminder: true, dailyPlan: true, dailyLoss: true },
          journal: { incompleteTrade: true, eodReminder: true, weeklyReview: true },
          system: { importCompleted: true, uploadCompleted: false, syncConflict: true },
          quietHours: { enabled: false, start: "22:00", end: "07:00" },
        }),
      },
    });

    // Record legal acceptance — Terms + Privacy, pinned to the CURRENT server
    // versions. Non-destructive (creates rows, never overwrites).
    await db.legalAcceptance.createMany({
      data: [
        { userId: user.id, docType: "terms", version: CURRENT_VERSIONS.terms },
        { userId: user.id, docType: "privacy", version: CURRENT_VERSIONS.privacy },
      ],
    });

    const token = await createSessionToken({ sub: user.id, email: user.email });
    await setSessionCookie(token);
    await auditForUser(user.id, "user.signup", "user", user.id);
    return ok({ user: { id: user.id, email: user.email, name: user.name } });
  }

  if (!rateLimit(`signin:${req.headers.get("x-forwarded-for") ?? "anon"}`, 10, 60_000)) {
    return bad("Too many attempts. Try again in a minute.");
  }
  const parsed = SignInSchema.safeParse(body);
  if (!parsed.success) return bad("Invalid input", parsed.error.flatten());
  const { email, password } = parsed.data;
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return unauthorized("Invalid email or password");
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return unauthorized("Invalid email or password");
  const token = await createSessionToken({ sub: user.id, email: user.email });
  await setSessionCookie(token);
  await auditForUser(user.id, "user.signin", "user", user.id);
  return ok({ user: { id: user.id, email: user.email, name: user.name } });
}

export async function DELETE() {
  await clearSessionCookie();
  return ok({ ok: true });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return ok({ user });
}
