# DnD — Financial Metrics & Calculation Specification

## 1. Core Financial Invariants
All currency values are stored as 64-bit integer cents (e.g. `$100.00` = `10000` cents) to completely eliminate floating-point precision loss.

Mathematical operations use banker's rounding (`ROUND_HALF_EVEN`) via `decimal.js`.

---

## 2. Trade P&L Calculations

### 2.1 Directional Move
For a given execution fill:
$$\Delta P = \begin{cases} 
\text{exitPrice} - \text{entryPrice} & \text{if Direction is LONG} \\
\text{entryPrice} - \text{exitPrice} & \text{if Direction is SHORT}
\end{cases}$$

### 2.2 Gross P&L
$$\text{Gross P\&L (cents)} = \Delta P \times \text{exitQty} \times \text{pointValueCents}$$
*Note:* `pointValueCents` is the monetary value in cents of a 1.0 unit price change for 1 contract/lot. Informational `contractSize` is never multiplied twice.

### 2.3 Net P&L
$$\text{Net P\&L (cents)} = \text{Gross P\&L} - (\text{Fees} + \text{Commission} + \text{Swap} + \text{Slippage} + \text{Funding})$$

---

## 3. Risk & Position Sizing

### 3.1 Planned Risk Amount
$$\text{Planned Risk (cents)} = \text{Account Balance (cents)} \times \frac{\text{Planned Risk \%}}{100}$$

### 3.2 Stop Distance
$$\text{Stop Distance} = |\text{Planned Entry Price} - \text{Planned Stop Price}|$$

### 3.3 Position Size
$$\text{Raw Quantity} = \frac{\text{Planned Risk (cents)}}{\text{Stop Distance} \times \text{pointValueCents}}$$
$$\text{Position Size} = \lfloor \frac{\text{Raw Quantity}}{\text{Quantity Step}} \rfloor \times \text{Quantity Step}$$
*(Constrained between `minQuantity` and `maxQuantity`)*

### 3.4 Planned Risk-to-Reward Ratio (Planned R:R)
$$\text{Target Distance} = |\text{Planned Target Price} - \text{Planned Entry Price}|$$
$$\text{Planned R:R} = \frac{\text{Target Distance}}{\text{Stop Distance}}$$

### 3.5 Realized R (Actual R)
$$\text{Realized R} = \frac{\text{Net P\&L (cents)}}{\text{Planned Risk Amount (cents)}}$$

---

## 4. Aggregate & Performance Metrics

### 4.1 Win Rate
Breakeven trades ($\text{Net P\&L} = 0$) are strictly excluded from both numerator and denominator:
$$\text{Win Rate} = \frac{\text{Closed Wins}}{\text{Closed Wins} + \text{Closed Losses}} \times 100\%$$
$$\text{Breakeven Rate} = \frac{\text{Closed Breakevens}}{\text{Total Closed Trades}} \times 100\%$$

### 4.2 Profit Factor
$$\text{Profit Factor} = \frac{\sum \text{Net P\&L of All Winning Trades}}{\sum |\text{Net P\&L of All Losing Trades}|}$$
*(Returns `Infinity` or `null` if total loss is zero)*

### 4.3 Expectancy
$$\text{Expectancy (cents)} = \frac{\sum_{i=1}^{N} \text{Net P\&L}_i}{N} = (\text{Win Rate} \times \text{Avg Win}) - (\text{Loss Rate} \times |\text{Avg Loss}|)$$
$$\text{Expectancy (R)} = \frac{\sum_{i=1}^{N} \text{Realized R}_i}{N}$$

### 4.4 Maximum Drawdown
Calculated chronologically across closed trades using peak-to-trough account equity:
$$\text{Equity}_t = \text{Starting Balance} + \sum_{k=1}^{t} \text{Net P\&L}_k$$
$$\text{Peak}_t = \max_{0 \le s \le t} \text{Equity}_s$$
$$\text{Drawdown}_t = \text{Peak}_t - \text{Equity}_t$$
$$\text{Max Drawdown} = \max_t (\text{Drawdown}_t)$$
*(Returns `null` when aggregate encompasses multiple accounts with heterogeneous starting balances)*

---

## 5. Excursion & Execution Efficiency (MAE / MFE)

### 5.1 Maximum Favorable Excursion (MFE)
Highest unrealized profit reached during the life of the trade:
$$\text{MFE}_{\text{price}} = \begin{cases}
\max(\text{High}_{\text{period}}) - \text{EntryPrice} & \text{for LONG} \\
\text{EntryPrice} - \min(\text{Low}_{\text{period}}) & \text{for SHORT}
\end{cases}$$
$$\text{MFE (cents)} = \text{MFE}_{\text{price}} \times \text{Qty} \times \text{pointValueCents}$$
$$\text{MFE (R)} = \frac{\text{MFE (cents)}}{\text{Planned Risk Amount (cents)}}$$

### 5.2 Maximum Adverse Excursion (MAE)
Greatest unrealized drawdown experienced before exit:
$$\text{MAE}_{\text{price}} = \begin{cases}
\text{EntryPrice} - \min(\text{Low}_{\text{period}}) & \text{for LONG} \\
\max(\text{High}_{\text{period}}) - \text{EntryPrice} & \text{for SHORT}
\end{cases}$$
$$\text{MAE (cents)} = \text{MAE}_{\text{price}} \times \text{Qty} \times \text{pointValueCents}$$

### 5.3 Profit Retention & Exit Efficiency
$$\text{Profit Retention} = \frac{\text{Realized Net P\&L}}{\text{MFE (cents)}} \times 100\% \quad (\text{for winning trades where } \text{MFE} > 0)$$
$$\text{Exit Efficiency} = \frac{\text{Exit Price} - \text{Low}_{\text{trade}}}{\text{High}_{\text{trade}} - \text{Low}_{\text{trade}}} \times 100\% \quad (\text{for LONG})$$

