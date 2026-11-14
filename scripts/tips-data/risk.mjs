// scripts/tips-data/risk.mjs
export const riskTips = [
  {
    title: "The 1% Risk Benchmark",
    tip: "Never risk more than 1% of your current account balance on any single trade idea. If trading a prop firm challenge, keep it strictly under 0.5%.",
    whyItMatters: "At 1% risk per trade, it takes 20 consecutive catastrophic losses to experience a 20% drawdown, which still leaves 80% of your capital intact.",
    practicalAction: "Calculate your dollar risk before setting order lots. If the risk exceeds 1%, do not click entry.",
    principle: "Capital Preservation First"
  },
  {
    title: "Structural Invalidation Over Dollar Stops",
    tip: "Always position your stop loss at the exact price point that mathematically invalidates the trade setup, not at an arbitrary dollar amount.",
    whyItMatters: "Arbitrary stops (e.g. 'I always use a 10-pip stop') either get prematurely stopped out by normal market noise or risk too much on wide structures.",
    practicalAction: "Identify the invalidation swing level first, measure the distance in pips or points, and size your lots to match that distance.",
    principle: "Structural Invalidation"
  },
  {
    title: "Asymmetric Risk-to-Reward Dominance",
    tip: "Target setups with an expected payoff of at least 2:1 or 3:1 reward-to-risk. High asymmetric setups compensate for inevitable losing streaks.",
    whyItMatters: "With a 3:1 R:R, a trader winning only 35% of their trades is comfortably net profitable over large sample sizes.",
    practicalAction: "Filter out trades where the distance to the logical draw on liquidity is less than twice your stop loss distance.",
    principle: "Mathematical Expectancy"
  },
  {
    title: "The Daily Drawdown Hard Cap",
    tip: "Establish a non-negotiable daily loss limit of 2% to 3% of account equity. Once reached, close all charts and disconnect from the broker.",
    whyItMatters: "Most account blowouts occur not from systematic edge failure over months, but in single emotional disaster days.",
    practicalAction: "Enable the Daily Risk Limit floating widget in AlphaPips to visually monitor your consumed daily allowance in real time.",
    principle: "Daily Circuit Breakers"
  },
  {
    title: "Correlated Asset Exposure Limit",
    tip: "Entering long EURUSD and long GBPUSD simultaneously is not two independent trades; it is a double-sized short US Dollar bet.",
    whyItMatters: "When the US Dollar Index (DXY) rallies unexpectedly, both positions will hit stop loss at the same time, doubling your expected drawdown.",
    practicalAction: "Cap total open risk across all correlated USD pairs to a maximum of 1.5% to 2% aggregate exposure.",
    principle: "Correlation & Portfolio Heat"
  },
  {
    title: "The Golden Rule of Moving Stop Losses",
    tip: "You may trail a stop loss forward to protect gains, but you must NEVER move a stop loss backward to give a losing trade more breathing room.",
    whyItMatters: "Widening stops converts controlled, survivable losses into catastrophic portfolio-destroying events.",
    practicalAction: "Once an initial stop is set at market entry, treat that price level as physically locked in concrete.",
    principle: "Uncompromising Invalidation"
  },
  {
    title: "The 50% Drawdown Trap",
    tip: "A 50% loss of capital requires a 100% gain just to return to breakeven; a 75% loss requires a staggering 300% gain to recover.",
    whyItMatters: "Recovery becomes exponentially harder as drawdown deepens due to the asymmetric mathematics of percentage losses.",
    practicalAction: "Cut your risk per trade by 50% whenever your account equity dips 5% below its recent peak.",
    principle: "Asymmetric Drawdown Recovery"
  },
  {
    title: "Instrument-Specific Volatility Buffering",
    tip: "Gold (XAUUSD), Nasdaq (NAS100), and Bitcoin require substantially wider structural buffers than major currency pairs like EURUSD.",
    whyItMatters: "Applying standard Forex pip stop sizes to high-beta commodities or indices guarantees rapid death by market noise.",
    practicalAction: "Use ATR (Average True Range) multipliers or high-timeframe wick extremes when calculating invalidation on Gold and Indices.",
    principle: "Volatility Adaptation"
  },
  {
    title: "Prop Firm High-Water Mark Traps",
    tip: "Understand whether your prop firm challenge uses an end-of-day drawdown trailing mechanism or an intra-day unrealized equity trailing watermark.",
    whyItMatters: "Intra-day trailing drawdowns ratchet upward while a trade is floating in profit, shrinking your drawdown allowance when price retraces.",
    practicalAction: "On intra-day trailing accounts, bank partial profits aggressively into large expansion spikes rather than holding for distant runners.",
    principle: "Contractual Rule Compliance"
  },
  {
    title: "Partial Profit Securing Protocol",
    tip: "Take off 50% to 70% of your position at the first objective liquidity pool (2R or 2.5R) and move the stop loss to breakeven on the remainder.",
    whyItMatters: "Securing partial profits locks in realized positive expectancy and removes all psychological stress from managing the runner.",
    practicalAction: "Set automated limit take-profits at structural liquidity pools rather than trying to manually time peak exits.",
    principle: "Risk-Free Runner Architecture"
  },
  {
    title: "The Danger of Overnight and Weekend Gaps",
    tip: "Close all day trades before the Friday New York market close to eliminate weekend geopolitical gap risk.",
    whyItMatters: "Weekend gaps jump over your stop loss order in the order book, executing at the opening market price with severe slippage.",
    practicalAction: "Establish a hard rule: flat on all intra-day positions by 4:00 PM EST every Friday afternoon.",
    principle: "Gap Risk Elimination"
  },
  {
    title: "Spread Expansion During 5:00 PM EST Rollover",
    tip: "During the New York 5:00 PM EST (22:00 UTC) daily bank rollover, liquidity evaporates and broker spreads expand by 500% or more.",
    whyItMatters: "Wide spreads will trigger tight stop losses even if the underlying market price never touched your level.",
    practicalAction: "Do not hold tight scalps across the 5:00 PM to 5:30 PM EST window. Wait for the Asian session to stabilize.",
    principle: "Rollover Spread Defense"
  },
  {
    title: "Fixed Cash Risk vs Fixed Lot Sizing",
    tip: "Never trade a fixed lot size (e.g., 'always 1.0 lot'). Always dynamically size your lots so that the stop distance equals your exact cash risk budget.",
    whyItMatters: "A 10-pip stop on 1.0 lot is $100 risk, but a 30-pip stop on 1.0 lot is $300 risk—tripling your intended exposure.",
    practicalAction: "Use the AlphaPips Quick Risk Calculator floating widget to instantly compute dynamic lot sizes based on stop distance.",
    principle: "Dynamic Lot Calculation"
  },
  {
    title: "The Equity Curve Stop Mechanism",
    tip: "If your trading strategy experiences an equity drawdown greater than 8% in a month, cease all live trading and switch to a simulator.",
    whyItMatters: "This prevents compounding losses when market regime changes render your specific edge temporarily ineffective.",
    practicalAction: "Conduct a thorough strategy audit on your trade journal before resuming real capital allocation.",
    principle: "Macro System Protection"
  },
  {
    title: "Never Add to a Losing Position",
    tip: "Averaging down on a trade that is moving against your bias is a catastrophic violation of risk management.",
    whyItMatters: "Martingale and averaging down exponentially accelerate account destruction during strong institutional trend expansions.",
    practicalAction: "Accept the initial stop loss. Only add to positions that are already in profit and displaying structural continuation.",
    principle: "Zero Averaging Down"
  },
  {
    title: "Risk Allocation Tiering (A+ vs B Setups)",
    tip: "Risk 1% on textbook A+ setups with complete multi-timeframe alignment, and 0.5% or 0% on secondary B-grade setups.",
    whyItMatters: "Allocating identical capital to mediocre setups dilutes the superior statistical performance of your prime edge.",
    practicalAction: "Create a rigorous 4-point setup scorecard: 4/4 points = full risk, 3/4 points = half risk, less than 3/4 = no trade.",
    principle: "Conviction-Weighted Sizing"
  },
  {
    title: "The Slippage Buffer Consideration",
    tip: "During high-impact news releases, stop orders can slip by 5 to 30 pips depending on available depth of market liquidity.",
    whyItMatters: "Assuming your stop loss is guaranteed to fill at the exact tick can cause you to lose double or triple your intended risk.",
    practicalAction: "Avoid entering new positions 15 minutes before and after high-impact red folder news releases like NFP or CPI.",
    principle: "Execution Friction Awareness"
  },
  {
    title: "Capital Tiering Across Multiple Accounts",
    tip: "Distribute your trading capital across multiple independent accounts or funded challenges rather than concentrating everything in one basket.",
    whyItMatters: "Diversification insulates your overall wealth from broker insolvencies, technical glitches, or individual account drawdown breeches.",
    practicalAction: "Manage multiple smaller accounts with identical proportional risk parameters.",
    principle: "Counterparty Diversification"
  },
  {
    title: "Calculating Strategy Expectancy Formula",
    tip: "Expectancy = (Win% * Average Win Size) - (Loss% * Average Loss Size). Ensure this number is strictly positive over a 50+ trade sample.",
    whyItMatters: "A strategy with a 70% win rate can still be unprofitable if average loss is 3x larger than average win.",
    practicalAction: "Monitor your running expectancy metric inside AlphaPips Performance Analytics weekly.",
    principle: "Expectancy Primacy"
  },
  {
    title: "The Compounding Withdrawal Rhythm",
    tip: "Withdraw a fixed portion (e.g., 50%) of realized monthly profits to build a personal cash reserve outside the markets.",
    whyItMatters: "Regular payouts secure life-changing wealth and protect gains against future unforeseen drawdown cycles.",
    practicalAction: "Automate a monthly calendar withdrawal milestone on the 1st of every month.",
    principle: "Profit Realization"
  },
  {
    title: "Accounting for Financing and Swap Rates",
    tip: "Holding positions across days incurs negative swap rates if trading against interest rate differentials (carry cost).",
    whyItMatters: "Over weeks, negative swap charges erode profits on tight swing trades and widen the effective breakeven threshold.",
    practicalAction: "Check overnight swap rates on your broker's symbol specification page before initiating multi-day swing positions.",
    principle: "Carrying Cost Accounting"
  },
  {
    title: "The Breakeven Stop Illusion",
    tip: "A true breakeven stop must be set at Entry Price + Commission + Average Spread, not the bare fill tick.",
    whyItMatters: "Setting the stop at the exact entry tick still produces a net monetary loss due to round-turn commissions and bid-ask spreads.",
    practicalAction: "Add 1 to 2 pips to your breakeven level to cover all friction costs.",
    principle: "Friction-Adjusted Breakeven"
  },
  {
    title: "Scaling Out into Liquidity Voids",
    tip: "When price enters an unexplored low-volume area, momentum can reverse instantaneously. Scale out into the expansion.",
    whyItMatters: "Liquidity voids offer rapid price delivery but lack structural support upon reversal.",
    practicalAction: "Take partial profits when price fills 80% of an open liquidity void.",
    principle: "Void Absorption Management"
  },
  {
    title: "The Maximum Open Trades Constraint",
    tip: "Set a hard ceiling of 2 or 3 concurrent open trades at any single moment across your entire portfolio.",
    whyItMatters: "Managing more than 3 active positions overwhelms working memory and prevents rapid risk adjustments during volatility spikes.",
    practicalAction: "If 3 trades are open, ignore new setup alerts until at least one position is closed or moved to risk-free status.",
    principle: "Cognitive Bandwidth Cap"
  },
  {
    title: "Managing Risk During Low-Liquidity Holiday Periods",
    tip: "Halve your standard position sizing during summer doldrums (August) and the last two weeks of December.",
    whyItMatters: "Thin liquidity produces erratic price jumps, false breakouts, and wider execution spreads.",
    practicalAction: "Reduce default risk from 1% to 0.5% during documented bank holiday periods.",
    principle: "Seasonal Volatility Adjustment"
  },
  {
    title: "The 3R Risk Rule for Breakeven Adjustments",
    tip: "Do not move your stop loss to breakeven until the trade has traversed at least 2R to 3R in your intended direction.",
    whyItMatters: "Premature breakeven adjustments choke trades before they can absorb normal minor liquidity retests.",
    practicalAction: "Allow the initial stop to remain untouched until the first high-timeframe structural target is secured.",
    principle: "Structural Room for Variance"
  },
  {
    title: "Evaluating Risk of Ruin Statistics",
    tip: "At 1% risk per trade with a 45% win rate and 2:1 R:R, your mathematical risk of ruin is less than 0.01%. At 5% risk, it surges to over 30%.",
    whyItMatters: "Leverage is non-linear; increasing risk percentage exponentially multiplies the probability of catastrophic account liquidation.",
    practicalAction: "Keep your risk firmly anchored at or below 1% to maintain a near-zero mathematical probability of ruin.",
    principle: "Risk of Ruin Mathematics"
  },
  {
    title: "The Psychological Cost of High Leverage",
    tip: "Just because your broker offers 1:100 or 1:500 leverage does not mean you should ever utilize more than 1:5 to 1:10 effective leverage.",
    whyItMatters: "Extreme leverage turns standard 15-minute market fluctuations into emotionally unbearable equity swings.",
    practicalAction: "Check your effective account leverage (Total Notional Position Value / Total Equity) before opening positions.",
    principle: "Prudent Capital Deployment"
  },
  {
    title: "Trailing Stop Placement Behind Protected Pivots",
    tip: "When trailing a winning trade, only trail your stop behind confirmed protected swing highs or lows, never behind single candles.",
    whyItMatters: "Market algorithms regularly sweep the previous 1-minute or 5-minute candle wicks before expanding towards high-timeframe targets.",
    practicalAction: "Identify the protected structural swing point that caused displacement before moving your trailing stop.",
    principle: "Protected Pivot Trailing"
  },
  {
    title: "The Drawdown Ratchet Sizing Rule",
    tip: "When your account reaches a new all-time high, keep sizing based on the new equity. In a drawdown, base sizing on current depleted equity, not peak equity.",
    whyItMatters: "Sizing based on historical peak balance during a drawdown artificially accelerates percentage loss on remaining capital.",
    practicalAction: "Always base your 1% risk on current realized account equity.",
    principle: "Adaptive Position Sizing"
  },
  {
    title: "Managing Risk Across Multiple Correlated JPY Crosses",
    tip: "Trading EURJPY, GBPJPY, and CADJPY at the same time is a concentrated macro bet on Bank of Japan monetary policy.",
    whyItMatters: "When the BoJ intervenes or the Yen strengthens, all JPY crosses collapse synchronously, generating triple expected losses.",
    practicalAction: "Select the single cleanest technical setup among the JPY crosses and leave the rest alone.",
    principle: "Cross-Currency Pruning"
  },
  {
    title: "Predefining Daily Profit Targets and Shutting Down",
    tip: "Once you achieve +3R to +4R in a single day, lock in the profit, shut down your platform, and declare the day a victory.",
    whyItMatters: "Trading after a huge gain invites overconfidence and often leads to giving back all gains to the market by day's end.",
    practicalAction: "Celebrate hitting your target by closing all trading applications and focusing on offline life.",
    principle: "Profit Locking Protocol"
  },
  {
    title: "The Danger of Fixed Dollar Targets",
    tip: "Never trade with the goal of making '$500 today'. The market does not provide identical dollar opportunities every day.",
    whyItMatters: "Fixed dollar goals force trades on dead market days where no valid technical setups exist.",
    practicalAction: "Measure progress strictly in R-multiples and setup quality, never in daily dollar quotas.",
    principle: "Market-Dictated Returns"
  },
  {
    title: "Accountability for Manual Exits",
    tip: "Every manual close of an active trade before hitting Stop Loss or Take Profit must be documented with an objective structural reason.",
    whyItMatters: "Closing trades early out of fear destroys your strategy's calculated payoff asymmetry over time.",
    practicalAction: "If you feel the urge to manually close, ask: 'Did market structure officially shift against me, or am I just scared?'",
    principle: "Structural Justification"
  },
  {
    title: "Protecting Against Overnight Margin Calls",
    tip: "Brokers often raise margin requirements on weekends and before elections or major geopolitical votes.",
    whyItMatters: "A position that was safely within margin during standard hours can trigger an automated liquidation if margin requirements double.",
    practicalAction: "Never hold maximum allowable margin positions into weekend closes.",
    principle: "Margin Buffer Management"
  },
  {
    title: "The Rule of Consecutive Losses",
    tip: "Three consecutive losses on the same instrument indicates that your current bias is out of sync with institutional order flow.",
    whyItMatters: "Repeatedly fading a strong trend out of conviction that 'it has moved too far' results in severe account damage.",
    practicalAction: "Place that instrument in timeout for 24 hours after 3 consecutive losses.",
    principle: "Symbol Quarantine"
  },
  {
    title: "Risk-Free Trade Transition Timing",
    tip: "Wait for price to clear the opposing swing high/low before securing breakeven.",
    whyItMatters: "Shifting stops too early before market structure confirms continuation leads to being wicked out right before the big expansion.",
    practicalAction: "Require a verified Break of Structure (BOS) on the execution timeframe before moving your stop.",
    principle: "Confirmation Milestone"
  },
  {
    title: "The Hidden Cost of High-Frequency Trading",
    tip: "Taking 15 day-trades per day racks up hundreds of dollars in broker commission and bid-ask spread friction every week.",
    whyItMatters: "High turnover creates a massive fee hurdle that turns marginally profitable strategies into net losers.",
    practicalAction: "Focus on 1 to 2 high-conviction A+ setups per day with clean 3R+ targets.",
    principle: "Friction Optimization"
  },
  {
    title: "Capitalizing on Asymmetric Loss Recovery",
    tip: "Protect your capital fanatically when at all-time equity highs; it is much easier to preserve money than to earn it back.",
    whyItMatters: "Loss of capital requires exponentially greater future performance to achieve recovery.",
    practicalAction: "Treat every single dollar of account balance as an irreplaceable soldier in your financial army.",
    principle: "Capital Sanctity"
  },
  {
    title: "Defending Against Flash Crashes",
    tip: "Never trade without a hard stop loss physically registered on your broker's server.",
    whyItMatters: "Flash crashes and liquidity vacuums can drop prices by hundreds of pips in seconds; mental stops will not protect you.",
    practicalAction: "Always ensure your stop order is active and accepted by the server the moment your order enters the market.",
    principle: "Server-Side Stop Mandate"
  },
  {
    title: "Dynamic Risk Reduction During Losing Streaks",
    tip: "If you lose 3 trades in a row, reduce your risk per trade from 1.0% to 0.5% until you achieve two consecutive winning trades.",
    whyItMatters: "This soft-landing protocol dramatically cushions your equity curve during rough market conditions.",
    practicalAction: "Automate your risk sizing protocol to scale down during drawdown phases.",
    principle: "Dynamic Deceleration"
  },
  {
    title: "Trading Accounts vs Operating Capital",
    tip: "Only keep the minimum capital required for margin and drawdown cushion in your brokerage account; keep the rest in high-yield bank savings.",
    whyItMatters: "Keeping 100% of your net worth in a brokerage account exposes all your capital to broker insolvency and emotional fat-finger errors.",
    practicalAction: "Maintain an operating cash reserve completely isolated from your trading environment.",
    principle: "Capital Isolation"
  },
  {
    title: "Avoiding the Temptation of 'Risk-Free' Arbitrage",
    tip: "Be skeptical of strategies that promise 95%+ win rates or risk-free arbitrage in retail Forex and CFD markets.",
    whyItMatters: "Almost all ultra-high win rate systems rely on hidden catastrophic tail risk (like holding huge unhedged drawdowns).",
    practicalAction: "Favor realistic strategies with 40-60% win rates and robust, transparent 2:1+ reward-to-risk profiles.",
    principle: "Tail Risk Transparency"
  },
  {
    title: "The Weekend Risk-Reward Calculation",
    tip: "Holding through the weekend offers zero reward during the 48 hours the market is closed, yet exposes you to full weekend event risk.",
    whyItMatters: "The risk-to-reward ratio of holding over weekends is mathematically zero reward for immense potential tail risk.",
    practicalAction: "Close intra-week swing trades on Friday unless you have established a multi-week macro position with huge cushion.",
    principle: "Temporal Exposure Valuation"
  },
  {
    title: "Managing Risk on Tier-1 Economic Data Days",
    tip: "On days with US Non-Farm Payrolls (NFP) or FOMC Interest Rate decisions, reduce your daily trading frequency to zero until the dust settles.",
    whyItMatters: "Spreads widen unpredictably and algorithms hunt both sides of liquidity in violent whipsaws within milliseconds.",
    practicalAction: "Sit on your hands during major release minutes and look for clean technical setups 30 minutes after the news.",
    principle: "News Volatility Defense"
  },
  {
    title: "Sizing Down on Unfamiliar Instruments",
    tip: "When trading a new asset class or currency cross for the first time, trade at 25% of your standard position size for the first 30 trades.",
    whyItMatters: "Every instrument has unique liquidity dynamics, tick values, session quirks, and average daily ranges.",
    practicalAction: "Acclimate to symbol mechanics with minimal capital exposure before deploying full size.",
    principle: "Instrument Acclimation"
  },
  {
    title: "Establishing a Recovery Milestone Buffer",
    tip: "After recovering from a 6% drawdown back to breakeven, do not immediately increase your risk size.",
    whyItMatters: "Traders often feel overconfident after escaping a drawdown and immediately plunge back into the hole.",
    practicalAction: "Maintain your conservative sizing until you make at least 2% in fresh all-time new high profit.",
    principle: "Post-Recovery Stabilization"
  },
  {
    title: "Accounting for Execution Delay",
    tip: "Factor in 50-150ms of network latency when placing market orders in fast-moving conditions.",
    whyItMatters: "During rapid price spikes, market orders fill at the worst end of the bid-ask book, skewing your intended entry price.",
    practicalAction: "Use limit orders resting at high-probability PD arrays rather than chasing market momentum.",
    principle: "Latency & Slippage Control"
  },
  {
    title: "The Power of Strict Stop Adherence",
    tip: "A trader who executes stops with robotic discipline cannot be liquidated by market mechanics. Only undisciplined traders get liquidated.",
    whyItMatters: "Market crashes only destroy those who refuse to take their predetermined small losses.",
    practicalAction: "Take pride in executing clean, disciplined stop losses; it is the hallmark of professional survival.",
    principle: "Robotic Defense"
  },
  {
    title: "Aligning Risk with Strategy Edge",
    tip: "If a setup has an 80% historical win rate with 1.5R payoff, and another has a 35% win rate with 4R payoff, size accordingly to smooth equity.",
    whyItMatters: "High R-multiple setups suffer longer losing streaks, requiring conservative sizing to endure variance.",
    practicalAction: "Know the maximum historical drawdown streak of your setup model and size so that 10 consecutive losses won't breach your limit.",
    principle: "Distribution Alignment"
  },
  {
    title: "The Ultimate Definition of Risk Management",
    tip: "Risk management is not about avoiding losses; it is about guaranteeing that no single loss, or series of losses, can ever take you out of the game.",
    whyItMatters: "Longevity is the absolute prerequisite for compounding wealth in financial trading.",
    practicalAction: "Before placing any order, ask yourself: 'If this trade fails completely, will I be 100% fine tomorrow?'",
    principle: "Eternal Longevity"
  },
  {
    title: "Defending Against Black Swan Events",
    tip: "Black swan events occur far more frequently in financial markets than standard bell-curve Gaussian distributions predict.",
    whyItMatters: "Fat-tailed distribution events (SNB unpeg, COVID crash, flash crashes) will eventually hit your open charts.",
    practicalAction: "Never use maximum leverage, always maintain server stops, and never trade money you cannot afford to lose.",
    principle: "Fat-Tail Protection"
  }
];
