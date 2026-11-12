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
