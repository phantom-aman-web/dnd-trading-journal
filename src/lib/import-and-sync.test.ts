import { describe, it, expect } from "bun:test";
import { parseRawImportFile, classifyDuplicateTrade } from "./import-parser";
import { verifyReadOnlyPermission, reconcileBrokerTrades, validateReplayAndSignature } from "./broker-sync";
import crypto from "crypto";

describe("Phase 2: Import & Broker Integrations Engine Tests", () => {
  it("parses standard CSV with quotes and decimal numbers correctly", () => {
    const csvContent = `Symbol,Direction,Entry Price,Exit Price,Quantity,Entry Time,Exit Time,Profit
"EURUSD","Long","1.08500","1.09200","1.50","2026-11-19 10:00:00","2026-11-19 12:00:00","1050.00"
"GBPUSD","Short","1.26500","1.26000","2.00","2026-11-19 14:00:00","2026-11-19 15:30:00","1000.00"`;

    const parsed = parseRawImportFile(csvContent, "trades.csv");
    expect(parsed.headers).toEqual(["Symbol", "Direction", "Entry Price", "Exit Price", "Quantity", "Entry Time", "Exit Time", "Profit"]);
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0]["Symbol"]).toBe("EURUSD");
    expect(parsed.rows[0]["Entry Price"]).toBe("1.08500");
    expect(parsed.rows[1]["Symbol"]).toBe("GBPUSD");
  });

  it("parses European semicolon-delimited CSV files accurately", () => {
    const semiContent = `Symbol;Direction;Entry Price;Exit Price;Profit
EURUSD;Long;1,0850;1,0920;700,00
XAUUSD;Long;2650,50;2670,00;1950,00`;

    const parsed = parseRawImportFile(semiContent, "european_export.csv");
    expect(parsed.detectedFormat).toBe("semicolon_csv");
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0]["Symbol"]).toBe("EURUSD");
    expect(parsed.rows[1]["Symbol"]).toBe("XAUUSD");
  });

  it("parses MT4/MT5 HTML Detailed Statements seamlessly", () => {
    const mtHtml = `
    <html>
      <body>
        <table>
          <tr><th>Ticket</th><th>Open Time</th><th>Type</th><th>Size</th><th>Item</th><th>Price</th><th>S / L</th><th>T / P</th><th>Close Time</th><th>Close Price</th><th>Commission</th><th>Swap</th><th>Profit</th></tr>
          <tr><td>78451230</td><td>2026.11.18 10:15:00</td><td>buy</td><td>2.00</td><td>EURUSD</td><td>1.08450</td><td>1.08150</td><td>1.09200</td><td>2026.11.18 13:20:00</td><td>1.09200</td><td>-10.00</td><td>0.00</td><td>1500.00</td></tr>
          <tr><td>78451231</td><td>2026.11.18 14:00:00</td><td>sell</td><td>1.00</td><td>GBPUSD</td><td>1.26400</td><td>1.26700</td><td>1.25800</td><td>2026.11.18 16:00:00</td><td>1.25800</td><td>-5.00</td><td>-2.50</td><td>600.00</td></tr>
        </table>
      </body>
    </html>`;

    const parsed = parseRawImportFile(mtHtml, "Statement.htm");
    expect(parsed.detectedFormat).toBe("mt4_mt5_html");
    expect(parsed.detectedPresetId).toBe("mt4_mt5");
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0]["Ticket"]).toBe("78451230");
    expect(parsed.rows[0]["Item"]).toBe("EURUSD");
    expect(parsed.rows[0]["Type"]).toBe("buy");
    expect(parsed.rows[0]["Profit"]).toBe("1500.00");
  });

  it("classifies duplicate trades with exact, likely, and conflict categories", () => {
    const existing = [
      {
        id: "trade_1",
        instrumentSymbol: "EURUSD",
        direction: "long",
        entryPriceAvg: "1.08500",
        entryTime: new Date("2026-11-19T10:00:00Z"),
        netPnlCents: 50000,
        externalTicketId: "1001",
      },
    ];

    // 1. Exact ticket match
    const exact = classifyDuplicateTrade(
      { externalTicketId: "1001", instrumentSymbol: "EURUSD", direction: "long", entryPrice: "1.08500" },
      existing
    );
    expect(exact.status).toBe("exact_duplicate");
    expect(exact.confidence).toBe(1.0);

    // 2. Ticket ID conflict (same ticket, different price)
    const conflict = classifyDuplicateTrade(
      { externalTicketId: "1001", instrumentSymbol: "EURUSD", direction: "long", entryPrice: "1.09500" },
      existing
    );
    expect(conflict.status).toBe("conflict");

    // 3. Exact price & time match without ticket
    const exactMatch = classifyDuplicateTrade(
      {
        instrumentSymbol: "EURUSD",
        direction: "long",
        entryPrice: "1.08500",
        entryTime: new Date("2026-11-19T10:00:20Z"),
      },
      existing
    );
    expect(exactMatch.status).toBe("exact_duplicate");

    // 4. Fresh new trade
    const fresh = classifyDuplicateTrade(
      {
        externalTicketId: "2002",
        instrumentSymbol: "GBPJPY",
        direction: "short",
        entryPrice: "192.500",
        entryTime: new Date("2026-11-19T11:00:00Z"),
      },
      existing
    );
    expect(fresh.status).toBe("new");
  });

  it("strictly enforces read-only broker permission boundaries", () => {
    expect(verifyReadOnlyPermission(["read_only", "history", "positions_read"])).toBe(true);
    expect(verifyReadOnlyPermission(["trade", "read_only"])).toBe(false);
    expect(verifyReadOnlyPermission(["orders_write"])).toBe(false);
    expect(verifyReadOnlyPermission(["withdraw"])).toBe(false);
  });

  it("reconciles broker trade stream against journal records and flags discrepancies", () => {
    const brokerStream = [
      {
        ticketId: "88801",
        symbol: "EURUSD",
        direction: "long" as const,
        volume: "1.0",
        openPrice: "1.08500",
        openTime: "2026-11-19T08:00:00Z",
      },
      {
        ticketId: "88802",
        symbol: "XAUUSD",
        direction: "long" as const,
        volume: "0.5",
        openPrice: "2655.00",
        openTime: "2026-11-19T09:00:00Z",
      },
    ];

    const journal = [
      {
        id: "j_1",
        instrumentSymbol: "EURUSD",
        direction: "long",
        entryPriceAvg: "1.08550", // price discrepancy
        positionSize: "1.0",
        notes: "Broker Ticket #88801 (Synced)",
      },
    ];

    const report = reconcileBrokerTrades(brokerStream, journal);
    expect(report.matches.length).toBe(1);
    expect(report.discrepancies.length).toBe(2);

    const priceDisc = report.discrepancies.find((d) => d.type === "price_discrepancy");
    expect(priceDisc).toBeDefined();
    expect(priceDisc?.ticketId).toBe("88801");

    const missingDisc = report.discrepancies.find((d) => d.type === "missing_in_alphapips");
    expect(missingDisc).toBeDefined();
    expect(missingDisc?.ticketId).toBe("88802");
  });

  it("verifies webhook HMAC authentication and enforces 300s replay window", () => {
    const secret = "test_ea_secret_key_123";
    const payload = JSON.stringify({ action: "sync", accountId: "acc_1", trades: [] });
    const nowSec = Math.floor(Date.now() / 1000);

    const validSig = crypto
      .createHmac("sha256", secret)
      .update(`${nowSec}:${payload}`)
      .digest("hex");

    // 1. Valid signature & fresh timestamp
    const check1 = validateReplayAndSignature(payload, validSig, secret, String(nowSec));
    expect(check1.valid).toBe(true);

    // 2. Replayed request (>300 seconds old)
    const oldTimestamp = String(nowSec - 301);
    const check2 = validateReplayAndSignature(payload, validSig, secret, oldTimestamp);
    expect(check2.valid).toBe(false);
    expect(check2.reason).toContain("skewed");

    // 3. Forged signature
    const check3 = validateReplayAndSignature(payload, "forged_hex_signature", secret, String(nowSec));
    expect(check3.valid).toBe(false);
    expect(check3.reason).toContain("mismatch");
  });
});
