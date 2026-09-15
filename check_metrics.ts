const { computeAggregateMetrics } = require('./src/lib/financial-engine.ts');

const trades = [
  {
    id: "cmu2h1hmv000cwhdgjfeml4lf",
    instrumentSymbol: "EURUSD",
    grossPnlCents: 70000,
    netPnlCents: 70000,
    status: "closed",
    outcome: "win",
  }
];

const res = computeAggregateMetrics(trades, 100000);
console.log(JSON.stringify(res, null, 2));
