# ALPHAPIPS — FINANCIAL ALGORITHMS & BUSINESS LOGIC MASTER REFERENCE
**Authoritative Mathematical Specification, Execution Logic & Financial Intelligence**

---

## 1. COMPUTATIONAL PHILOSOPHY & CANONICAL ARCHITECTURE

AlphaPips is designed to eliminate financial ambiguity, precision loss, and duplicated business logic across client and server surfaces.

### Core Mathematical Laws:
1. **Single Authoritative Engine:** All official P&L, position sizing, risk multiples, drawdown, and win rates are calculated exclusively by `src/lib/financial-engine.ts`. The frontend interface performs real-time UI estimations for responsive form feedback, but server-persisted records are unconditionally recomputed server-side.
2. **Strict Minor-Unit Money Arithmetic:** All currency quantities are maintained as integer minor units (`BigInt` / cents). Floating-point `number` arithmetic is strictly forbidden for stored money.
3. **High-Precision Explicit Decimals:** Prices and quantities are handled as decimal strings and manipulated via scaled BigInt arithmetic or `decimal.js` (`src/lib/decimal.ts`).
4. **Banker's Rounding (Round-Half-to-Even):** Division operations on integer minor units use banker's rounding to eliminate statistical upward bias in large trade populations.
5. **Universal P&L Model (Representation B):**
   - `quantity` = Number of tradable units (Lots for Forex/Gold, Contracts for Futures/Indices, Coins for Crypto).
   - `pointValueCents` = Authoritative monetary value (in cents) of a 1.0 price movement for 1.0 quantity unit.
   - `contractSize` = Informational only (underlying physical units per lot, e.g. 100,000 for standard Forex, 100 oz for Gold). **`contractSize` is NEVER multiplied in formulas, preventing catastrophic double-multiplication bugs.**

---

## 2. MULTI-MARKET FINANCIAL ECONOMICS & SPECIFICATIONS

### 2.1 The Universal P&L Formula
For a trade with average entry price $P_{entry}$, average exit price $P_{exit}$, realized quantity $Q$, and point value $V_{point}$:

$$\Delta P_{dir} = \begin{cases} P_{exit} - P_{entry} & \text{if Long} \\ P_{entry} - P_{exit} & \text{if Short} \end{cases}$$

$$\text{Gross P\&L (cents)} = \Delta P_{dir} \times Q \times V_{point}$$

$$\text{Total Costs (cents)} = \text{Fees} + \text{Commission} + \text{Swap} + \text{Slippage}$$

$$\text{Net P\&L (cents)} = \text{Gross P\&L} - \text{Total Costs}$$

### 2.2 Market-Specific Economic Parameters

| Asset Class | Exemplar Symbol | Quantity Unit ($Q$) | Contract Size (Info) | Min Tick ($P_{tick}$) | Point Value ($V_{point}$) in Cents | Pip Size | Monetary Value per 1.0 Unit |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Forex Majors** | `EURUSD` | Lots | 100,000 | 0.00001 | 10,000,000 | 0.0001 | 1 Lot: 1.0 move = $100,000<br>1 Pip = $10.00 |
| **Forex Minors** | `EURGBP` | Lots | 100,000 | 0.00001 | 10,000,000 (Quote GBP) | 0.0001 | 1 Lot: 1 Pip = £10.00 (Converted to USD) |
| **Gold CFD** | `XAUUSD` | Lots | 100 oz | 0.01 | 10,000 | 0.01 ($0.01) | 1 Lot: $1.00 move = $100.00<br>0.01 Lot: $1.00 move = $1.00 (1 oz) |
| **Gold Futures** | `GC` | Contracts | 100 oz | 0.10 | 10,000 | N/A | 1 Contract: $1.00 move = $100.00 |
| **Micro Gold** | `MGC` | Contracts | 10 oz | 0.10 | 1,000 | N/A | 1 Contract: $1.00 move = $10.00 |
| **Silver CFD** | `XAGUSD` | Lots | 5,000 oz | 0.001 | 500,000 | 0.01 | 1 Lot: $1.00 move = $5,000.00 |
| **E-mini Nasdaq** | `NQ` | Contracts | 20 | 0.25 | 2,000 | N/A | 1 Contract: 1.0 Index Point = $20.00<br>1 Tick (0.25) = $5.00 |
| **Micro Nasdaq** | `MNQ` | Contracts | 2 | 0.25 | 200 | N/A | 1 Contract: 1.0 Index Point = $2.00<br>1 Tick (0.25) = $0.50 |
| **E-mini S&P 500** | `ES` | Contracts | 50 | 0.25 | 5,000 | N/A | 1 Contract: 1.0 Index Point = $50.00<br>1 Tick (0.25) = $12.50 |
| **Micro S&P 500** | `MES` | Contracts | 5 | 0.25 | 500 | N/A | 1 Contract: 1.0 Index Point = $5.00<br>1 Tick (0.25) = $1.25 |
| **Crude Oil** | `CL` | Contracts | 1,000 bbl | 0.01 | 100,000 | N/A | 1 Contract: $1.00 move = $1,000.00 |
| **Crypto** | `BTCUSD` | Coins | 1 BTC | 0.01 | 100 | N/A | 1 Coin: $1.00 move = $1.00<br>$1,000 move = $1,000.00 |

### 2.3 Concrete Calculation Verifications

1. **XAUUSD 0.01 Lot (Screenshot Test):**
   - Entry: 2350.00, Stop: 2349.00 (Stop distance = $1.00).
   - Quantity: 0.01 Lot, Point value: 10,000 cents ($100/lot).
   - Risk = $1.00 \times 0.01 \times 10,000 = 100\text{ cents} = \$1.00$. ✓
2. **NQ Futures 1 Contract:**
   - Entry: 20000.00, Exit: 20010.00 (Move = +10.00 index points).
   - Quantity: 1 Contract, Point value: 2,000 cents ($20/point).
   - Gross P&L = $10.00 \times 1 \times 2,000 = 20,000\text{ cents} = \$200.00$. ✓
3. **EURUSD 1.00 Standard Lot:**
   - Entry: 1.10000, Exit: 1.10800 (Move = +0.00800 = 80 pips).
   - Quantity: 1.00 Lot, Point value: 10,000,000 cents ($100,000/lot).
   - Gross P&L = $0.00800 \times 1 \times 10,000,000 = 80,000\text{ cents} = \$800.00$. ✓

---

## 3. POSITION SIZING & RISK ALGORITHMS

### 3.1 Universal Position Sizing Algorithm (`calculatePositionSize`)
Calculates the exact contract/lot size required to risk an exact percentage of account balance:

1. **Risk Budget ($B_{risk}$):**
   $$B_{risk} = \text{AccountBalanceCents} \times \text{RiskPct}$$
2. **Stop Distance ($D_{stop}$):**
   $$D_{stop} = |P_{entry} - P_{stop}|$$
3. **Risk per Unit ($R_{unit}$):**
   $$R_{unit} = D_{stop} \times V_{point}$$
4. **Raw Tradable Quantity ($Q_{raw}$):**
   $$Q_{raw} = \frac{B_{risk}}{R_{unit}}$$
5. **Quantity Stepping & Floor Rounding:**
   Positions must adhere to broker lot/contract increments ($S_{step}$, e.g. 0.01 for forex, 1.0 for futures):
   $$Q_{rounded} = \left\lfloor \frac{Q_{raw}}{S_{step}} \right\rfloor \times S_{step}$$
6. **Actual Realized Risk ($R_{actual}$):**
   $$R_{actual} = Q_{rounded} \times R_{unit}$$
   - *Validation Guards:*
     - If $\text{RiskPct} < 0$: returns error `Risk percentage cannot be negative`.
     - If $\text{RiskPct} > 1.0$: returns error `Risk percentage cannot exceed 100%`.
     - If $Q_{rounded} < Q_{min}$: flags `minimumTradableExceedsBudget = true`.

### 3.2 Planned Risk-to-Reward Ratio (`plannedRR`)
Defined as the ratio of target price excursion to stop loss risk distance:

$$D_{target} = |P_{target} - P_{entry}|$$
$$\text{Planned R:R} = \frac{D_{target}}{D_{stop}}$$

### 3.3 Realized R-Multiple (`actualR`)
Measures the net financial return normalized by the planned risk amount:

$$\text{Actual R} = \frac{\text{Net P\&L (account currency cents)}}{\text{Planned Risk Amount (account currency cents)}}$$
- Stored as an exact 6-decimal string (e.g. `"+2.450000"`, `"-1.000000"`).
- Null if planned risk was undefined or zero.

### 3.4 Partial Exits Calculation
Every trade execution is immutable. For a trade with entries $E_1, E_2, \dots, E_m$ and exits $X_1, X_2, \dots, X_n$:
1. Compute Volume Weighted Average Entry Price:
   $$\bar{P}_{entry} = \frac{\sum_{i=1}^m (P_{e,i} \times Q_{e,i})}{\sum_{i=1}^m Q_{e,i}}$$
2. Each exit fill $X_j$ is calculated independently against $\bar{P}_{entry}$:
   $$\text{P\&L}_j = (\Delta P_{dir, j}) \times Q_{x,j} \times V_{point}$$
3. Total Gross P&L is the exact summation:
   $$\text{Gross P\&L} = \sum_{j=1}^n \text{P\&L}_j$$

---

## 4. AGGREGATE PERFORMANCE ANALYTICS ALGORITHMS

Computed in `computeAggregateMetrics` (`src/lib/financial-engine.ts`):

### 4.1 Population Segregation
- **Closed Trades:** Outcomes `win`, `loss`, `breakeven`.
- **Partial Trades:** Outcomes `partial_win`, `partial_loss`, `partial_breakeven`.
- **Open Trades:** Outcome `open` (excluded from realized performance).
- **Excluded Records:** Drafts (`isDraft: true`), planned orders (`status: "planned"`), and synthetic sample records (`isSyntheticSampleTrade`) are strictly excluded from all official metrics.

### 4.2 Win Rate & Breakeven Rate
Breakevens are strictly excluded from the win rate denominator to prevent win-rate distortion:

$$\text{Win Rate} = \frac{N_{wins}}{N_{wins} + N_{losses}} \times 100$$

$$\text{Breakeven Rate} = \frac{N_{breakeven}}{N_{closed}} \times 100$$

### 4.3 Profit Factor
Ratio of gross profits to gross losses:

$$\text{Profit Factor} = \frac{\sum \text{Net P\&L of winning trades}}{\left| \sum \text{Net P\&L of losing trades} \right|}$$
- If gross profits = 0 and gross losses = 0: returns `null`.
- If gross losses = 0 and gross profits > 0: returns `"Infinity"`.

### 4.4 Trade Expectancy
Expected financial return per closed trade execution:

$$\text{Expectancy (\$) } = \frac{\sum_{i=1}^{N_{closed}} \text{Net P\&L}_i}{N_{closed}}$$

$$\text{Expectancy (R)} = \frac{\sum_{i=1}^{N_{closed}} \text{Actual R}_i}{N_{closed}}$$

### 4.5 Maximum Drawdown & Recovery Status
Calculated chronologically across closed and partial trades ordered strictly by `exitTime ASC`:

1. Let $E_0 = \text{StartingBalanceCents}$.
2. For each trade $t_k$, running equity $E_k = E_{k-1} + \text{NetPnlCents}_k$.
3. Running Peak (High-Water Mark):
   $$H_k = \max(H_{k-1}, E_k)$$
4. Running Drawdown:
   $$DD_k = H_k - E_k$$
5. Maximum Drawdown:
   $$\text{MaxDD} = \max_k (DD_k)$$
6. Maximum Drawdown Percentage: Peak-to-trough drop from the specific peak $H_{atMax}$ that produced the maximum dollar drawdown:
   $$\text{MaxDD \%} = \frac{\text{MaxDD}}{H_{atMax}} \times 100$$
7. Drawdown Recovered Flag:
   $$\text{Recovered} = (E_{current} \ge H_{atMax})$$

### 4.6 Streaks Analysis
- **Current Streaks:** Traverses trades backwards from most recent `exitTime`.
- **Max Streaks:** Traverses chronologically forward. Breakeven trades reset both win and loss streak counters.

---

## 5. PROP FIRM & LIFECYCLE INTELLIGENCE ENGINE

Implemented in `src/lib/prop-firm-engine.ts` and `src/lib/prop-lifecycle-engine.ts`.

### 5.1 Trading Day Cycle & The 17:00 NY Reset Algorithm (`getTradingCycleKey`)
Prop firms do not use calendar midnight UTC. Rules reset daily at a specified market hour (standard: 17:00 / 5:00 PM New York Eastern Time).

- **Algorithm:**
  1. Convert trade timestamp into target IANA timezone (e.g. `America/New_York`) via `Intl.DateTimeFormat`.
  2. Extract local hour $H_{local}$.
  3. If $H_{local} < 17$: The trade belongs to the cycle that opened at 17:00 on the *previous calendar day*. Decrement local date by 1 day.
  4. Returns standardized cycle key `YYYY-MM-DD`.
  - *DST Invariance:* Handles Eastern Daylight Time (EDT, UTC-4) and Eastern Standard Time (EST, UTC-5) automatically.

### 5.2 Daily Loss Limit Evaluation
Monitors cumulative realized losses within the current active 17:00–17:00 NY trading cycle:

$$\text{Today P\&L} = \sum_{t \in \text{CurrentCycle}} \text{Net P\&L}_t$$

$$\text{Today Loss} = \max(0, -\text{Today P\&L})$$

$$\text{Daily Loss Breached} = (\text{Today Loss} \ge \text{DailyLossLimitCents})$$

$$\text{Warning Threshold} = (\text{Today Loss} \ge 0.75 \times \text{DailyLossLimitCents})$$

### 5.3 Static vs Trailing Drawdown
1. **Static Drawdown:**
   Floor remains fixed relative to starting balance:
   $$\text{Floor}_{static} = \text{StartingBalanceCents} - \text{MaxDrawdownCents}$$
   $$\text{Breached} = (E_{current} < \text{Floor}_{static})$$
2. **Trailing Drawdown:**
   Floor trails the account high-water mark:
   $$HWM = \max(\text{StartingBalance}, \max_k(E_k))$$
   $$\text{Floor}_{trailing} = HWM - \text{MaxDrawdownCents}$$
   $$\text{Breached} = (E_{current} < \text{Floor}_{trailing})$$

### 5.4 Consistency Rules & Dilution Logic
Prop firms restrict accounts where a single lucky trading day represents an excessive proportion of total profits.

- **Single-Day Consistency Metric:**
  $$P_{total} = \max(0, \text{NetProfitCents})$$
  $$P_{bestDay} = \max_{cycle} (\text{DailyPnlCents}_{cycle})$$
  $$\text{Best Day \%} = \frac{P_{bestDay}}{P_{total}} \times 100$$
- **Enforcement Actions (`ConsistencyAction`):**
  - `warning`: Surfaces warning pill when within 5% of threshold.
  - `dilution_required` / `soft_rule`: Challenge is not failed. Instead, calculates required additional profit:
    $$P_{requiredTotal} = \frac{P_{bestDay}}{\text{ThresholdPct}}$$
    $$P_{dilutionNeeded} = P_{requiredTotal} - P_{total}$$
  - `payout_restricted`: Blocks payout disbursement until profit is diluted across more trading days.
  - `hard_breach`: Marks challenge as breached.

### 5.5 Forensic Failure Diagnostic Engine
When a rule breach occurs, the engine generates an immutable diagnostic record:
- `ruleKey`: Violated rule (e.g. `daily_loss_limit`, `trailing_drawdown`).
- `thresholdValue`: Exact contracted limit (e.g. `$5,000.00`).
- `actualValue`: Actual recorded value (e.g. `$5,240.50`).
- `amountExceeded`: Exact breach excess (e.g. `$240.50`).
- `contributingTradeIds`: Exact trade IDs executed during the breach window.
- `cycleResetTime`: Timestamp of the active 17:00 NY cycle window.

---

## 6. CHECKLIST ADHERENCE ALGORITHM (DECOUPLED FROM WIN RATE)

Implemented in `src/lib/checklist-adherence.ts`.

### 6.1 The Adherence Fallacy Correction
In early implementations, checklist adherence was approximated using win rate. This is conceptually invalid: a trader can violate all rules and win, or follow all rules and lose. AlphaPips calculates true discipline from recorded checklist answers.

### 6.2 Adherence Formula
For a strategy version with checklist items $I_1, I_2, \dots, I_m$ and recorded trade evaluation answers $A$:

$$I_{req} = \{ i \in I \mid i.\text{required} = \text{true} \}$$

$$I_{comp} = \{ i \in I_{req} \mid A[i.\text{id}].\text{checked} = \text{true} \}$$

$$\text{Checklist Adherence \%} = \begin{cases} \frac{|I_{comp}|}{|I_{req}|} \times 100 & \text{if } |I_{req}| > 0 \\ \text{null} & \text{if no required items} \end{cases}$$

- **Missing Data Handling:** If a trade has no checklist answers recorded (`rawAnswersJson = null`), it is categorized as `missingDataTrades`. Its unrecorded items are **never counted as completed**, preventing false 100% adherence scores.
- **Independence:** Win rate and adherence percentage are computed completely independently and presented side-by-side.

---

## 7. DATA QUALITY & RESTORE DEDUPLICATION SCORING

### 7.1 Data Health Score (`DataQualityTab`)
Scans trade records for missing parameters:
- Missing Stop Loss: High risk penalty.
- Missing Session: Medium penalty.
- Missing Strategy/Setup Attribution: Medium penalty.
- Missing Checklist Evaluation: Low penalty.
$$\text{Data Health Score} = 100 - (\text{Penalties})$$

### 7.2 Backup Restore Duplicate Scoring (`/api/backups/preview`)
When an archive is uploaded, every trade is evaluated against existing database records:
- **100% Exact Match:** Identical account, instrument, entry time, entry price, exit price, and net P&L. Action: skipped or updated.
- **85% Likely Duplicate:** Same account, symbol, and entry time within 60 seconds, but minor difference in notes or tags.
- **60% Possible Match:** Same symbol and trading day.
- **0% Distinct:** New record; safe for insertion.
