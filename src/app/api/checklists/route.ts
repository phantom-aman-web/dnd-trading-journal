import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const items = await db.checklistConfig.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { versions: { orderBy: { effectiveDate: "desc" } } },
  });
  return ok({ items });
}

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { name, description, items: itemArr, gradingThresholds } = body;
  if (!name) return bad("Name is required");
  const checklist = await db.checklistConfig.create({
    data: {
      userId: user.id,
      name,
      description,
      versions: {
        create: [
          {
            versionLabel: "1.0",
            itemsJson: JSON.stringify(itemArr ?? []),
            gradingThresholdsJson: gradingThresholds ? JSON.stringify(gradingThresholds) : null,
            effectiveDate: new Date(),
          },
        ],
      },
    },
    include: { versions: true },
  });
  return ok(checklist);
}
