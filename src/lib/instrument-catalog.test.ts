/**
 * DnD — Instrument Catalog & Multi-Market Economics Tests
 *
 * Validates specifications across Forex, Gold, Silver, Indices, and Crypto:
 * - Proper pointValueCents and tickSize
 * - Normalization and alias resolution (e.g. XAU/USD, GOLD, US100, BTCUSDT)
 * - P&L calculations per instrument economics
 *
 * Run: bun test src/lib/instrument-catalog.test.ts
 */

import { test, expect } from "bun:test";
import {
  normalizeSymbol,
  resolveInstrument,
  unitLabel,
  distanceInUnits,
  getInstrumentQuoteCurrency,
  convertCurrency,
  getInstrumentSizingRules,
  BENCHMARK_FX_METADATA,
} from "./instrument-catalog";
import { calculateTradeMetrics } from "./financial-engine";

test("INST-1: Normalization strips slashes, dots, and handles broker aliases", () => {
  expect(normalizeSymbol("EUR/USD")).toBe("EURUSD");
  expect(normalizeSymbol("eur/usd")).toBe("EURUSD");
  expect(normalizeSymbol("GOLD")).toBe("XAUUSD");
  expect(normalizeSymbol("gold")).toBe("XAUUSD");
  expect(normalizeSymbol("SILVER")).toBe("XAGUSD");
  expect(normalizeSymbol("US100")).toBe("NAS100");
  expect(normalizeSymbol("USTEC")).toBe("NAS100");
  expect(normalizeSymbol("US500")).toBe("SPX500");
  expect(normalizeSymbol("SPX")).toBe("SPX500");
  expect(normalizeSymbol("DJ30")).toBe("US30");
  expect(normalizeSymbol("DE40")).toBe("GER40");
  expect(normalizeSymbol("DAX")).toBe("GER40");
  expect(normalizeSymbol("BTCUSDT")).toBe("BTCUSD");
  expect(normalizeSymbol("ETHUSDT")).toBe("ETHUSD");
  expect(normalizeSymbol("SOLUSDT")).toBe("SOLUSD");
  expect(normalizeSymbol("EURUSD.pro")).toBe("EURUSD");
  expect(normalizeSymbol("XAUUSD.raw")).toBe("XAUUSD");
});

test("INST-2: Gold markets — Spot XAUUSD vs COMEX GC vs Micro MGC", () => {
  const spot = resolveInstrument("XAUUSD");
  expect(spot.pointValueCents).toBe(10000); // $100 per $1 move (100 oz)
  expect(spot.pricePrecision).toBe(2);

  const gc = resolveInstrument("GC");
  expect(gc.pointValueCents).toBe(10000); // $100 per $1 move (100 oz)
  expect(gc.market).toBe("futures");

  const mgc = resolveInstrument("MGC");
  expect(mgc.pointValueCents).toBe(1000); // $10 per $1 move (10 oz)
  expect(mgc.market).toBe("futures");

  // P&L comparison for 10-point move on 1 contract
  const pnlSpot = calculateTradeMetrics({
    direction: "long",
    instrument: spot,
    fills: [
      { kind: "entry", price: "2400.00", quantity: "1" },
      { kind: "exit", price: "2410.00", quantity: "1" },
    ],
  });
  expect(pnlSpot.grossPnlNativeCents).toBe(100000); // $1,000

  const pnlMgc = calculateTradeMetrics({
    direction: "long",
    instrument: mgc,
    fills: [
      { kind: "entry", price: "2400.0", quantity: "1" },
      { kind: "exit", price: "2410.0", quantity: "1" },
    ],
  });
  expect(pnlMgc.grossPnlNativeCents).toBe(10000); // $100
});

test("INST-3: Silver markets — Spot XAGUSD vs Futures SI vs Micro SIL", () => {
  const spot = resolveInstrument("XAGUSD");
  expect(spot.pointValueCents).toBe(500000); // $5,000 per $1 move (5000 oz)

  const si = resolveInstrument("SI");
  expect(si.pointValueCents).toBe(500000); // $5,000 per $1 move (5000 oz)

  const sil = resolveInstrument("SIL");
  expect(sil.pointValueCents).toBe(100000); // $1,000 per $1 move (1000 oz)

  // 0.50 move on SIL: 0.50 * 1 * 100,000 cents = 50,000 cents = $500
  const pnlSil = calculateTradeMetrics({
    direction: "long",
    instrument: sil,
    fills: [
      { kind: "entry", price: "30.000", quantity: "1" },
      { kind: "exit", price: "30.500", quantity: "1" },
    ],
  });
  expect(pnlSil.grossPnlNativeCents).toBe(50000); // $500
});

test("INST-4: Index Futures — NQ ($20/pt) vs MNQ ($2/pt) vs ES ($50/pt) vs MES ($5/pt)", () => {
  const nq = resolveInstrument("NQ");
  const mnq = resolveInstrument("MNQ");
  const es = resolveInstrument("ES");
  const mes = resolveInstrument("MES");

  expect(nq.pointValueCents).toBe(2000);
  expect(mnq.pointValueCents).toBe(200);
  expect(es.pointValueCents).toBe(5000);
  expect(mes.pointValueCents).toBe(500);

  // 100-point move on 1 contract
  const pnlNq = calculateTradeMetrics({
    direction: "long",
    instrument: nq,
    fills: [
      { kind: "entry", price: "20000", quantity: "1" },
      { kind: "exit", price: "20100", quantity: "1" },
    ],
  });
  expect(pnlNq.grossPnlNativeCents).toBe(200000); // $2,000

  const pnlMnq = calculateTradeMetrics({
    direction: "long",
    instrument: mnq,
    fills: [
      { kind: "entry", price: "20000", quantity: "1" },
      { kind: "exit", price: "20100", quantity: "1" },
    ],
  });
  expect(pnlMnq.grossPnlNativeCents).toBe(20000); // $200
});

test("INST-5: Crypto Spot & Perpetuals — BTC, ETH, SOL", () => {
  const btc = resolveInstrument("BTCUSDT"); // normalized to BTCUSD
  expect(btc.symbol).toBe("BTCUSD");
  expect(btc.pointValueCents).toBe(100); // $1 per $1 move per 1 BTC

  const sol = resolveInstrument("SOLUSD");
  expect(sol.symbol).toBe("SOLUSD");
  expect(sol.pointValueCents).toBe(100); // $1 per $1 move per 1 SOL

  // 10 SOL move from 150 to 160: 10 * 10 * 100 = 10,000 cents = $100
  const pnlSol = calculateTradeMetrics({
    direction: "long",
    instrument: sol,
    fills: [
      { kind: "entry", price: "150.00", quantity: "10" },
      { kind: "exit", price: "160.00", quantity: "10" },
    ],
  });
  expect(pnlSol.grossPnlNativeCents).toBe(10000); // $100
});

test("INST-6: Unit labels and distances", () => {
  expect(unitLabel("forex")).toBe("pips");
  expect(unitLabel("futures")).toBe("ticks");
  expect(unitLabel("indices")).toBe("points");
  expect(unitLabel("gold")).toBe("points");
  expect(unitLabel("crypto")).toBe("points");

  // EURUSD 0.0025 distance with pipSize 0.0001 -> 25 pips
  expect(distanceInUnits(0.0025, "0.0001")).toBe(25);
  // Gold 5.00 distance with pipSize 0.01 -> 500 pips / points
  expect(distanceInUnits(5.0, "0.01")).toBe(500);
});

test("INST-7: Quote currency resolution across asset classes", () => {
  const eurusd = resolveInstrument("EURUSD");
  expect(getInstrumentQuoteCurrency(eurusd)).toBe("USD");

  const eurgbp = resolveInstrument("EURGBP");
  expect(getInstrumentQuoteCurrency(eurgbp)).toBe("GBP");

  const usdjpy = resolveInstrument("USDJPY");
  expect(getInstrumentQuoteCurrency(usdjpy)).toBe("JPY");

  const ger40 = resolveInstrument("GER40");
  expect(getInstrumentQuoteCurrency(ger40)).toBe("EUR");

  const xauusd = resolveInstrument("XAUUSD");
  expect(getInstrumentQuoteCurrency(xauusd)).toBe("USD");

  const btcusd = resolveInstrument("BTCUSD");
  expect(getInstrumentQuoteCurrency(btcusd)).toBe("USD");
});

test("INST-8: Currency conversion engine and transparent benchmark disclosure", () => {
  // Benchmark metadata disclosure
  expect(BENCHMARK_FX_METADATA.isLiveBrokerFeed).toBe(false);
  expect(BENCHMARK_FX_METADATA.source).toContain("Benchmark Reference");

  // Same currency -> 1.0 rate, no conversion needed
  const same = convertCurrency(500, "USD", "USD");
  expect(same.isConversionNeeded).toBe(false);
  expect(same.rate).toBe(1.0);
  expect(same.converted).toBe(500);

  // EUR to USD (1 EUR = 1.085 USD)
  const eurToUsd = convertCurrency(100, "EUR", "USD");
  expect(eurToUsd.isConversionNeeded).toBe(true);
  expect(eurToUsd.rate).toBe(1.085);
  expect(eurToUsd.converted).toBe(108.50);

  // GBP to USD (1 GBP = 1.295 USD)
  const gbpToUsd = convertCurrency(100, "GBP", "USD");
  expect(gbpToUsd.isConversionNeeded).toBe(true);
  expect(gbpToUsd.rate).toBe(1.295);
  expect(gbpToUsd.converted).toBe(129.50);

  // USD to EUR (100 / 1.085 = 92.17)
  const usdToEur = convertCurrency(100, "USD", "EUR");
  expect(usdToEur.converted).toBe(92.17);

  // Custom rate override (e.g. user specifies live broker EURUSD rate of 1.0920)
  const custom = convertCurrency(100, "EUR", "USD", { EUR: 1.0920 });
  expect(custom.rate).toBe(1.0920);
  expect(custom.converted).toBe(109.20);
});

test("INST-9: Instrument sizing constraints & quantity rules", () => {
  const forexRules = getInstrumentSizingRules(resolveInstrument("EURUSD"));
  expect(forexRules.minQuantity).toBe(0.01);
  expect(forexRules.quantityStep).toBe(0.01);
  expect(forexRules.quantityUnit).toBe("lots");

  const goldRules = getInstrumentSizingRules(resolveInstrument("XAUUSD"));
  expect(goldRules.minQuantity).toBe(0.01);
  expect(goldRules.quantityStep).toBe(0.01);
  expect(goldRules.quantityUnit).toBe("lots");

  const silverRules = getInstrumentSizingRules(resolveInstrument("XAGUSD"));
  expect(silverRules.minQuantity).toBe(0.01);
  expect(silverRules.quantityStep).toBe(0.01);
  expect(silverRules.quantityUnit).toBe("lots");

  const nqRules = getInstrumentSizingRules(resolveInstrument("NQ"));
  expect(nqRules.minQuantity).toBe(1);
  expect(nqRules.quantityStep).toBe(1);
  expect(nqRules.quantityUnit).toBe("contracts");

  const cryptoRules = getInstrumentSizingRules(resolveInstrument("BTCUSD"));
  expect(cryptoRules.minQuantity).toBe(0.001);
  expect(cryptoRules.quantityStep).toBe(0.001);
  expect(cryptoRules.quantityUnit).toBe("coins");
});

test("INST-10: Independent ground-truth risk sizing mathematical calculations", () => {
  // Test Case A: EURUSD Forex
  // Account = $50,000, 1% risk = $500 risk budget.
  // Entry = 1.08500, Stop = 1.08250 (25 pips).
  // Pip value per 1 lot = $10.00 (pointValue = 10,000,000 cents = $100,000 per 1.0 price move).
  // Monetary risk per lot = 25 pips * $10 = $250.
  // Expected lot size = $500 / $250 = 2.00 lots.
  const eurusd = resolveInstrument("EURUSD");
  const stopDistForex = 0.00250;
  const rawLotsForex = 500 / ((stopDistForex * eurusd.pointValueCents) / 100);
  expect(rawLotsForex).toBe(2.0);

  // Test Case B: Spot Gold (XAUUSD)
  // Account = $50,000, 1% risk = $500 risk budget.
  // Entry = 2400.00, Stop = 2390.00 ($10 stop distance).
  // 1 lot = 100 oz (pointValue = 10,000 cents = $100 per $1 price move).
  // Monetary risk per lot = $10 * $100 = $1,000.
  // Expected lot size = $500 / $1,000 = 0.50 lots.
  const xau = resolveInstrument("XAUUSD");
  const stopDistGold = 10.0;
  const rawLotsGold = 500 / ((stopDistGold * xau.pointValueCents) / 100);
  expect(rawLotsGold).toBe(0.5);

  // Test Case C: Spot Silver (XAGUSD)
  // Account = $50,000, 1% risk = $500 risk budget.
  // Entry = 30.000, Stop = 29.500 ($0.50 stop distance).
  // 1 lot = 5,000 oz (pointValue = 500,000 cents = $5,000 per $1 price move).
  // Monetary risk per lot = $0.50 * $5,000 = $2,500.
  // Expected lot size = $500 / $2,500 = 0.20 lots.
  const xag = resolveInstrument("XAGUSD");
  const stopDistSilver = 0.500;
  const rawLotsSilver = 500 / ((stopDistSilver * xag.pointValueCents) / 100);
  expect(rawLotsSilver).toBe(0.2);

  // Test Case D: Nasdaq Futures (NQ)
  // Account = $50,000, 1% risk = $500 risk budget.
  // Entry = 20000.00, Stop = 19975.00 (25 points distance).
  // 1 contract = $20 per point (pointValue = 2,000 cents).
  // Monetary risk per contract = 25 * $20 = $500.
  // Expected contracts = $500 / $500 = 1.0 contract.
  const nq = resolveInstrument("NQ");
  const stopDistNq = 25.0;
  const rawContractsNq = 500 / ((stopDistNq * nq.pointValueCents) / 100);
  expect(rawContractsNq).toBe(1.0);

  // Test Case E: Cross-Pair EURGBP in USD Account
  // Account = $50,000 USD, 1% risk = $500 USD.
  // Pair is quoted in GBP. With benchmark GBP/USD = 1.295:
  // Risk budget in GBP = $500 / 1.295 = 386.10 GBP.
  // Entry = 0.8500, Stop = 0.8475 (25 pips).
  // Monetary risk per lot in GBP = 25 pips * 10 GBP = 250 GBP.
  // Expected lot size = 386.10 / 250 = 1.544 -> rounded to 1.54 lots.
  const eurgbp = resolveInstrument("EURGBP");
  const stopDistCross = 0.0025;
  const riskInGbp = convertCurrency(500, "USD", "GBP").converted;
  const rawLotsCross = riskInGbp / ((stopDistCross * eurgbp.pointValueCents) / 100);
  expect(Math.floor(rawLotsCross * 100) / 100).toBe(1.54);
});
