import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const items = await db.import.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { rows: true },
  });
  return ok({ items });
}

// Parse CSV into rows for preview (spec section 84)
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  });
  return { headers, rows };
}

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { filename, source, content } = body;
  if (!filename || !content) return bad("filename and content are required");
  const { headers, rows } = parseCsv(content);
  const importRecord = await db.import.create({
    data: {
      userId: user.id,
      source: source ?? "csv",
      filename,
      status: "uploaded",
      rowCount: rows.length,
      summaryJson: JSON.stringify({ headers, sampleRows: rows.slice(0, 5) }),
      rows: {
        create: rows.map((r, i) => ({
          rowIndex: i,
          rawJson: JSON.stringify(r),
          status: "pending",
        })),
      },
    },
    include: { rows: true },
  });
  await audit("import.uploaded", "import", importRecord.id, { filename });
  return ok(importRecord);
}
