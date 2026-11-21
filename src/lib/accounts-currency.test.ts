import { describe, it, expect } from "bun:test";
import { aggregateAccountsByCurrency, type AccountLike, type AccountStatsLike } from "./accounts-currency";
import { formatSignedCents, formatCents } from "./money";

describe("D-017: Multi-Currency Account Aggregation Engine", () => {
  it("aggregates multiple USD accounts into one USD total", () => {
    const accounts: AccountLike[] = [
      { id: "acc-1", name: "USD Live 1", currency: "USD", startingBalanceCents: 10000000, currentBalanceCents: 10500000 },
      { id: "acc-2", name: "USD Prop 1", currency: "USD", startingBalanceCents: 5000000, currentBalanceCents: 5200000 },
    ];
    const stats: Record<string, AccountStatsLike> = {
      "acc-1": { count: 10, wins: 6, losses: 4, pnlCents: 500000 },
      "acc-2": { count: 5, wins: 3, losses: 2, pnlCents: 200000 },
    };

    const res = aggregateAccountsByCurrency(accounts, stats);
    expect(res.isMultiCurrency).toBe(false);
    expect(res.currencies).toEqual(["USD"]);
    expect(res.groups.length).toBe(1);

    const usd = res.groups[0];
    expect(usd.currency).toBe("USD");
    expect(usd.accountsCount).toBe(2);
    expect(usd.startingBalanceCents).toBe(15000000); // $150,000
    expect(usd.currentBalanceCents).toBe(15700000); // $105k + $52k = $157k
    expect(usd.pnlCents).toBe(700000); // $7,000
    expect(usd.totalBalanceCents).toBe(15700000); // $157,000
    expect(usd.tradesCount).toBe(15);
    expect(usd.winRate).toBe(60); // 9 wins / 15 closed = 60%
  });

  it("aggregates multiple EUR accounts into one EUR total", () => {
    const accounts: AccountLike[] = [
      { id: "acc-eur-1", name: "EUR Scalping", currency: "EUR", startingBalanceCents: 2000000, currentBalanceCents: 2100000 },
      { id: "acc-eur-2", name: "EUR Swing", currency: "EUR", startingBalanceCents: 3000000, currentBalanceCents: 2900000 },
    ];
    const stats: Record<string, AccountStatsLike> = {
      "acc-eur-1": { count: 4, wins: 3, losses: 1, pnlCents: 100000 },
      "acc-eur-2": { count: 2, wins: 0, losses: 2, pnlCents: -100000 },
    };

    const res = aggregateAccountsByCurrency(accounts, stats);
    expect(res.isMultiCurrency).toBe(false);
    expect(res.currencies).toEqual(["EUR"]);
    const eur = res.groups[0];
    expect(eur.currency).toBe("EUR");
    expect(eur.startingBalanceCents).toBe(5000000);
    expect(eur.pnlCents).toBe(0);
    expect(eur.totalBalanceCents).toBe(5000000);
    expect(eur.winRate).toBe(50); // 3 wins / 6 closed = 50%
  });

  it("NEVER adds USD, EUR, and GBP balances together into a single fiat sum", () => {
    const accounts: AccountLike[] = [
      { id: "acc-usd", name: "US Account", currency: "USD", startingBalanceCents: 10000000, currentBalanceCents: 10500000 },
      { id: "acc-eur", name: "EU Account", currency: "EUR", startingBalanceCents: 10000000, currentBalanceCents: 10200000 },
      { id: "acc-gbp", name: "UK Account", currency: "GBP", startingBalanceCents: 5000000, currentBalanceCents: 5100000 },
    ];
    const stats: Record<string, AccountStatsLike> = {
      "acc-usd": { count: 10, wins: 7, losses: 3, pnlCents: 500000 },
      "acc-eur": { count: 8, wins: 5, losses: 3, pnlCents: 200000 },
      "acc-gbp": { count: 4, wins: 3, losses: 1, pnlCents: 100000 },
    };

    const res = aggregateAccountsByCurrency(accounts, stats);
    expect(res.isMultiCurrency).toBe(true);
    expect(res.currencies.sort()).toEqual(["EUR", "GBP", "USD"]);
    expect(res.groups.length).toBe(3);

    // Verify USD group is isolated
    const usd = res.groupsByCurrency["USD"];
    expect(usd.totalBalanceCents).toBe(10500000); // exactly $105,000 USD
    expect(formatCents(usd.totalBalanceCents, "USD")).toContain("$105,000.00");

    // Verify EUR group is isolated
    const eur = res.groupsByCurrency["EUR"];
    expect(eur.totalBalanceCents).toBe(10200000); // exactly €102,000 EUR
    expect(formatCents(eur.totalBalanceCents, "EUR")).toContain("102,000.00");

    // Verify GBP group is isolated
    const gbp = res.groupsByCurrency["GBP"];
    expect(gbp.totalBalanceCents).toBe(5100000); // exactly £51,000 GBP
    expect(formatCents(gbp.totalBalanceCents, "GBP")).toContain("51,000.00");

    // Notice that USD, EUR, and GBP are never added into a 25,800,000 nominal cents sum!
    expect(res.currencyNotice).toContain("Portfolio contains accounts in 3 currencies");
  });

  it("handles mixed 4-currency portfolio: USD, EUR, GBP, JPY cleanly", () => {
    const accounts: AccountLike[] = [
      { id: "a1", name: "USD", currency: "USD", startingBalanceCents: 100000, currentBalanceCents: 110000 },
      { id: "a2", name: "EUR", currency: "EUR", startingBalanceCents: 200000, currentBalanceCents: 200000 },
      { id: "a3", name: "GBP", currency: "GBP", startingBalanceCents: 300000, currentBalanceCents: 310000 },
      { id: "a4", name: "JPY", currency: "JPY", startingBalanceCents: 50000000, currentBalanceCents: 55000000 },
    ];
    const stats = new Map<string, AccountStatsLike>([
      ["a1", { count: 2, wins: 1, losses: 1, pnlCents: 10000 }],
      ["a2", { count: 3, wins: 2, losses: 1, pnlCents: 0 }],
      ["a3", { count: 4, wins: 3, losses: 1, pnlCents: 10000 }],
      ["a4", { count: 5, wins: 4, losses: 1, pnlCents: 5000000 }],
    ]);

    const res = aggregateAccountsByCurrency(accounts, stats);
    expect(res.currencies.length).toBe(4);
    expect(res.isMultiCurrency).toBe(true);

    // Global non-monetary metrics are aggregated correctly
    expect(res.totalAccountsCount).toBe(4);
    expect(res.totalTradesCount).toBe(14); // 2 + 3 + 4 + 5 = 14
    expect(res.totalWinsCount).toBe(10); // 1 + 2 + 3 + 4 = 10
    expect(res.totalLossesCount).toBe(4);
    expect(res.overallWinRate).toBe(71); // 10 / 14 = 71.4% -> 71%
  });

  it("formats each account card with its own true currency symbol", () => {
    const gbpAccount: AccountLike = {
      id: "gbp-1",
      name: "FTMO GBP Challenge",
      currency: "GBP",
      startingBalanceCents: 10000000,
      currentBalanceCents: 10500000,
    };
    const pnlCents = 500000;
    const balanceCents = gbpAccount.startingBalanceCents + pnlCents;

    const formattedPnl = formatSignedCents(pnlCents, gbpAccount.currency || "USD");
    const formattedBalance = formatCents(balanceCents, gbpAccount.currency || "USD");

    // GBP must produce £, NOT $
    expect(formattedPnl.text).toContain("£");
    expect(formattedPnl.text).not.toContain("$");
    expect(formattedBalance).toContain("£");
    expect(formattedBalance).not.toContain("$");
  });

  it("ignores archived accounts in portfolio calculations", () => {
    const accounts: AccountLike[] = [
      { id: "active-1", name: "Active USD", currency: "USD", startingBalanceCents: 1000000, currentBalanceCents: 1050000, isArchived: false },
      { id: "archived-1", name: "Old USD", currency: "USD", startingBalanceCents: 5000000, currentBalanceCents: 0, isArchived: true },
    ];
    const stats: Record<string, AccountStatsLike> = {
      "active-1": { count: 5, wins: 4, losses: 1, pnlCents: 50000 },
      "archived-1": { count: 20, wins: 10, losses: 10, pnlCents: -5000000 },
    };

    const res = aggregateAccountsByCurrency(accounts, stats);
    expect(res.totalAccountsCount).toBe(1);
    expect(res.groups[0].totalBalanceCents).toBe(1050000);
    expect(res.groups[0].tradesCount).toBe(5);
  });

  it("dynamically supports 5 distinct currencies: USD, EUR, GBP, JPY, CHF without code changes", () => {
    const accounts: AccountLike[] = [
      { id: "usd", name: "USD Acc", currency: "USD", startingBalanceCents: 1000000, currentBalanceCents: 1000000 },
      { id: "eur", name: "EUR Acc", currency: "EUR", startingBalanceCents: 1000000, currentBalanceCents: 1000000 },
      { id: "gbp", name: "GBP Acc", currency: "GBP", startingBalanceCents: 1000000, currentBalanceCents: 1000000 },
      { id: "jpy", name: "JPY Acc", currency: "JPY", startingBalanceCents: 100000000, currentBalanceCents: 100000000 },
      { id: "chf", name: "CHF Acc", currency: "CHF", startingBalanceCents: 2000000, currentBalanceCents: 2000000 },
    ];

    const res = aggregateAccountsByCurrency(accounts);
    expect(res.currencies).toEqual(["USD", "EUR", "GBP", "JPY", "CHF"].sort((a, b) => {
      return (res.groupsByCurrency[b]?.totalBalanceCents ?? 0) - (res.groupsByCurrency[a]?.totalBalanceCents ?? 0);
    }));
    expect(res.groups.length).toBe(5);
    expect(res.groupsByCurrency["CHF"].startingBalanceCents).toBe(2000000);
    expect(res.currencyNotice).toContain("5 currencies");
  });
});
