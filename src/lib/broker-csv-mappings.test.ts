import { describe, it, expect } from "bun:test";
import {
  BROKER_PRESETS,
  detectBrokerPreset,
  getPresetMapping,
  normalizeCsvDecimal,
  parseCsvMoneyCents,
  parseCsvDateTime,
} from "./broker-csv-presets";

describe("Broker CSV Presets & Mapping Engine", () => {
  it("should have all 5 standard broker presets registered", () => {
    const ids = BROKER_PRESETS.map((p) => p.id);
    expect(ids).toContain("mt4_mt5");
    expect(ids).toContain("ctrader");
    expect(ids).toContain("ninjatrader");
    expect(ids).toContain("tradelocker");
    expect(ids).toContain("ibkr");
  });

  describe("MetaTrader 4 / 5 (MT4/MT5)", () => {
    const mtHeaders = [
      "Ticket",
      "Open Time",
      "Type",
      "Size",
      "Item",
      "Price",
      "S / L",
      "T / P",
      "Close Time",
      "Price",
      "Commission",
      "Swap",
      "Profit",
    ];

    it("should detect MT4/MT5 preset from typical exported headers", () => {
      const detected = detectBrokerPreset(mtHeaders);
      expect(detected).not.toBeNull();
      expect(detected?.id).toBe("mt4_mt5");
      expect(detected?.name).toContain("MetaTrader");
    });

    it("should correctly map MT4/MT5 columns to DnD canonical fields", () => {
      const mapping = getPresetMapping("mt4_mt5", mtHeaders);
      expect(mapping["Item"]).toBe("instrumentSymbol");
      expect(mapping["Type"]).toBe("direction");
      expect(mapping["Size"]).toBe("quantity");
      expect(mapping["Open Time"]).toBe("entryTime");
      expect(mapping["Close Time"]).toBe("exitTime");
      expect(mapping["S / L"]).toBe("stopPrice");
      expect(mapping["T / P"]).toBe("targetPrice");
      expect(mapping["Profit"]).toBe("netPnlCents");
    });
  });

  describe("cTrader", () => {
    const ctraderHeaders = [
      "Position Id",
      "Entry Time",
      "Symbol",
      "Direction",
      "Volume",
      "Entry Price",
      "Closing Time",
      "Closing Price",
      "Stop Loss",
      "Take Profit",
      "Commission",
      "Swap",
      "Net USD",
    ];

    it("should detect cTrader preset", () => {
      const detected = detectBrokerPreset(ctraderHeaders);
      expect(detected).not.toBeNull();
      expect(detected?.id).toBe("ctrader");
    });

    it("should correctly map cTrader columns", () => {
      const mapping = getPresetMapping("ctrader", ctraderHeaders);
      expect(mapping["Symbol"]).toBe("instrumentSymbol");
      expect(mapping["Direction"]).toBe("direction");
      expect(mapping["Volume"]).toBe("quantity");
      expect(mapping["Entry Price"]).toBe("entryPrice");
      expect(mapping["Closing Price"]).toBe("exitPrice");
      expect(mapping["Entry Time"]).toBe("entryTime");
      expect(mapping["Closing Time"]).toBe("exitTime");
      expect(mapping["Net USD"]).toBe("netPnlCents");
    });
  });

  describe("NinjaTrader 8", () => {
    const ntHeaders = [
      "Trade number",
      "Instrument",
      "Account",
      "Strategy",
      "Market pos.",
      "Qty",
      "Entry price",
      "Exit price",
      "Entry time",
      "Exit time",
      "Profit",
      "Commission",
    ];

    it("should detect NinjaTrader preset", () => {
      const detected = detectBrokerPreset(ntHeaders);
      expect(detected).not.toBeNull();
      expect(detected?.id).toBe("ninjatrader");
    });

    it("should correctly map NinjaTrader columns", () => {
      const mapping = getPresetMapping("ninjatrader", ntHeaders);
      expect(mapping["Instrument"]).toBe("instrumentSymbol");
      expect(mapping["Market pos."]).toBe("direction");
      expect(mapping["Qty"]).toBe("quantity");
      expect(mapping["Entry price"]).toBe("entryPrice");
      expect(mapping["Exit price"]).toBe("exitPrice");
      expect(mapping["Entry time"]).toBe("entryTime");
      expect(mapping["Exit time"]).toBe("exitTime");
      expect(mapping["Profit"]).toBe("netPnlCents");
    });
  });

  describe("TradeLocker", () => {
    const tlHeaders = [
      "Order ID",
      "Symbol",
      "Side",
      "Qty",
      "Filled Price",
      "Closed Price",
      "Created At",
      "Closed At",
      "Stop Loss",
      "Take Profit",
      "Fee",
      "Profit",
    ];

    it("should detect TradeLocker preset", () => {
      const detected = detectBrokerPreset(tlHeaders);
      expect(detected).not.toBeNull();
      expect(detected?.id).toBe("tradelocker");
    });

    it("should correctly map TradeLocker columns", () => {
      const mapping = getPresetMapping("tradelocker", tlHeaders);
      expect(mapping["Symbol"]).toBe("instrumentSymbol");
      expect(mapping["Side"]).toBe("direction");
      expect(mapping["Qty"]).toBe("quantity");
      expect(mapping["Filled Price"]).toBe("entryPrice");
      expect(mapping["Closed Price"]).toBe("exitPrice");
      expect(mapping["Created At"]).toBe("entryTime");
      expect(mapping["Closed At"]).toBe("exitTime");
      expect(mapping["Profit"]).toBe("netPnlCents");
    });
  });

  describe("Interactive Brokers (IBKR)", () => {
    const ibkrHeaders = [
      "Symbol",
      "Date/Time",
      "Buy/Sell",
      "Quantity",
      "TradePrice",
      "ClosePrice",
      "IBCommission",
      "RealizedP/L",
    ];

    it("should detect IBKR preset", () => {
      const detected = detectBrokerPreset(ibkrHeaders);
      expect(detected).not.toBeNull();
      expect(detected?.id).toBe("ibkr");
    });

    it("should correctly map IBKR columns", () => {
      const mapping = getPresetMapping("ibkr", ibkrHeaders);
      expect(mapping["Symbol"]).toBe("instrumentSymbol");
      expect(mapping["Buy/Sell"]).toBe("direction");
      expect(mapping["Quantity"]).toBe("quantity");
      expect(mapping["TradePrice"]).toBe("entryPrice");
      expect(mapping["ClosePrice"]).toBe("exitPrice");
      expect(mapping["Date/Time"]).toBe("entryTime");
      expect(mapping["RealizedP/L"]).toBe("netPnlCents");
    });
  });

  describe("Fallback & edge cases", () => {
    it("should return null when unknown headers are provided", () => {
      const randomHeaders = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
      expect(detectBrokerPreset(randomHeaders)).toBeNull();
    });

    it("should return empty object if preset ID does not exist", () => {
      expect(getPresetMapping("nonexistent_broker", ["Symbol", "Price"])).toEqual({});
    });
  });

  describe("Broker Financial & Format Normalization Engine", () => {
    describe("Decimal & Number Normalization (normalizeCsvDecimal)", () => {
      it("should leave standard US decimals intact", () => {
        expect(normalizeCsvDecimal("1.08500")).toBe("1.08500");
        expect(normalizeCsvDecimal("1250.75")).toBe("1250.75");
      });

      it("should convert European comma decimals to standard periods", () => {
        expect(normalizeCsvDecimal("1,08500")).toBe("1.08500");
        expect(normalizeCsvDecimal("0,50")).toBe("0.50");
        expect(normalizeCsvDecimal("-3,50")).toBe("-3.50");
      });

      it("should handle European thousand separators (period thousand, comma decimal)", () => {
        expect(normalizeCsvDecimal("1.250,50")).toBe("1250.50");
        expect(normalizeCsvDecimal("10.500,25")).toBe("10500.25");
      });

      it("should handle US thousand separators (comma thousand, period decimal)", () => {
        expect(normalizeCsvDecimal("1,250.50")).toBe("1250.50");
      });

      it("should strip currency signs and whitespace", () => {
        expect(normalizeCsvDecimal(" $ 1.0850 ")).toBe("1.0850");
        expect(normalizeCsvDecimal("€ 2.500,00")).toBe("2500.00");
        expect(normalizeCsvDecimal("-$3.50")).toBe("-3.50");
      });

      it("should convert accounting parentheses negative numbers", () => {
        expect(normalizeCsvDecimal("(3.50)")).toBe("-3.50");
        expect(normalizeCsvDecimal("($12.50)")).toBe("-12.50");
      });
    });

    describe("Monetary Amount Parsing (parseCsvMoneyCents)", () => {
      it("should convert fractional dollar amounts to exact integer cents", () => {
        expect(parseCsvMoneyCents("-3.50")).toBe(-350);
        expect(parseCsvMoneyCents("-$3.50")).toBe(-350);
        expect(parseCsvMoneyCents("3.50")).toBe(350);
        expect(parseCsvMoneyCents("0.00")).toBe(0);
        expect(parseCsvMoneyCents("0")).toBe(0);
      });

      it("should convert European decimal commas in currency to integer cents", () => {
        expect(parseCsvMoneyCents("-3,50")).toBe(-350);
        expect(parseCsvMoneyCents("15,75")).toBe(1575);
        expect(parseCsvMoneyCents("-1.250,50")).toBe(-125050);
      });

      it("should convert accounting parentheses to negative integer cents", () => {
        expect(parseCsvMoneyCents("(3.50)")).toBe(-350);
        expect(parseCsvMoneyCents("($15.20)")).toBe(-1520);
      });
    });

    describe("Date & Time Normalization (parseCsvDateTime)", () => {
      it("should parse standard ISO dates", () => {
        const d = parseCsvDateTime("2024-03-15T14:30:00.000Z");
        expect(d).not.toBeNull();
        expect(d?.getUTCFullYear()).toBe(2024);
        expect(d?.getUTCMonth()).toBe(2); // March
        expect(d?.getUTCDate()).toBe(15);
      });

      it("should parse MT4 dot formatted dates (YYYY.MM.DD HH:mm:ss)", () => {
        const d = parseCsvDateTime("2024.03.15 14:30:00");
        expect(d).not.toBeNull();
        expect(d?.getFullYear()).toBe(2024);
        expect(d?.getMonth()).toBe(2);
        expect(d?.getDate()).toBe(15);
        expect(d?.getHours()).toBe(14);
        expect(d?.getMinutes()).toBe(30);
      });

      it("should parse European dot formatted dates (DD.MM.YYYY HH:mm:ss)", () => {
        const d = parseCsvDateTime("15.03.2024 14:30:00");
        expect(d).not.toBeNull();
        expect(d?.getFullYear()).toBe(2024);
        expect(d?.getMonth()).toBe(2);
        expect(d?.getDate()).toBe(15);
      });

      it("should parse slash dates (DD/MM/YYYY or MM/DD/YYYY)", () => {
        const d1 = parseCsvDateTime("15/03/2024 10:00:00");
        expect(d1).not.toBeNull();
        expect(d1?.getFullYear()).toBe(2024);
        expect(d1?.getDate()).toBe(15);

        const d2 = parseCsvDateTime("03/15/2024 10:00:00");
        expect(d2).not.toBeNull();
        expect(d2?.getFullYear()).toBe(2024);
        expect(d2?.getDate()).toBe(15);
      });

      it("should return null for empty or invalid dates", () => {
        expect(parseCsvDateTime("")).toBeNull();
        expect(parseCsvDateTime(null)).toBeNull();
        expect(parseCsvDateTime("not-a-date")).toBeNull();
      });

      it("should apply explicit broker server timezone offset when timestamps lack timezone (e.g. MT4/MT5 GMT+2/3)", () => {
        // Broker server records 14:30 in GMT+2 (EET) -> In UTC, this is 12:30
        const dEet = parseCsvDateTime("2024.03.15 14:30:00", 2);
        expect(dEet).not.toBeNull();
        expect(dEet?.getUTCHours()).toBe(12);
        expect(dEet?.getUTCMinutes()).toBe(30);

        // Broker server records 14:30 in GMT+3 (EEST summer) -> In UTC, this is 11:30
        const dEest = parseCsvDateTime("2024.03.15 14:30:00", 3);
        expect(dEest).not.toBeNull();
        expect(dEest?.getUTCHours()).toBe(11);
        expect(dEest?.getUTCMinutes()).toBe(30);

        // Broker server records 14:30 in US Central GMT-6 (NinjaTrader Chicago) -> In UTC, this is 20:30
        const dCentral = parseCsvDateTime("2024-03-15 14:30:00", -6);
        expect(dCentral).not.toBeNull();
        expect(dCentral?.getUTCHours()).toBe(20);
        expect(dCentral?.getUTCMinutes()).toBe(30);

        // Timestamps with already embedded timezone should preserve their embedded timezone
        const dIso = parseCsvDateTime("2024-03-15T14:30:00+04:00", 2);
        expect(dIso).not.toBeNull();
        expect(dIso?.getUTCHours()).toBe(10);
      });
    });

    describe("Full Broker Row Ingestion Fixture Verification", () => {
      it("should ingest MT4 row with European comma prices and fractional commissions", () => {
        const mt4Row = {
          "Open Time": "2024.03.15 14:30:00",
          "Type": "buy",
          "Size": "0,50",
          "Item": "EURUSD",
          "Price": "1,08500",
          "S / L": "1,08200",
          "T / P": "1,09100",
          "Close Time": "2024.03.15 16:00:00",
          "Commission": "-$3,50",
          "Swap": "-0,50",
          "Profit": "300,00",
        };

        const price = normalizeCsvDecimal(mt4Row["Price"]);
        const size = normalizeCsvDecimal(mt4Row["Size"]);
        const commission = parseCsvMoneyCents(mt4Row["Commission"]);
        const swap = parseCsvMoneyCents(mt4Row["Swap"]);
        const profit = parseCsvMoneyCents(mt4Row["Profit"]);
        const entryTime = parseCsvDateTime(mt4Row["Open Time"]);

        expect(price).toBe("1.08500");
        expect(size).toBe("0.50");
        expect(commission).toBe(-350);
        expect(swap).toBe(-50);
        expect(profit).toBe(30000);
        expect(entryTime).not.toBeNull();
        expect(entryTime?.getFullYear()).toBe(2024);
      });

      it("should ingest IBKR row with accounting formatted commissions and P/L", () => {
        const ibkrRow = {
          "Symbol": "NQ",
          "Date/Time": "2024-03-15 10:15:00",
          "Buy/Sell": "BUY",
          "Quantity": "2",
          "TradePrice": "18250.25",
          "ClosePrice": "18300.00",
          "IBCommission": "($4.10)",
          "RealizedP/L": "1,991.80",
        };

        const commission = parseCsvMoneyCents(ibkrRow["IBCommission"]);
        const pnl = parseCsvMoneyCents(ibkrRow["RealizedP/L"]);

        expect(commission).toBe(-410);
        expect(pnl).toBe(199180);
      });

      it("should ingest cTrader row with volume, fractional swap, and UTC timestamps", () => {
        const ctraderRow = {
          "Position Id": "8841920",
          "Entry Time": "2024-03-15 08:30:15",
          "Symbol": "EURUSD",
          "Direction": "Buy",
          "Volume": "100000",
          "Entry Price": "1.08500",
          "Closing Time": "2024-03-15 11:45:00",
          "Closing Price": "1.08850",
          "Commission": "-6.00",
          "Swap": "-1.25",
          "Net USD": "342.75",
        };

        const entryTime = parseCsvDateTime(ctraderRow["Entry Time"], 0);
        const exitTime = parseCsvDateTime(ctraderRow["Closing Time"], 0);
        const commission = parseCsvMoneyCents(ctraderRow["Commission"]);
        const swap = parseCsvMoneyCents(ctraderRow["Swap"]);
        const netPnl = parseCsvMoneyCents(ctraderRow["Net USD"]);

        expect(entryTime?.toISOString()).toBe("2024-03-15T08:30:15.000Z");
        expect(exitTime?.toISOString()).toBe("2024-03-15T11:45:00.000Z");
        expect(commission).toBe(-600);
        expect(swap).toBe(-125);
        expect(netPnl).toBe(34275);
      });

      it("should ingest NinjaTrader 8 row with Chicago Central futures time and point calculations", () => {
        const ntRow = {
          "Trade number": "104",
          "Instrument": "NQ 03-24",
          "Account": "Sim101",
          "Strategy": "Breakout",
          "Market pos.": "Long",
          "Qty": "1",
          "Entry price": "18200.00",
          "Exit price": "18225.50",
          "Entry time": "2024-03-15 08:35:00",
          "Exit time": "2024-03-15 09:15:00",
          "Profit": "510.00",
          "Commission": "4.50",
        };

        // Chicago time UTC-6: 08:35 local -> 14:35 UTC
        const entryTime = parseCsvDateTime(ntRow["Entry time"], -6);
        const exitTime = parseCsvDateTime(ntRow["Exit time"], -6);
        const profit = parseCsvMoneyCents(ntRow["Profit"]);
        const commission = parseCsvMoneyCents(ntRow["Commission"]);

        expect(entryTime?.getUTCHours()).toBe(14);
        expect(entryTime?.getUTCMinutes()).toBe(35);
        expect(exitTime?.getUTCHours()).toBe(15);
        expect(exitTime?.getUTCMinutes()).toBe(15);
        expect(profit).toBe(51000);
        expect(commission).toBe(450);
      });

      it("should ingest TradeLocker row with crypto/forex fractional lots and positive/negative outcomes", () => {
        const tlRow = {
          "Id": "tl_trade_9921",
          "Instrument": "BTCUSD",
          "Side": "buy",
          "Lots": "0.25",
          "Open Price": "64200.50",
          "Close Price": "64800.00",
          "Open Time": "2024-03-15 12:00:00",
          "Close Time": "2024-03-15 14:30:00",
          "Net Profit": "149.875",
          "Commission": "2.50",
          "Fees": "0.50",
        };

        const size = normalizeCsvDecimal(tlRow["Lots"]);
        const openPrice = normalizeCsvDecimal(tlRow["Open Price"]);
        const closePrice = normalizeCsvDecimal(tlRow["Close Price"]);
        const pnl = parseCsvMoneyCents(tlRow["Net Profit"]);

        expect(size).toBe("0.25");
        expect(openPrice).toBe("64200.50");
        expect(closePrice).toBe("64800.00");
        expect(pnl).toBe(14988); // rounded to nearest integer cent
      });

      it("should safely handle malformed, missing, or corrupted CSV rows without crashing", () => {
        // Completely invalid / blank values
        expect(normalizeCsvDecimal("")).toBe("");
        expect(normalizeCsvDecimal(null as any)).toBe("");
        expect(parseCsvMoneyCents("N/A")).toBe(0);
        expect(parseCsvMoneyCents("---")).toBe(0);
        expect(parseCsvDateTime("invalid-timestamp-value")).toBeNull();
        expect(parseCsvDateTime("")).toBeNull();
      });

      it("should generate deterministic duplicate reconciliation signatures to prevent double imports", () => {
        const tradeA = {
          symbol: "EURUSD",
          direction: "long",
          entryTime: "2024-03-15T12:30:00.000Z",
          price: "1.08500",
          quantity: "1.0",
        };
        const tradeB = {
          symbol: "EURUSD",
          direction: "long",
          entryTime: "2024-03-15T12:30:00.000Z",
          price: "1.08500",
          quantity: "1.0",
        };
        const tradeC = {
          symbol: "EURUSD",
          direction: "short",
          entryTime: "2024-03-15T12:30:00.000Z",
          price: "1.08500",
          quantity: "1.0",
        };

        const sigA = `${tradeA.symbol}-${tradeA.direction}-${tradeA.entryTime}-${tradeA.price}-${tradeA.quantity}`;
        const sigB = `${tradeB.symbol}-${tradeB.direction}-${tradeB.entryTime}-${tradeB.price}-${tradeB.quantity}`;
        const sigC = `${tradeC.symbol}-${tradeC.direction}-${tradeC.entryTime}-${tradeC.price}-${tradeC.quantity}`;

        expect(sigA).toBe(sigB);
        expect(sigA).not.toBe(sigC);
      });
    });
  });
});
