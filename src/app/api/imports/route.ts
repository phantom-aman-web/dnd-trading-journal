import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { parseRawImportFile } from "@/lib/import-parser";

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

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { filename, source, content, selectedSheet } = body;
  if (!filename || !content) return bad("filename and content are required");

  const parsed = parseRawImportFile(content, filename, selectedSheet);
  const { headers, rows, detectedFormat, detectedPresetId, sheetNames, activeSheet } = parsed;

  const importRecord = await db.import.create({
    data: {
      userId: user.id,
      source: source ?? detectedFormat ?? "csv",
      filename,
      status: "uploaded",
      rowCount: rows.length,
      summaryJson: JSON.stringify({
        headers,
        sampleRows: rows.slice(0, 5),
        detectedFormat,
        detectedPresetId,
        sheetNames,
        activeSheet,
      }),
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
  await audit("import.uploaded", "import", importRecord.id, { filename, detectedFormat, rowCount: rows.length });
  return ok(importRecord);
}
