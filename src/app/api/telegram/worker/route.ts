import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { processDueJobs } from "@/lib/telegram/delivery-engine";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function safeCompare(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  // Reject insecure credentials in query string
  if (
    req.nextUrl.searchParams.has("secret") ||
    req.nextUrl.searchParams.has("token") ||
    req.nextUrl.searchParams.has("worker_secret")
  ) {
    return NextResponse.json(
      {
        error: "Insecure credential transmission",
        message:
          "Worker secrets must never appear in URL query parameters. Pass credentials via 'Authorization: Bearer <TELEGRAM_WORKER_SECRET>' header over HTTPS.",
      },
      { status: 401 }
    );
  }

  const authHeader = req.headers.get("authorization")?.trim();
  const secretHeader = req.headers.get("x-worker-secret")?.trim();

  // Vercel Cron automatically attaches Authorization: Bearer <CRON_SECRET>
  // We also support explicitly configured TELEGRAM_WORKER_SECRET
  const cronSecret = process.env.CRON_SECRET?.trim();
  const workerSecret = process.env.TELEGRAM_WORKER_SECRET?.trim();

  let isSystemWorker = false;

  // 1. Check CRON_SECRET (Vercel standard)
  if (cronSecret && cronSecret.length > 0) {
    if (safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      isSystemWorker = true;
    }
  }

  // 2. Check TELEGRAM_WORKER_SECRET (custom bearer or x-worker-secret header)
  if (!isSystemWorker && workerSecret && workerSecret.length > 0) {
    if (safeCompare(authHeader, `Bearer ${workerSecret}`)) {
      isSystemWorker = true;
    } else if (safeCompare(secretHeader, workerSecret)) {
      isSystemWorker = true;
    }
  }

  // If secret credentials were provided in the request but failed validation, fail closed immediately
  if (!isSystemWorker && (authHeader || secretHeader)) {
    return NextResponse.json(
      {
        error: "Unauthorized worker invocation",
        message: "Invalid cron or worker secret provided.",
      },
      { status: 401 }
    );
  }

  // 3. User session check: A normal authenticated user session is restricted to their own jobs
  let sessionUserId: string | null = null;
  if (!isSystemWorker) {
    try {
      const user = await getSessionUser();
      if (user) {
        sessionUserId = user.id;
      }
    } catch {}
  }

  // 4. Local development bypass ONLY if explicitly NODE_ENV === 'development' and no secrets are set
  let isDevBypass = false;
  if (!isSystemWorker && !sessionUserId && process.env.NODE_ENV === "development" && !cronSecret && !workerSecret) {
    isDevBypass = true;
  }

  // Fail closed if unauthorized
  if (!isSystemWorker && !sessionUserId && !isDevBypass) {
    return NextResponse.json(
      {
        error: "Unauthorized worker invocation",
        message: "Valid Bearer token (CRON_SECRET or TELEGRAM_WORKER_SECRET) required for system worker.",
      },
      { status: 401 }
    );
  }

  try {
    // CRITICAL SECURITY ENFORCEMENT:
    // Global batch processing across all users is ONLY permitted for authorized system workers (or dev bypass).
    // An ordinary authenticated user session can NEVER invoke global batch processing and is strictly scoped to their own userId.
    const scopedUser = isSystemWorker || isDevBypass ? undefined : (sessionUserId || undefined);

    const result = await processDueJobs(10, scopedUser);
    return NextResponse.json({
      success: true,
      result,
      isSystemWorker,
      scopedUserId: scopedUser || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Worker execution failed", message: err?.message },
      { status: 500 }
    );
  }
}

/**
 * Vercel Cron and external schedulers (cron-job.org) invoke configured worker using HTTP GET.
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
