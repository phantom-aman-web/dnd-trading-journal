import { describe, it, expect } from "bun:test";
import * as XLSX from "xlsx";
import { parseRawImportFile, parseXlsxWorkbook, classifyDuplicateTrade } from "./import-parser";

describe("Advanced XLSX Workbook Importer (Feature 10 & 9)", () => {
  it("genuinely parses a binary XLSX workbook with sheet selection and decimal precision", () => {
    // 1. Build an authentic in-memory XLSX workbook
    const wb = XLSX.utils.book_new();

    const tradeRows = [
      ["Ticket", "Open Time", "Type", "Size", "Item", "Price", "Close Price", "Commission", "Profit"],
      ["98765432", "2026-11-20 14:30:00", "buy", "0.50", "EURUSD", "1.08500", "1.08950", "-3.50", "225.00"],
      ["98765433", "2026-11-20 15:45:00", "sell", "1.00", "XAUUSD", "2650.25", "2638.75", "-7.00", "1150.00"],
    ];
    const wsTrades = XLSX.utils.aoa_to_sheet(tradeRows);
    XLSX.utils.book_append_sheet(wb, wsTrades, "Closed Trades");

    const summaryRows = [
      ["Account", "Balance", "Equity"],
      ["Primary Live", "50000.00", "51364.50"],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Account Overview");

    // Generate real binary XLSX buffer
    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // 2. Parse workbook with default (first) sheet
    const parsedDefault = parseRawImportFile(xlsxBuffer, "broker_export.xlsx");
    expect(parsedDefault.detectedFormat).toBe("xlsx");
    expect(parsedDefault.sheetNames).toEqual(["Closed Trades", "Account Overview"]);
    expect(parsedDefault.activeSheet).toBe("Closed Trades");
    expect(parsedDefault.headers).toContain("Ticket");
    expect(parsedDefault.headers).toContain("Item");
    expect(parsedDefault.headers).toContain("Profit");
    expect(parsedDefault.rows.length).toBe(2);

    expect(parsedDefault.rows[0]["Ticket"]).toBe("98765432");
    expect(parsedDefault.rows[0]["Item"]).toBe("EURUSD");
    expect(parsedDefault.rows[0]["Price"]).toBe("1.08500");
    expect(parsedDefault.rows[0]["Profit"]).toBe("225.00");

    // 3. Parse specific sheet ("Account Overview")
    const parsedSummary = parseRawImportFile(xlsxBuffer, "broker_export.xlsx", "Account Overview");
    expect(parsedSummary.activeSheet).toBe("Account Overview");
    expect(parsedSummary.headers).toContain("Account");
    expect(parsedSummary.headers).toContain("Equity");
    expect(parsedSummary.rows.length).toBe(1);
    expect(parsedSummary.rows[0]["Balance"]).toBe("50000.00");
  });

  it("handles base64 encoded XLSX files uploaded via Web API", () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ["Position ID", "Symbol", "Action", "Volume", "Open", "Close", "Gross P&L"],
      ["TX-101", "US30", "BUY", "2.0", "43800.0", "44100.0", "600.00"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const base64Data = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

    const parsed = parseRawImportFile(base64Data, "ctrader_trades.xlsx");
    expect(parsed.detectedFormat).toBe("xlsx");
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0]["Position ID"]).toBe("TX-101");
    expect(parsed.rows[0]["Symbol"]).toBe("US30");
  });

  it("accurately classifies duplicates and conflicts against existing trades", () => {
    const existingTrades = [
      {
        id: "tr_existing_1",
        instrumentSymbol: "EURUSD",
        direction: "long",
        entryPriceAvg: "1.08500",
        entryTime: "2026-11-20T14:30:00.000Z",
        externalTicketId: "98765432",
      },
    ];

    // 1. Exact ticket duplicate
    const exactMatch = classifyDuplicateTrade(
      {
        externalTicketId: "98765432",
        instrumentSymbol: "EURUSD",
        direction: "long",
        entryPrice: "1.08500",
        entryTime: "2026-11-20T14:30:00.000Z",
      },
      existingTrades
    );
    expect(exactMatch.status).toBe("exact_duplicate");
    expect(exactMatch.matchTradeId).toBe("tr_existing_1");

    // 2. Conflicting ticket with mismatched execution price
    const conflictMatch = classifyDuplicateTrade(
      {
        externalTicketId: "98765432",
        instrumentSymbol: "EURUSD",
        direction: "long",
        entryPrice: "1.09200", // Mismatched price!
        entryTime: "2026-11-20T14:30:00.000Z",
      },
      existingTrades
    );
    expect(conflictMatch.status).toBe("conflict");

    // 3. Brand new trade
    const newTrade = classifyDuplicateTrade(
      {
        externalTicketId: "98765499",
        instrumentSymbol: "GBPUSD",
        direction: "short",
        entryPrice: "1.29500",
        entryTime: "2026-11-20T16:00:00.000Z",
      },
      existingTrades
    );
    expect(newTrade.status).toBe("new");
  });
});
