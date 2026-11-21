/**
 * AlphaPips — Advanced Trade Import Parser & Normalizer
 * Supports: CSV (RFC 4180, comma, semicolon, tab), MetaTrader 4 & 5 HTML Statements,
 * MetaTrader EA JSON/CSV feeds, cTrader, NinjaTrader 8, TradeLocker, IBKR.
 * Multi-Asset aware: Forex, Gold/Silver, Indices, Crypto, Futures.
 */

import * as XLSX from "xlsx";
import { normalizeCsvDecimal, parseCsvMoneyCents, parseCsvDateTime, BROKER_PRESETS } from "./broker-csv-presets";

export interface ParsedImportData {
  headers: string[];
  rows: Record<string, string>[];
  detectedFormat: "csv" | "tsv" | "semicolon_csv" | "mt4_mt5_html" | "ea_json" | "xlsx" | "xls" | "unknown";
  detectedPresetId?: string;
  sheetNames?: string[];
  activeSheet?: string;
}

export type DuplicateClassification = "new" | "exact_duplicate" | "possible_duplicate" | "conflict" | "invalid";

export interface RowValidationResult {
  status: DuplicateClassification;
  confidence: number;
  reason?: string;
  matchedTradeId?: string;
  issues: string[];
  normalized?: Record<string, any>;
}

/**
 * Parses raw file content into headers and key-value row records.
 * Supports CSV, TSV, semicolon-separated CSV, MT4/MT5 HTML reports, EA JSON, and binary XLSX/XLS workbooks.
 */
export function parseRawImportFile(
  content: string | Buffer | Uint8Array,
  filename = "",
  selectedSheet?: string
): ParsedImportData {
  // 1. Binary or Base64 XLSX / XLS Workbook Parser
  const isXlsx =
    filename.toLowerCase().endsWith(".xlsx") ||
    filename.toLowerCase().endsWith(".xls") ||
    (typeof content === "string" && (
      content.startsWith("data:application/vnd.openxmlformats") ||
      content.startsWith("data:application/vnd.ms-excel") ||
      content.startsWith("UEsDB")
    )) ||
    Buffer.isBuffer(content);

  if (isXlsx) {
    try {
      const { headers, rows, sheetNames, activeSheet } = parseXlsxWorkbook(content, selectedSheet);
      if (headers.length > 0) {
        let detectedPresetId: string | undefined;
        for (const preset of BROKER_PRESETS) {
          const matches = preset.expectedHeaders.filter((h) =>
            headers.some((col) => col.toLowerCase() === h.toLowerCase())
          );
          if (matches.length >= Math.min(3, preset.expectedHeaders.length)) {
            detectedPresetId = preset.id;
            break;
          }
        }
        return {
          headers,
          rows,
          detectedFormat: filename.toLowerCase().endsWith(".xls") ? "xls" : "xlsx",
          detectedPresetId,
          sheetNames,
          activeSheet,
        };
      }
    } catch (err) {
      console.error("Failed to parse XLSX workbook:", err);
    }
  }

  const strContent = typeof content === "string" ? content : content.toString("utf-8");
  const trimmed = strContent.trim();

  // 1. MetaTrader 4 / MetaTrader 5 HTML Statement Parser
  if (
    trimmed.includes("<html") ||
    trimmed.includes("<table") ||
    trimmed.includes("Statement:") ||
    trimmed.includes("StrategyTester") ||
    filename.toLowerCase().endsWith(".htm") ||
    filename.toLowerCase().endsWith(".html")
  ) {
    const htmlRows = parseMt4Mt5HtmlStatement(strContent);
    if (htmlRows.rows.length > 0) {
      return {
        headers: htmlRows.headers,
        rows: htmlRows.rows,
        detectedFormat: "mt4_mt5_html",
        detectedPresetId: "mt4_mt5",
      };
    }
  }

  // 2. Structured MetaTrader EA JSON format
  if (trimmed.startsWith("[") && trimmed.endsWith("]") || trimmed.startsWith("{") && trimmed.includes('"trades"')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.trades) ? parsed.trades : []);
      if (list.length > 0 && typeof list[0] === "object") {
        const headers = Object.keys(list[0]);
        const rows = list.map((item: any) => {
          const rowObj: Record<string, string> = {};
          for (const k of headers) {
            rowObj[k] = item[k] !== undefined && item[k] !== null ? String(item[k]) : "";
          }
          return rowObj;
        });
        return {
          headers,
          rows,
          detectedFormat: "ea_json",
          detectedPresetId: "mt4_mt5",
        };
      }
    } catch {}
  }

  // 3. Delimited Text Parser (handles comma, semicolon, tab, and quotes)
  const delimiter = detectDelimiter(trimmed);
  const { headers, rows } = parseDelimitedText(trimmed, delimiter);
  const detectedFormat = delimiter === "\t" ? "tsv" : delimiter === ";" ? "semicolon_csv" : "csv";

  // Auto-detect broker preset from headers
  let detectedPresetId: string | undefined;
  for (const preset of BROKER_PRESETS) {
    const matches = preset.expectedHeaders.filter((h) =>
      headers.some((col) => col.toLowerCase() === h.toLowerCase())
    );
    if (matches.length >= Math.min(3, preset.expectedHeaders.length)) {
      detectedPresetId = preset.id;
      break;
    }
  }

  return {
    headers,
    rows,
    detectedFormat,
    detectedPresetId,
  };
}

/**
 * Detects whether text is comma, semicolon, or tab delimited.
 */
function detectDelimiter(text: string): "," | ";" | "\t" {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join("\n");
  const commaCount = (firstLines.match(/,/g) || []).length;
  const semiCount = (firstLines.match(/;/g) || []).length;
  const tabCount = (firstLines.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semiCount) return "\t";
  if (semiCount > commaCount && semiCount > 0) return ";";
  return ",";
}

/**
 * Robust RFC 4180 compliant delimited parser supporting escaped quotes and embedded delimiters.
 */
function parseDelimitedText(text: string, delimiter: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++; // skip \n
      currentRow.push(currentVal.trim());
      if (currentRow.some((c) => c.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) return { headers: [], rows: [] };

  const rawHeaders = lines[0].map((h) => h.replace(/^["'\s]+|["'\s]+$/g, ""));
  const headers = rawHeaders.filter((h) => h.length > 0);

  const rows = lines.slice(1).map((line) => {
    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = line[c] !== undefined ? line[c].replace(/^["'\s]+|["'\s]+$/g, "") : "";
    }
    return rowObj;
  }).filter((r) => Object.values(r).some((v) => v.length > 0));

  return { headers, rows };
}

/**
 * Parses MT4 / MT5 standard HTML statement tables into structured trade rows.
 */
function parseMt4Mt5HtmlStatement(html: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows: Record<string, string>[] = [];
  // Standard MetaTrader closed trades table columns
  const standardHeaders = [
    "Ticket", "Open Time", "Type", "Size", "Item", "Price", "S / L", "T / P", "Close Time", "Close Price", "Commission", "Swap", "Profit"
  ];

  // Regex to extract table rows
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = trRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cells: string[] = [];
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch: RegExpExecArray | null;

    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      // Strip HTML tags and clean whitespace
      const cellText = tdMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      cells.push(cellText);
    }

    // Identify if row is a closed trade row (MT4/MT5 trades start with numeric ticket e.g. 12345678, buy/sell type)
    if (cells.length >= 10) {
      const isTicket = /^\d{4,12}$/.test(cells[0]);
      const typeStr = cells[2]?.toLowerCase();
      const isTradeType = typeStr === "buy" || typeStr === "sell";

      if (isTicket && isTradeType) {
        const rowObj: Record<string, string> = {
          "Ticket": cells[0],
          "Open Time": cells[1] || "",
          "Type": cells[2] || "",
          "Size": cells[3] || "",
          "Item": cells[4] || "",
          "Price": cells[5] || "",
          "S / L": cells[6] || "",
          "T / P": cells[7] || "",
          "Close Time": cells[8] || "",
          "Close Price": cells[9] || "",
          "Commission": cells[10] || "0",
          "Swap": cells[11] || "0",
          "Profit": cells[12] || "0",
        };
        rows.push(rowObj);
      }
    }
  }

  return {
    headers: standardHeaders,
    rows,
  };
}

/**
 * Classifies duplicate probability between incoming trade and existing user trades.
 * Distinguishes Exact Duplicate, Likely/Possible Duplicate, Conflicting Record, and New Record.
 */
export function classifyDuplicateTrade(
  incoming: {
    externalTicketId?: string | null;
    instrumentSymbol?: string | null;
    direction?: string | null;
    entryPrice?: string | number | null;
    entryTime?: Date | string | null;
    netPnlCents?: number | null;
  },
  existingTrades: Array<{
    id: string;
    instrumentSymbol: string;
    direction: string;
    entryPriceAvg?: string | null;
    entryTime?: Date | null;
    netPnlCents?: number | null;
    notes?: string | null;
    externalTicketId?: string | null;
  }>
): { status: DuplicateClassification; confidence: number; reason?: string; matchTradeId?: string } {
  if (!incoming.instrumentSymbol || !incoming.direction || incoming.entryPrice == null) {
    return { status: "invalid", confidence: 0, reason: "Missing mandatory fields (instrument, direction, or price)" };
  }

  const incomingSymbol = incoming.instrumentSymbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const incomingDir = (incoming.direction || "").toLowerCase();
  const incomingPrice = parseFloat(String(incoming.entryPrice));
  const incomingTime = incoming.entryTime ? new Date(incoming.entryTime).getTime() : null;

  for (const existing of existingTrades) {
    // 1. External Ticket ID Match (Highest authority identifier)
    if (
      incoming.externalTicketId &&
      existing.externalTicketId &&
      incoming.externalTicketId === existing.externalTicketId
    ) {
      // Check if financial values differ (e.g. modified commission or price)
      const existingPrice = existing.entryPriceAvg ? parseFloat(existing.entryPriceAvg) : null;
      if (existingPrice !== null && Math.abs(existingPrice - incomingPrice) > 0.0001) {
        return {
          status: "conflict",
          confidence: 0.95,
          reason: `Same ticket ID (${incoming.externalTicketId}) but differing execution price (existing: ${existingPrice}, incoming: ${incomingPrice}).`,
          matchTradeId: existing.id,
        };
      }
      return {
        status: "exact_duplicate",
        confidence: 1.0,
        reason: `Exact external ticket ID match (#${incoming.externalTicketId}).`,
        matchTradeId: existing.id,
      };
    }

    const existSymbol = existing.instrumentSymbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const existDir = (existing.direction || "").toLowerCase();
    if (incomingSymbol !== existSymbol || incomingDir !== existDir) {
      continue;
    }

    const existPrice = existing.entryPriceAvg ? parseFloat(existing.entryPriceAvg) : null;
    const existTime = existing.entryTime ? new Date(existing.entryTime).getTime() : null;

    if (incomingTime && existTime && existPrice !== null) {
      const timeDiffSec = Math.abs(incomingTime - existTime) / 1000;
      const priceDiff = Math.abs(incomingPrice - existPrice);

      // Exact Duplicate: within 60s and same entry price
      if (timeDiffSec <= 60 && priceDiff < 0.00005) {
        return {
          status: "exact_duplicate",
          confidence: 1.0,
          reason: `Identical symbol, direction, entry price (${incomingPrice}), and timestamp (within ${Math.round(timeDiffSec)}s).`,
          matchTradeId: existing.id,
        };
      }

      // Likely Duplicate: within 3 minutes with same price or within 30s with micro-slippage
      if (timeDiffSec <= 180 && priceDiff < 0.0005) {
        return {
          status: "possible_duplicate",
          confidence: 0.85,
          reason: `Same symbol and direction within ${Math.round(timeDiffSec)}s with close price (${incomingPrice} vs ${existPrice}).`,
          matchTradeId: existing.id,
        };
      }
    }
  }

  return { status: "new", confidence: 0 };
}

/**
 * Parses XLSX/XLS workbook input (Buffer, base64, or Uint8Array) into headers and rows.
 */
export function parseXlsxWorkbook(
  input: string | Buffer | Uint8Array,
  selectedSheet?: string
): { headers: string[]; rows: Record<string, string>[]; sheetNames: string[]; activeSheet: string } {
  let readType: "base64" | "buffer" | "binary" = "buffer";
  let payload: any = input;

  if (typeof input === "string") {
    if (input.startsWith("data:")) {
      const commaIdx = input.indexOf(",");
      payload = input.slice(commaIdx + 1);
      readType = "base64";
    } else if (/^[A-Za-z0-9+/=]+$/.test(input.trim()) && input.length % 4 === 0 && input.length > 100) {
      payload = input.trim();
      readType = "base64";
    } else {
      payload = input;
      readType = "binary";
    }
  }

  const wb = XLSX.read(payload, {
    type: readType,
    cellDates: true,
    dateNF: "yyyy-mm-dd hh:mm:ss",
  });

  const sheetNames = wb.SheetNames || [];
  if (sheetNames.length === 0) {
    return { headers: [], rows: [], sheetNames: [], activeSheet: "" };
  }

  const activeSheet = selectedSheet && sheetNames.includes(selectedSheet) ? selectedSheet : sheetNames[0];
  const sheet = wb.Sheets[activeSheet];
  if (!sheet) {
    return { headers: [], rows: [], sheetNames, activeSheet };
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: "",
    raw: false,
    dateNF: "yyyy-mm-dd hh:mm:ss",
  });

  const headerSet = new Set<string>();
  const rows: Record<string, string>[] = [];

  for (const r of rawRows) {
    const rowObj: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === "__rowNum__") continue;
      const cleanKey = k.trim();
      if (!cleanKey) continue;
      headerSet.add(cleanKey);
      rowObj[cleanKey] = v !== undefined && v !== null ? String(v).trim() : "";
    }
    if (Object.values(rowObj).some((val) => val.length > 0)) {
      rows.push(rowObj);
    }
  }

  return {
    headers: Array.from(headerSet),
    rows,
    sheetNames,
    activeSheet,
  };
}
