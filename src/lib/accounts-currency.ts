/**
 * AlphaPips — Multi-Currency Account Aggregation Engine
 *
 * Implements currency-safe aggregation per DEFECT D-017:
 * - Group accounts by their actual denomination (USD, GBP, EUR, JPY, etc.).
 * - Compute monetary totals (starting balance, current balance, net P&L) strictly per-currency.
 * - Never add nominal amounts in different currencies without an authoritative exchange rate.
 * - Non-monetary counts (trades, wins, losses, win rate) may be combined across accounts.
 */

export interface AccountLike {
  id: string;
  name: string;
  currency?: string | null;
  startingBalanceCents: number;
  currentBalanceCents: number;
  isArchived?: boolean;
}

export interface AccountStatsLike {
  count: number;
  wins: number;
  losses: number;
  pnlCents: number;
}

export interface CurrencyGroupSummary {
  currency: string;
  accountsCount: number;
  startingBalanceCents: number;
  currentBalanceCents: number;
  pnlCents: number;
  totalBalanceCents: number;
  tradesCount: number;
  wins: number;
  losses: number;
  closedCount: number;
  winRate: number | null;
}

export interface MultiCurrencyPortfolioSummary {
  isMultiCurrency: boolean;
  currencies: string[];
  groups: CurrencyGroupSummary[];
  groupsByCurrency: Record<string, CurrencyGroupSummary>;
  // Non-monetary totals safe to aggregate across accounts:
  totalAccountsCount: number;
  totalTradesCount: number;
  totalClosedTradesCount: number;
  totalWinsCount: number;
  totalLossesCount: number;
  overallWinRate: number | null;
  // Explanatory notice when multi-currency is active
  currencyNotice: string | null;
}

export function aggregateAccountsByCurrency(
  accounts: AccountLike[],
  statsByAccount?: Map<string, AccountStatsLike> | Record<string, AccountStatsLike>
): MultiCurrencyPortfolioSummary {
  const getStats = (id: string): AccountStatsLike => {
    if (!statsByAccount) return { count: 0, wins: 0, losses: 0, pnlCents: 0 };
    if (statsByAccount instanceof Map) {
      return statsByAccount.get(id) ?? { count: 0, wins: 0, losses: 0, pnlCents: 0 };
    }
    return (statsByAccount as Record<string, AccountStatsLike>)[id] ?? { count: 0, wins: 0, losses: 0, pnlCents: 0 };
  };

  const groupMap = new Map<string, CurrencyGroupSummary>();

  let totalTradesCount = 0;
  let totalClosedTradesCount = 0;
  let totalWinsCount = 0;
  let totalLossesCount = 0;

  for (const acc of accounts) {
    if (acc.isArchived) continue;
    const curr = (acc.currency || "USD").toUpperCase().trim();
    const stats = getStats(acc.id);

    totalTradesCount += stats.count;
    totalWinsCount += stats.wins;
    totalLossesCount += stats.losses;
    const closed = stats.wins + stats.losses;
    totalClosedTradesCount += closed;

    const existing = groupMap.get(curr) ?? {
      currency: curr,
      accountsCount: 0,
      startingBalanceCents: 0,
      currentBalanceCents: 0,
      pnlCents: 0,
      totalBalanceCents: 0,
      tradesCount: 0,
      wins: 0,
      losses: 0,
      closedCount: 0,
      winRate: null,
    };

    existing.accountsCount += 1;
    existing.startingBalanceCents += acc.startingBalanceCents || 0;
    existing.pnlCents += stats.pnlCents;
    existing.tradesCount += stats.count;
    existing.wins += stats.wins;
    existing.losses += stats.losses;
    existing.closedCount += closed;
    // Current total balance is starting capital + realized net P&L from closed trades
    existing.totalBalanceCents = existing.startingBalanceCents + existing.pnlCents;
    existing.currentBalanceCents += acc.currentBalanceCents || (acc.startingBalanceCents + stats.pnlCents);

    existing.winRate = existing.closedCount > 0 ? Math.round((existing.wins / existing.closedCount) * 100) : null;

    groupMap.set(curr, existing);
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => b.totalBalanceCents - a.totalBalanceCents);
  const currencies = groups.map((g) => g.currency);
  const isMultiCurrency = currencies.length > 1;

  const groupsByCurrency: Record<string, CurrencyGroupSummary> = {};
  for (const g of groups) {
    groupsByCurrency[g.currency] = g;
  }

  const overallWinRate =
    totalClosedTradesCount > 0 ? Math.round((totalWinsCount / totalClosedTradesCount) * 100) : null;

  const currencyNotice = isMultiCurrency
    ? `Portfolio contains accounts in ${currencies.length} currencies (${currencies.join(
        ", "
      )}). Capital balances and P&L are grouped by currency to prevent inaccurate unconverted totals.`
    : null;

  return {
    isMultiCurrency,
    currencies,
    groups,
    groupsByCurrency,
    totalAccountsCount: accounts.filter((a) => !a.isArchived).length,
    totalTradesCount,
    totalClosedTradesCount,
    totalWinsCount,
    totalLossesCount,
    overallWinRate,
    currencyNotice,
  };
}
