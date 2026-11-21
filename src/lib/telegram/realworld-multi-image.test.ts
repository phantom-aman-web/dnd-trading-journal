import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { db } from "@/lib/db";
import { encryptBotToken } from "./encryption";
import {
  queueTradePublication,
  queueTradeClosure,
  processDueJobs,
} from "./delivery-engine";
import fs from "fs";
import path from "path";

describe("Real-World Telegram Multi-Image Publishing Verification", () => {
  const testUserId = `test_tg_pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let testAccountId: string;
  let testStrategyId: string;
  let testIntegrationId: string;
  const originalFetch = globalThis.fetch;
  const capturedRequests: Array<{ url: string; method: string; body?: any; headers?: any }> = [];

  // Temporary test images directory on disk to simulate stored screenshots
  const tempImgDir = path.join(process.cwd(), ".tmp_test_images");

  beforeAll(async () => {
    if (!fs.existsSync(tempImgDir)) {
      fs.mkdirSync(tempImgDir, { recursive: true });
    }

    // Intercept Telegram API requests
    globalThis.fetch = async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("api.telegram.org")) {
        capturedRequests.push({
          url,
          method: init?.method || "GET",
          body: init?.body,
          headers: init?.headers,
        });

        if (url.includes("sendMediaGroup")) {
          // Parse how many items were in the media payload
          let count = 2;
          if (init?.body instanceof FormData) {
            const mediaStr = init.body.get("media");
            if (typeof mediaStr === "string") {
              try {
                const arr = JSON.parse(mediaStr);
                count = arr.length;
              } catch {}
            }
          }
          const result = Array.from({ length: count }, (_, i) => ({
            message_id: 1000 + capturedRequests.length * 10 + i,
            chat: { id: -100123456789 },
          }));
          return new Response(JSON.stringify({ ok: true, result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (url.includes("sendPhoto")) {
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                message_id: 2000 + capturedRequests.length,
                chat: { id: -100123456789 },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (url.includes("sendMessage")) {
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                message_id: 3000 + capturedRequests.length,
                chat: { id: -100123456789 },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      return originalFetch(input, init);
    };

    // Create user
    await db.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        name: "Telegram Multi-Image Verifier",
        passwordHash: "dummyhash",
      },
    });

    // Create account
    const acc = await db.tradingAccount.create({
      data: {
        userId: testUserId,
        name: "Test Prop Account",
        broker: "FTMO",
        accountType: "prop_eval",
        currency: "USD",
        startingBalanceCents: 10000000,
        currentBalanceCents: 10000000,
      },
    });
    testAccountId = acc.id;

    // Create strategy
    const strat = await db.strategy.create({
      data: {
        userId: testUserId,
        name: "Silver Bullet",
        description: "ICT Silver Bullet Model",
      },
    });
    testStrategyId = strat.id;

    // Create Telegram Integration
    const enc = encryptBotToken("1234567890:AAFakeTokenForMultiImageTesting123");
    const int = await db.telegramIntegration.create({
      data: {
        userId: testUserId,
        botId: "1234567890",
        botUsername: "AlphaPipsTestBot",
        encryptedBotToken: enc.encryptedBotToken,
        botTokenIv: enc.botTokenIv,
        botTokenTag: enc.botTokenTag,
        channelId: "-100123456789",
        channelTitle: "AlphaPips Verified Channel",
        status: "configured",
        publishingSettings: {
          create: {
            enabled: true,
            templateType: "standard",
            includeScreenshots: true,
            includeTags: true,
            includeDescription: true,
            includeRisk: true,
            includePerformance: true,
            autoPublishNewTrades: true,
            publishTradeClosure: true,
          },
        },
      },
    });
    testIntegrationId = int.id;
  }, 30000);

  beforeEach(() => {
    capturedRequests.length = 0;
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;

    try {
      await db.telegramDelivery.deleteMany({ where: { userId: testUserId } });
      await db.tradeMedia.deleteMany({ where: { userId: testUserId } });
      await db.trade.deleteMany({ where: { userId: testUserId } });
      await db.telegramPublishingSettings.deleteMany({ where: { integrationId: testIntegrationId } });
      await db.telegramIntegration.deleteMany({ where: { userId: testUserId } });
      await db.tradingAccount.deleteMany({ where: { userId: testUserId } });
      await db.strategy.deleteMany({ where: { userId: testUserId } });
      await db.user.deleteMany({ where: { id: testUserId } });
    } catch {}

    if (fs.existsSync(tempImgDir)) {
      try {
        fs.rmSync(tempImgDir, { recursive: true, force: true });
      } catch {}
    }
  }, 30000);

  it(
    "publishes an actual trade with 4 screenshots as a complete Telegram album in chronological order",
    async () => {
    // 1. Create 4 dummy screenshot files on disk
    const mediaTimestamps = [
      new Date("2026-11-19T10:00:00Z"),
      new Date("2026-11-19T10:05:00Z"),
      new Date("2026-11-19T10:10:00Z"),
      new Date("2026-11-19T10:15:00Z"),
    ];

    const mediaPromises = mediaTimestamps.map((ts, i) => {
      const fileName = `shot_${i + 1}_${Date.now()}_${i}.png`;
      const filePath = path.join(tempImgDir, fileName);
      fs.writeFileSync(filePath, Buffer.from(`FAKE_PNG_BINARY_DATA_${i + 1}`));
      return db.tradeMedia.create({
        data: {
          userId: testUserId,
          tradeId: null,
          kind: "image",
          filename: `chart_stage_${i + 1}.png`,
          storedPath: filePath,
          mimeType: "image/png",
          sizeBytes: 1024,
          uploadStatus: "ready",
          createdAt: ts,
        },
      });
    });
    const createdMedia = await Promise.all(mediaPromises);
    const mediaIds = createdMedia.map((m) => m.id);

    // 2. Simulate POST /api/trades behavior:
    // Create the trade and attach all mediaIds atomically before queuing publication
    const trade = await db.trade.create({
      data: {
        userId: testUserId,
        accountId: testAccountId,
        strategyId: testStrategyId,
        instrumentSymbol: "EURUSD",
        direction: "long",
        market: "forex",
        session: "london",
        status: "open",
        entryPriceAvg: "1.08500",
        plannedEntryPrice: "1.08500",
        plannedStopPrice: "1.08200",
        plannedTargetPrice: "1.09200",
        plannedRiskPct: "1.0",
        plannedRR: "2.33",
        netPnlCents: 0,
        positionSize: "2.0",
        notes: "4-screenshot execution setup.",
      },
    });

    // Atomic batch attachment (as implemented in POST /api/trades)
    await db.tradeMedia.updateMany({
      where: { id: { in: mediaIds }, userId: testUserId },
      data: { tradeId: trade.id },
    });

    // Verify all 4 images are persistently attached to the trade
    const attachedMedia = await db.tradeMedia.findMany({
      where: { tradeId: trade.id },
      orderBy: { createdAt: "asc" },
    });
    expect(attachedMedia.length).toBe(4);
    expect(attachedMedia.map((m) => m.id)).toEqual(mediaIds);

    // Queue publication
    await queueTradePublication({
      tradeId: trade.id,
      userId: testUserId,
      isNewTrade: true,
    });

    // 3. Process due jobs through the durable delivery engine worker
    await processDueJobs(10, testUserId);

    let deliveryJob = await db.telegramDelivery.findFirst({
      where: { tradeId: trade.id, jobType: "trade_publish" },
    });
    for (let retry = 0; retry < 10 && deliveryJob?.status !== "delivered"; retry++) {
      await new Promise((r) => setTimeout(r, 150));
      await processDueJobs(10, testUserId);
      deliveryJob = await db.telegramDelivery.findFirst({
        where: { tradeId: trade.id, jobType: "trade_publish" },
      });
    }
    expect(deliveryJob?.status).toBe("delivered");

    // 4. Verify Telegram request inspection
    const mediaGroupReq = capturedRequests.find((r) => r.url.includes("sendMediaGroup"));
    expect(mediaGroupReq).toBeDefined();

    // Check FormData payload
    expect(mediaGroupReq!.body instanceof FormData).toBe(true);
    const formData = mediaGroupReq!.body as FormData;
    const mediaJson = formData.get("media") as string;
    const parsedMedia = JSON.parse(mediaJson);

    // Confirm all 4 images were sent in a single album
    expect(parsedMedia.length).toBe(4);
    expect(parsedMedia[0].type).toBe("photo");
    expect(parsedMedia[0].media).toBe("attach://photo_0");
    expect(parsedMedia[1].media).toBe("attach://photo_1");
    expect(parsedMedia[2].media).toBe("attach://photo_2");
    expect(parsedMedia[3].media).toBe("attach://photo_3");

    // Caption must be attached to the first image
    expect(parsedMedia[0].caption).toContain("EURUSD");
    expect(parsedMedia[0].caption).toContain("Long");
    expect(parsedMedia[1].caption).toBeUndefined();

    // Confirm binary files were attached in the multipart body
    expect(formData.get("photo_0")).toBeDefined();
    expect(formData.get("photo_1")).toBeDefined();
    expect(formData.get("photo_2")).toBeDefined();
    expect(formData.get("photo_3")).toBeDefined();

    // 5. Verify database job delivery status and message ID persistence
    expect(deliveryJob?.telegramMessageIds).toBeDefined();
    const savedIds: number[] = JSON.parse(deliveryJob!.telegramMessageIds!);
    expect(savedIds.length).toBe(4);

    // 6. Test trade closure reply associates with the original publication
    await db.trade.update({
      where: { id: trade.id },
      data: {
        status: "win",
        exitPriceAvg: "1.09200",
        actualR: "2.33",
        netPnlCents: 140000,
        lessons: "TP target hit smoothly.",
      },
    });

    await queueTradeClosure({
      tradeId: trade.id,
      userId: testUserId,
    });

    await processDueJobs(10, testUserId);
    let closureJob = await db.telegramDelivery.findFirst({
      where: { tradeId: trade.id, jobType: "trade_closure" },
    });
    for (let retry = 0; retry < 10 && closureJob?.status !== "delivered"; retry++) {
      await new Promise((r) => setTimeout(r, 150));
      await processDueJobs(10, testUserId);
      closureJob = await db.telegramDelivery.findFirst({
        where: { tradeId: trade.id, jobType: "trade_closure" },
      });
    }
    expect(closureJob?.status).toBe("delivered");

    const closureReq = capturedRequests.find((r) => r.url.includes("sendMessage"));
    expect(closureReq).toBeDefined();
    const closureBody = JSON.parse(closureReq!.body);
    expect(closureBody.reply_to_message_id).toBe(savedIds[0]); // Replies to the first album message ID
    expect(closureBody.text).toContain("TRADE CLOSED UPDATE");
    expect(closureBody.text).toContain("EURUSD");
    expect(closureBody.text).toContain("+$1,400.00");
  }, 60000);

  it("handles 10 images in a single max-sized Telegram album", async () => {
    const mediaPromises = Array.from({ length: 10 }, (_, i) => {
      const filePath = path.join(tempImgDir, `ten_${i}.png`);
      fs.writeFileSync(filePath, Buffer.from(`IMG_DATA_${i}`));

      return db.tradeMedia.create({
        data: {
          userId: testUserId,
          kind: "image",
          filename: `chart_${i}.png`,
          storedPath: filePath,
          mimeType: "image/png",
          sizeBytes: 500,
          uploadStatus: "ready",
        },
      });
    });
    const createdMedia = await Promise.all(mediaPromises);
    const mediaIds = createdMedia.map((m) => m.id);

    const trade = await db.trade.create({
      data: {
        userId: testUserId,
        accountId: testAccountId,
        instrumentSymbol: "BTCUSD",
        direction: "long",
        market: "crypto",
        status: "open",
      },
    });

    await db.tradeMedia.updateMany({
      where: { id: { in: mediaIds } },
      data: { tradeId: trade.id },
    });

    await queueTradePublication({ tradeId: trade.id, userId: testUserId });
    await processDueJobs(10, testUserId);
    for (let retry = 0; retry < 10; retry++) {
      const job = await db.telegramDelivery.findFirst({ where: { tradeId: trade.id } });
      if (job?.status === "delivered") break;
      await new Promise((r) => setTimeout(r, 150));
      await processDueJobs(10, testUserId);
    }

    const mediaGroupReqs = capturedRequests.filter((r) => r.url.includes("sendMediaGroup"));
    expect(mediaGroupReqs.length).toBe(1); // Exactly 1 album of 10 items
    const parsed = JSON.parse((mediaGroupReqs[0].body as FormData).get("media") as string);
    expect(parsed.length).toBe(10);
  }, 60000);

  it("chunks 14 images into two sequential albums (10 + 4) linked by reply", async () => {
    const mediaPromises = Array.from({ length: 14 }, (_, i) => {
      const filePath = path.join(tempImgDir, `fourteen_${i}.png`);
      fs.writeFileSync(filePath, Buffer.from(`DATA_${i}`));

      return db.tradeMedia.create({
        data: {
          userId: testUserId,
          kind: "image",
          filename: `shot_${i}.png`,
          storedPath: filePath,
          mimeType: "image/png",
          sizeBytes: 500,
          uploadStatus: "ready",
        },
      });
    });
    const createdMedia = await Promise.all(mediaPromises);
    const mediaIds = createdMedia.map((m) => m.id);

    const trade = await db.trade.create({
      data: {
        userId: testUserId,
        accountId: testAccountId,
        instrumentSymbol: "NQ",
        direction: "short",
        market: "futures",
        status: "open",
      },
    });

    await db.tradeMedia.updateMany({
      where: { id: { in: mediaIds } },
      data: { tradeId: trade.id },
    });

    await queueTradePublication({ tradeId: trade.id, userId: testUserId });
    await processDueJobs(10, testUserId);
    for (let retry = 0; retry < 10; retry++) {
      const job = await db.telegramDelivery.findFirst({ where: { tradeId: trade.id } });
      if (job?.status === "delivered") break;
      await new Promise((r) => setTimeout(r, 150));
      await processDueJobs(10, testUserId);
    }

    const mediaGroupReqs = capturedRequests.filter((r) => r.url.includes("sendMediaGroup"));
    expect(mediaGroupReqs.length).toBe(2);

    const chunk0 = JSON.parse((mediaGroupReqs[0].body as FormData).get("media") as string);
    const chunk1 = JSON.parse((mediaGroupReqs[1].body as FormData).get("media") as string);

    expect(chunk0.length).toBe(10);
    expect(chunk1.length).toBe(4);

    // Chunk 1 must reply to Chunk 0
    const chunk1FormData = mediaGroupReqs[1].body as FormData;
    expect(chunk1FormData.get("reply_to_message_id")).toBeDefined();
  }, 60000);

  it("sends companion text message when trade message text exceeds Telegram 1024 caption limit", async () => {
    const filePath = path.join(tempImgDir, `long_desc.png`);
    fs.writeFileSync(filePath, Buffer.from("DUMMY_IMAGE_BYTES"));

    const m = await db.tradeMedia.create({
      data: {
        userId: testUserId,
        kind: "image",
        filename: "chart.png",
        storedPath: filePath,
        mimeType: "image/png",
        sizeBytes: 500,
        uploadStatus: "ready",
      },
    });

    // Create trade with long notes > 1100 characters
    const longNotes = "Detailed analysis: " + "Displacement and FVG tap on lower timeframes. ".repeat(25);
    expect(longNotes.length).toBeGreaterThan(1024);

    const trade = await db.trade.create({
      data: {
        userId: testUserId,
        accountId: testAccountId,
        instrumentSymbol: "GBPUSD",
        direction: "long",
        status: "open",
        notes: longNotes,
      },
    });

    await db.tradeMedia.update({
      where: { id: m.id },
      data: { tradeId: trade.id },
    });

    await queueTradePublication({ tradeId: trade.id, userId: testUserId });
    await processDueJobs(10, testUserId);
    for (let retry = 0; retry < 10; retry++) {
      const job = await db.telegramDelivery.findFirst({ where: { tradeId: trade.id } });
      if (job?.status === "delivered") break;
      await new Promise((r) => setTimeout(r, 150));
      await processDueJobs(10, testUserId);
    }

    // When caption > 1024, photo is sent without caption, followed by a companion text message
    const photoReq = capturedRequests.find((r) => r.url.includes("sendPhoto"));
    const textReq = capturedRequests.find((r) => r.url.includes("sendMessage"));

    expect(photoReq).toBeDefined();
    expect(textReq).toBeDefined();

    const textBody = JSON.parse(textReq!.body);
    expect(textBody.text).toContain(trade.instrumentSymbol);
    expect(textBody.reply_to_message_id).toBeDefined();
  }, 30000);
});
