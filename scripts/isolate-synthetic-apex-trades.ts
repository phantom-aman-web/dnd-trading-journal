import { db } from "../src/lib/db";
import { auditForUser } from "../src/lib/audit";

async function main() {
  const accountId = "cmwlbqaql0001whx0h3hpeav0";
  console.log(`Checking trades for account: ${accountId}`);

  const trades = await db.trade.findMany({
    where: { accountId },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${trades.length} trades for account ${accountId}.`);

  for (const t of trades) {
    let tags: string[] = [];
    try {
      tags = JSON.parse(t.tagsJson || "[]");
      if (!Array.isArray(tags)) tags = [];
    } catch {
      tags = [];
    }

    const tagsToAdd = ["synthetic_sample", "demo", "apex_repair_isolation"];
    for (const tag of tagsToAdd) {
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }

    const auditNotice = "[AUDIT: SYNTHETIC_SAMPLE_RECORD - Isolated from genuine prop challenge statistics]";
    let updatedNotes = t.notes || "";
    if (!updatedNotes.includes("SYNTHETIC_SAMPLE_RECORD")) {
      updatedNotes = updatedNotes ? `${updatedNotes}\n${auditNotice}` : auditNotice;
    }

    await db.trade.update({
      where: { id: t.id },
      data: {
        tagsJson: JSON.stringify(tags),
        notes: updatedNotes,
      },
    });

    await auditForUser(
      t.userId,
      "trade.isolated_synthetic",
      "Trade",
      t.id,
      {
        accountId,
        tags,
        reason: "Isolated synthesized demo trade from genuine prop challenge statistics",
      }
    );

    console.log(`Isolated trade ${t.id} (${t.instrumentSymbol} ${t.direction})`);
  }

  console.log("Successfully tagged and isolated all synthetic trades.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
