import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";

    if (!query || query.length < 1) {
      return NextResponse.json({
        trades: [],
        observations: [],
        strategies: [],
        strategyVersions: [],
        accounts: [],
        tasks: [],
        dictionary: [],
      });
    }

    const qLower = query.toLowerCase();

    // Query all entities in parallel with user scoping
    const [trades, observations, strategies, strategyVersions, accounts, tasks, dictionary] = await Promise.all([
      // 1. Trades
      (db as any).trade.findMany({
        where: {
          userId: user.id,
          isArchived: false,
          OR: [
            { instrumentSymbol: { contains: qLower, mode: "insensitive" } },
            { notes: { contains: qLower, mode: "insensitive" } },
            { setupGrade: { contains: qLower, mode: "insensitive" } },
            { session: { contains: qLower, mode: "insensitive" } },
            { direction: { contains: qLower, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          instrumentSymbol: true,
          direction: true,
          status: true,
          netPnlCents: true,
          setupGrade: true,
          entryTime: true,
          session: true,
        },
        orderBy: { entryTime: "desc" },
        take: 6,
      }),

      // 2. No-Trade Observations (using actual schema fields)
      (db as any).noTradeEntry.findMany({
        where: {
          userId: user.id,
          isArchived: false,
          OR: [
            { instrumentSymbol: { contains: qLower, mode: "insensitive" } },
            { title: { contains: qLower, mode: "insensitive" } },
            { observation: { contains: qLower, mode: "insensitive" } },
            { reasonCategory: { contains: qLower, mode: "insensitive" } },
            { reasonNotes: { contains: qLower, mode: "insensitive" } },
            { session: { contains: qLower, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          instrumentSymbol: true,
          date: true,
          title: true,
          observation: true,
          reasonCategory: true,
          decisionType: true,
          status: true,
        },
        orderBy: { date: "desc" },
        take: 5,
      }),

      // 3. Setups & Strategies
      (db as any).strategy.findMany({
        where: {
          userId: user.id,
          isArchived: false,
          OR: [
            { name: { contains: qLower, mode: "insensitive" } },
            { description: { contains: qLower, mode: "insensitive" } },
            { market: { contains: qLower, mode: "insensitive" } },
            { instruments: { contains: qLower, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          market: true,
          description: true,
          timeframe: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),

      // 4. Strategy Versions
      (db as any).strategyVersion.findMany({
        where: {
          strategy: { userId: user.id, isArchived: false },
          OR: [
            { versionLabel: { contains: qLower, mode: "insensitive" } },
            { changeReason: { contains: qLower, mode: "insensitive" } },
            { changeSummary: { contains: qLower, mode: "insensitive" } },
            { rulesJson: { contains: qLower, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          strategyId: true,
          versionLabel: true,
          changeSummary: true,
          effectiveDate: true,
          status: true,
          strategy: { select: { id: true, name: true } },
        },
        orderBy: { effectiveDate: "desc" },
        take: 4,
      }),

      // 5. Accounts
      (db as any).tradingAccount.findMany({
        where: {
          userId: user.id,
          isArchived: false,
          OR: [
            { name: { contains: qLower, mode: "insensitive" } },
            { broker: { contains: qLower, mode: "insensitive" } },
            { accountType: { contains: qLower, mode: "insensitive" } },
            { currency: { contains: qLower, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          broker: true,
          accountType: true,
          currency: true,
          startingBalanceCents: true,
          currentBalanceCents: true,
        },
        take: 5,
      }),

      // 6. Tasks
      (db as any).tradingTask.findMany({
        where: {
          userId: user.id,
          isArchived: false,
          OR: [
            { title: { contains: qLower, mode: "insensitive" } },
            { description: { contains: qLower, mode: "insensitive" } },
            { listName: { contains: qLower, mode: "insensitive" } },
            { instrumentSymbol: { contains: qLower, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          listName: true,
          dueDate: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // 7. Strategy Dictionary Entries
      (db as any).strategyDictionaryEntry.findMany({
        where: {
          userId: user.id,
          OR: [
            { term: { contains: qLower, mode: "insensitive" } },
            { abbreviation: { contains: qLower, mode: "insensitive" } },
            { category: { contains: qLower, mode: "insensitive" } },
            { definition: { contains: qLower, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          term: true,
          abbreviation: true,
          category: true,
          definition: true,
        },
        take: 4,
      }),
    ]);

    return NextResponse.json({
      trades,
      observations,
      strategies,
      strategyVersions,
      accounts,
      tasks,
      dictionary,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err.message || "Failed to execute search" },
      { status: 500 }
    );
  }
}
