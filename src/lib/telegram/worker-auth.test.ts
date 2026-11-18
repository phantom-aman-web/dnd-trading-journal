import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { POST, GET } from "@/app/api/telegram/worker/route";
import { NextRequest } from "next/server";

describe("Worker Route Authorization & Tenant Scoping", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.CRON_SECRET = "test-cron-secret-32chars-secure";
    process.env.TELEGRAM_WORKER_SECRET = "test-worker-secret-24chars";
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("rejects unauthorized requests in production with 401", async () => {
    const req = new NextRequest("https://alphapips.com/api/telegram/worker", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized worker invocation");
  });

  it("rejects invalid secret tokens with 401", async () => {
    const req = new NextRequest("https://alphapips.com/api/telegram/worker", {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-secret-token",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toContain("Invalid cron or worker secret");
  });

  it("accepts valid Vercel CRON_SECRET via Authorization: Bearer", async () => {
    const req = new NextRequest("https://alphapips.com/api/telegram/worker", {
      method: "GET",
      headers: {
        authorization: "Bearer test-cron-secret-32chars-secure",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.isSystemWorker).toBe(true);
    expect(json.scopedUserId).toBeNull(); // Global system run
  });

  it("accepts valid TELEGRAM_WORKER_SECRET via x-worker-secret header", async () => {
    const req = new NextRequest("https://alphapips.com/api/telegram/worker", {
      method: "POST",
      headers: {
        "x-worker-secret": "test-worker-secret-24chars",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.isSystemWorker).toBe(true);
    expect(json.scopedUserId).toBeNull(); // Global system run
  });

  it("accepts valid TELEGRAM_WORKER_SECRET via HTTP GET with Authorization: Bearer (cron-job.org)", async () => {
    const req = new NextRequest("https://alphapips.com/api/telegram/worker", {
      method: "GET",
      headers: {
        authorization: "Bearer test-worker-secret-24chars",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.isSystemWorker).toBe(true);
    expect(json.scopedUserId).toBeNull();
    expect(json.result).toBeDefined();
    expect(typeof json.result.claimed).toBe("number");
    expect(typeof json.result.delivered).toBe("number");
  });

  it("rejects secrets passed in query string with 401 to prevent URL credential leakage", async () => {
    const req = new NextRequest("https://alphapips.com/api/telegram/worker?secret=test-worker-secret-24chars", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Insecure credential transmission");
    expect(json.message).toContain("must never appear in URL query parameters");
  });
});
