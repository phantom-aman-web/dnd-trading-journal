// scripts/tips-data/backtesting.mjs
export const backtestingTips = [
  {
    title: "Minimum Statistical Sample Size (100+ Trades)",
    tip: "Never evaluate a new trading strategy on a sample size smaller than 100 consecutive trades across diverse market conditions.",
    whyItMatters: "Small samples (10-20 trades) are dominated by random variance; an inferior strategy can win 15 trades in a row purely by luck.",
    practicalAction: "Backtest a minimum of 100 historical trades before risking a single real dollar on any new setup idea.",
    principle: "Statistical Significance"
  },
  {
    title: "The Hindsight Bias Trap in Bar Replay",
    tip: "When using chart bar-replay tools, hide future price action completely and force yourself to make decisions tick-by-tick without peeking ahead.",
    whyItMatters: "Knowing where price eventually moved primes your brain to subconsciously cherry-pick winning patterns that you would never trade live.",
    practicalAction: "Use strict blind bar-replay modes where the future candles are 100% masked from your visual field.",
    principle: "Blind Replay Fidelity"
  },
  {
    title: "Out-of-Sample Forward Testing Validation",
    tip: "Split your historical data: build and optimize your strategy on 70% of historical data (In-Sample), then test it untouched on the remaining 30% (Out-of-Sample).",
    whyItMatters: "A strategy that performs brilliantly in-sample but fails out-of-sample is over-fitted and guaranteed to fail in live trading.",
    practicalAction: "Reserve the most recent 12 months of historical data strictly for out-of-sample forward testing.",
    principle: "Out-of-Sample Verification"
  },
  {
    title: "The Dangers of Curve-Fitting and Over-Optimization",
    tip: "If your strategy requires 12 different indicators and 8 ultra-specific parameter thresholds, you have curve-fitted historical noise rather than discovering an edge.",
    whyItMatters: "Over-optimized models fit past random noise perfectly but shatter immediately when exposed to fresh live market data.",
    practicalAction: "Favor simple, robust models with 2-3 objective structural rules that work across multiple timeframes and symbols.",
    principle: "Occam's Razor in Strategy Design"
  },
  {
    title: "Factoring Commission, Spread, and Slippage into Backtests",
    tip: "Always subtract realistic broker spread, round-turn commissions, and 1 pip of average slippage from every single backtested trade.",
    whyItMatters: "Strategies that appear highly profitable on raw chart ticks often turn into massive losers once real-world friction costs are deducted.",
    practicalAction: "Deduct at least 1.5 to 2.0 pips per trade in your backtesting spreadsheet models.",
    principle: "Friction-Adjusted Backtesting"
  },
  {
    title: "Testing Across Distinct Market Regimes",
    tip: "Ensure your backtest dataset includes bull markets, bear markets, high-volatility flash crashes, and prolonged sideways summer consolidations.",
    whyItMatters: "A strategy backtested only during a strong 6-month bull run will collapse as soon as the market enters a choppy range.",
    practicalAction: "Test your model across at least two full calendar years that encompass varied economic volatility cycles.",
    principle: "Multi-Regime Stress Testing"
  },
  {
    title: "Calculating Strategy Expectancy Formula",
    tip: "Expectancy = (Win% * Average Win R) - (Loss% * Average Loss R). If this number is not positive and greater than 0.3R, do not trade it.",
    whyItMatters: "Expectancy provides the pure mathematical expected return per trade over an infinite series of executions.",
    practicalAction: "Compute your expectancy value at every 25-trade milestone in your backtesting spreadsheet.",
    principle: "Mathematical Expectancy Hurdle"
  },
  {
    title: "Sharpe and Sortino Ratio Calculation",
    tip: "Sortino ratio evaluates risk-adjusted return by penalizing ONLY downside volatility, making it superior to Sharpe ratio for asymmetric traders.",
    whyItMatters: "A high Sortino ratio indicates steady equity growth without gut-wrenching drawdown spikes.",
    practicalAction: "Target a Sortino ratio greater than 1.5 in your strategy development metrics.",
    principle: "Downside Volatility Assessment"
  },
  {
    title: "Maximum Drawdown Estimation (Monte Carlo Simulation)",
    tip: "Run a Monte Carlo simulation of your backtested trades by randomizing their sequence 1,000 times to model potential worst-case drawdown streaks.",
    whyItMatters: "Even a 60% win-rate strategy will experience 8 to 10 consecutive losses at some point during a 500-trade sequence.",
    practicalAction: "Use Monte Carlo tools to calculate your strategy's 95% confidence maximum expected drawdown.",
    principle: "Sequence-Risk Modeling"
  },
  {
    title: "Defining Objective, Non-Discretionary Entry Rules",
    tip: "Write your entry rules with such crystal clarity that a computer programmer or a total stranger could execute them identically on your charts.",
    whyItMatters: "Vague, subjective rules ('enter when the market looks strong') cannot be objectively backtested or reliably repeated live.",
    practicalAction: "Express all entry criteria as binary TRUE/FALSE conditions.",
    principle: "Algorithmic Precision in Rules"
  },
  {
    title: "Time-of-Day Edge Validation",
    tip: "Backtest your setup across different hours of the day to identify whether the edge is time-dependent.",
    whyItMatters: "Most ICT and price action setups have strong edge during London and NY Killzones, but negative expectancy during the late Asian session.",
    practicalAction: "Filter your backtest database by entry hour to isolate your profitable operational window.",
    principle: "Temporal Edge Isolation"
  },
  {
    title: "Instrument-Specific Parameter Testing",
    tip: "Never assume that a setup that works brilliantly on EURUSD will work identically on Gold (XAUUSD) or Bitcoin without adjustment.",
    whyItMatters: "Different asset classes have unique liquidity pools, participant mixes, volatility dynamics, and market hours.",
    practicalAction: "Backtest every symbol independently with at least 50 historical setups before trading it live.",
    principle: "Asset Class Specificity"
  },
  {
    title: "Stress Testing Against Black Swan Events",
    tip: "Examine how your strategy model would have performed during historical black swan events (2020 COVID crash, 2015 SNB Swiss Franc unpeg).",
    whyItMatters: "Understanding your strategy's failure modes during extreme liquidity panics ensures you maintain adequate disaster stop protocols.",
    practicalAction: "Review your strategy rules against historical market dislocation days.",
    principle: "Extreme Event Robustness"
  },
  {
    title: "Walk-Forward Optimization Methodology",
    tip: "Optimize your model on Year 1, test on Year 2; then roll the window forward: optimize on Year 2, test on Year 3.",
    whyItMatters: "Walk-forward testing mimics real-world trading adaptation and verifies whether the strategy adapts to shifting market conditions.",
    practicalAction: "Implement rolling 12-month walk-forward testing for algorithmic or quantitative models.",
    principle: "Walk-Forward Continuity"
  },
  {
    title: "Testing Trade Hold Time vs Payoff",
    tip: "Analyze whether holding trades for 1 hour vs 4 hours vs 24 hours produces higher average R-multiples.",
    whyItMatters: "Many day-trading systems bleed edge by holding trades too long after the initial momentum expansion has concluded.",
    practicalAction: "Plot holding duration against realized R to find your strategy's optimal exit horizon.",
    principle: "Temporal Payoff Optimization"
  },
  {
    title: "Documenting Every Rule Invalidation Condition",
    tip: "Explicitly document the exact market conditions that mathematically invalidate your setup before you ever take a trade.",
    whyItMatters: "Ambiguous invalidation rules lead to moving stops and hoping for reversals during live execution.",
    practicalAction: "Define: 'If price closes with a body beyond Level X, the setup is 100% invalidated.'",
    principle: "Crystal Invalidation Criteria"
  },
  {
    title: "Avoiding the Look-Ahead Bias",
    tip: "Never calculate an indicator or signal using data points from candles that closed after the trade entry candle.",
    whyItMatters: "Look-ahead bias is an insidious coding error that creates artificial multi-million dollar backtest results that cannot exist in reality.",
    practicalAction: "Audit backtesting code to ensure all calculations rely strictly on completed, closed bar data.",
    principle: "Zero Look-Ahead Integrity"
  },
  {
    title: "The Power of Keeping a Backtesting Logbook",
    tip: "Save chart screenshots and data rows for every single backtested trade into a dedicated folder or digital workbook.",
    whyItMatters: "Building a library of 200+ backtested trades conditions your subconscious mind to recognize valid setups instantly in live markets.",
    practicalAction: "Maintain an organized backtesting folder organized by year, symbol, and setup type.",
    principle: "Subconscious Pattern Library"
  },
  {
    title: "Evaluating Profit Factor Benchmarks",
    tip: "Profit Factor = (Gross Profits / Gross Losses). A robust, tradeable strategy should have a Profit Factor between 1.5 and 2.5 in backtests.",
    whyItMatters: "A Profit Factor below 1.2 is too thin to survive real-world execution friction; a Profit Factor above 4.0 is usually over-fitted fiction.",
    practicalAction: "Verify your strategy's backtested Profit Factor sits comfortably in the realistic 1.6 to 2.4 zone.",
    principle: "Realistic Profit Factor"
  },
  {
    title: "Testing Fixed R:R Targets vs Trailing Stops",
    tip: "Run your backtest data through two parallel exit models: 1) Fixed 2.5:1 target, and 2) Trailing stop behind swing pivots.",
    whyItMatters: "Comparing exit models proves mathematically which approach yields higher expectancy for your specific setup archetype.",
    practicalAction: "Log both exit outcomes in your backtest spreadsheet to determine the superior exit mechanism.",
    principle: "Exit Model Comparison"
  },
  {
    title: "Understanding Degree of Freedom in Model Design",
    tip: "Keep the number of parameters in your strategy model as low as possible (high degrees of freedom).",
    whyItMatters: "Every additional parameter or filter you add reduces statistical degrees of freedom and increases risk of model breakdown.",
    practicalAction: "Eliminate any rule or indicator that does not improve expectancy by at least 15% in backtests.",
    principle: "Model Parsimony"
  },
  {
    title: "Validating Edge Across Multiple Timeframes",
    tip: "If a price action concept represents true market mechanics, it should function similarly on the 5-minute, 15-minute, 1-hour, and Daily charts.",
    whyItMatters: "A setup that only works on an obscure 7-minute chart is almost certainly a statistical anomaly rather than a real structural edge.",
    practicalAction: "Verify your core setup principles across multiple timeframe resolutions.",
    principle: "Fractal Robustness"
  },
  {
    title: "The Forward-Testing Paper Trading Bridge",
    tip: "After completing a historical backtest, execute the strategy on a live demo account for 30 to 60 days before risking real capital.",
    whyItMatters: "Demo forward-testing tests your emotional discipline, platform familiarity, and real-time execution capabilities.",
    practicalAction: "Mandate a 30-day clean forward-testing phase as a non-negotiable gateway before live deployment.",
    principle: "The Paper Trading Bridge"
  },
  {
    title: "Calculating Win Rate Under Adverse Market Conditions",
    tip: "Isolate the worst 3-month period in your backtest dataset and calculate your strategy's performance during that exact window.",
    whyItMatters: "Knowing your strategy's worst-case drawdown depth prepares you emotionally to survive identical periods in live trading.",
    practicalAction: "Calculate the 'Pain Index': maximum drawdown percentage multiplied by drawdown duration in days.",
    principle: "Adverse Condition Auditing"
  },
  {
    title: "The Danger of Survivorship Bias in Asset Selection",
    tip: "When backtesting stocks or crypto, do not test only the current top performers; include assets that crashed or were delisted during the test period.",
    whyItMatters: "Testing only surviving winners artificially inflates strategy performance by ignoring catastrophic asset blowouts.",
    practicalAction: "Use point-in-time constituent datasets for equities and crypto backtests.",
    principle: "Survivorship Neutrality"
  },
  {
    title: "Testing the Impact of Invalidation Speed",
    tip: "Analyze how quickly losing trades hit stop loss compared to how long winning trades take to reach target.",
    whyItMatters: "In healthy asymmetric strategies, losers should fail quickly, while winners should expand smoothly toward targets.",
    practicalAction: "Check that average loss duration is significantly shorter than average win duration.",
    principle: "Asymmetric Time Exposure"
  },
  {
    title: "Quantifying Setup Frequency and Opportunity Flow",
    tip: "Count how many valid setups your strategy generates per week on your preferred instruments.",
    whyItMatters: "If a strategy generates only 1 trade per month, you cannot achieve meaningful compounding; if it generates 20 trades a day, commission drag will kill it.",
    practicalAction: "Target strategies that produce 2 to 5 high-quality, high-conviction setups per week.",
    principle: "Opportunity Flow Calibration"
  },
  {
    title: "Validating Setup Independence",
    tip: "Check whether consecutive trades in your backtest occurred on the same instrument within minutes of each other.",
    whyItMatters: "Clustered trades are not independent statistical trials; they are a single market event broken into multiple pieces.",
    practicalAction: "Enforce a minimum time separation between backtested trade entries on the same symbol.",
    principle: "Statistical Sample Independence"
  },
  {
    title: "Analyzing Win-Loss Clustering Characteristics",
    tip: "Expect winning and losing trades to cluster together in streaks rather than alternating evenly in backtest sequences.",
    whyItMatters: "Traders who expect alternating win-loss sequences panic during a 6-loss streak and abandon their edge.",
    practicalAction: "Review historical streak clusters to normalize losing streaks in your psychological model.",
    principle: "Cluster Distribution Normalization"
  },
  {
    title: "Evaluating Breakeven Rule Impact on Expectancy",
    tip: "Compare backtest results with and without a 'move stop to breakeven at 2R' rule.",
    whyItMatters: "In many strategies, moving stops to breakeven prematurely reduces overall expectancy by turning potential 4R winners into 0R scratch trades.",
    practicalAction: "Ensure that moving to breakeven mathematically increases, rather than decreases, total strategy expectancy.",
    principle: "Breakeven Expectancy Audit"
  },
  {
    title: "The Power of Blind Testing Across Random Symbol Years",
    tip: "Pick an unnamed chart from a random year (e.g. EURUSD in 2018 or GBPJPY in 2014) and backtest 30 trades without knowing the symbol or date.",
    whyItMatters: "Blind testing proves whether your price action edge is truly universal and free from symbol familiarity bias.",
    practicalAction: "Conduct blind bar-replay tests regularly to sharpen pure structural intuition.",
    principle: "Blind Structural Validation"
  },
  {
    title: "Tracking Maximum Favorable Excursion in Backtests",
    tip: "Always log the maximum potential R achieved on every backtested trade before price reversed.",
    whyItMatters: "Reveals whether your target rules are leaving 80% of the meat on the table or setting unrealistic moonshot expectations.",
    practicalAction: "Align your target objectives with the 75th percentile of your backtested MFE distribution.",
    principle: "Empirical Target Calibration"
  },
  {
    title: "Testing Partial Take-Profit Mechanics",
    tip: "Test whether banking 50% at 2R and holding the rest outperforms a single all-or-nothing exit at 3R.",
    whyItMatters: "Partial scaling smooths the equity curve and reduces drawdown depth, even if it slightly lowers peak theoretical R.",
    practicalAction: "Choose the exit model that delivers the highest psychological comfort and equity smoothness.",
    principle: "Equity Smoothing Optimization"
  },
  {
    title: "Strategy Edge Decay Awareness",
    tip: "Monitor your backtested edge across multi-year eras (e.g. 2016-2018 vs 2019-2021 vs 2022-2024) to check for edge decay.",
    whyItMatters: "Algorithmic shifts and market structure changes can gradually erode simple retail edges over time.",
    practicalAction: "Verify that your strategy shows positive expectancy in the most recent 24-month period.",
    principle: "Edge Longevity Verification"
  },
  {
    title: "The Danger of Optimizing Stop Losses to the Exact Tick",
    tip: "Never set your backtested stop loss at 'exactly 12 pips' because it happened to optimize the highest return on that specific test run.",
    whyItMatters: "Exact tick optimization is pure curve fitting that will fail immediately in real live spread variations.",
    practicalAction: "Always base stop loss placement on structural market pivots, never on optimized tick constants.",
    principle: "Structural Stops Over Tick Optimization"
  },
  {
    title: "Backtesting Multi-Timeframe Confluence",
    tip: "Require higher timeframe trend agreement (4H/Daily) for every lower timeframe (15m/5m) setup in your backtest dataset.",
    whyItMatters: "Adding HTF directional alignment consistently increases win rates by 15-25% across all price action strategies.",
    practicalAction: "Record HTF trend status for every backtested trade and verify the statistical edge boost.",
    principle: "HTF Confluence Edge"
  },
  {
    title: "Calculating the Calmar Ratio",
    tip: "Calmar Ratio = (Annual Compound Return / Maximum Drawdown Percentage).",
    whyItMatters: "A strategy that makes 50% with a 50% drawdown is terrible; a strategy that makes 30% with a 6% drawdown has an elite Calmar Ratio of 5.0.",
    practicalAction: "Target strategies with a Calmar Ratio greater than 2.0 in your development pipeline.",
    principle: "Drawdown-Adjusted Compounding"
  },
  {
    title: "Testing the Impact of Friday Closes",
    tip: "Backtest closing all open positions at 4:00 PM EST Friday versus holding them through the weekend.",
    whyItMatters: "Historical data shows that weekend gap risk consistently penalizes traders who hold speculative intraday positions.",
    practicalAction: "Verify that Friday closing rules preserve capital and eliminate weekend gap slippage.",
    principle: "Weekend Risk Invalidation"
  },
  {
    title: "The Rule of Model Simplicity",
    tip: "If you cannot explain your strategy's core entry and exit logic to a 10-year-old child in two minutes, it is too complicated.",
    whyItMatters: "Complex models break easily under stress; simple, robust models endure across decades of market evolution.",
    practicalAction: "Strip your strategy down to its fundamental core: Context + Liquidity Sweep + Displacement + Entry + Target.",
    principle: "Radical Simplicity"
  },
  {
    title: "Backtesting With Realistic Capital Allocation",
    tip: "Model your backtest using a fixed 1% risk per trade on dynamically compounding equity rather than static dollar bets.",
    whyItMatters: "Compounding model testing demonstrates true geometric growth curves and reveals drawdown duration impact.",
    practicalAction: "Use dynamic equity compounding in your backtest analytics spreadsheets.",
    principle: "Geometric Growth Modeling"
  },
  {
    title: "Evaluating Trade Invalidation Discipline in Backtests",
    tip: "When backtesting, strictly record stops as hit the moment price touches the invalidation tick—never give the trade the benefit of the doubt.",
    whyItMatters: "Being generous with stops in backtesting produces wildly inflated results that crumble during live execution.",
    practicalAction: "Be ruthlessly pessimistic when recording fill prices and stop outs in backtesting.",
    principle: "Ruthless Backtesting Pessimism"
  },
  {
    title: "Testing Strategy Performance Under News Events",
    tip: "Cross-reference your historical trade entry times against an economic calendar database (Forex Factory / Bloomberg).",
    whyItMatters: "Identifies whether high-return trades were accidental windfalls from volatile CPI or NFP news releases.",
    practicalAction: "Separate news-coincident trades from pure technical price action deliveries in your test results.",
    principle: "News Event Isolation"
  },
  {
    title: "Validating Risk-Reward Distribution Skew",
    tip: "Plot a histogram of all trade outcomes (e.g. -1R, 0R, +1R, +2R, +3R, +5R): ensure positive skew toward large right-tail winners.",
    whyItMatters: "A strategy that relies on large negative left-tail losses (Martingale) is a ticking time bomb.",
    practicalAction: "Confirm that your strategy has capped negative losses at -1R and an extended positive right tail.",
    principle: "Positive Return Skewness"
  },
  {
    title: "The Backtesting-to-Live Ratio Benchmark",
    tip: "Expect your live trading results to achieve roughly 70% to 80% of your backtested performance due to psychological friction and human latency.",
    whyItMatters: "Discounting your expectations prevents disappointment and ensures your live risk parameters remain conservative.",
    practicalAction: "Apply a 20% discount factor to all backtested expectancy figures when forecasting future live returns.",
    principle: "Real-World Discount Factor"
  },
  {
    title: "Testing Trailing Stops with Buffer Increments",
    tip: "Test trailing stops using ATR multipliers (e.g. 1.5x ATR trailing) versus trailing behind swing structural pivots.",
    whyItMatters: "Structural swing trailing consistently outperforms indicator-based trailing in liquid FX and index markets.",
    practicalAction: "Implement structural trailing stops in your strategy models.",
    principle: "Structural Trailing Superiority"
  },
  {
    title: "The Power of Multi-Year Historical Archives",
    tip: "Keep a permanent archive of all backtest spreadsheets, charts, and metrics for every strategy you have ever developed.",
    whyItMatters: "Old ideas can be revisited and adapted as market regimes cycle over 5 to 10 year macroeconomic horizons.",
    practicalAction: "Back up your strategy research archive to secure cloud storage.",
    principle: "Institutional Research Archiving"
  },
  {
    title: "Testing the Value of Time-Based Stops",
    tip: "Test a rule that closes any trade that has failed to displace toward target after 2 hours or 10 candles.",
    whyItMatters: "Trades that linger in chop have a statistically declining probability of winning and tie up capital unnecessarily.",
    practicalAction: "Evaluate whether a time-based stop improves capital velocity and reduces loss frequency.",
    principle: "Time-Based Stop Utility"
  },
  {
    title: "Strategy Independence in Multi-Model Portfolios",
    tip: "If developing two strategies, ensure their correlation of daily returns is low or negative (e.g. Trend Continuation + Mean Reversion).",
    whyItMatters: "Combining uncorrelated strategies creates an ultra-smooth portfolio equity curve that dampens drawdowns.",
    practicalAction: "Calculate return correlation between your strategy models before running them concurrently.",
    principle: "Uncorrelated Strategy Blending"
  },
  {
    title: "The Value of Negative Backtest Results",
    tip: "A backtest that proves a strategy loses money is a massive success: it saved you thousands of dollars and weeks of live heartache.",
    whyItMatters: "Ruling out bad strategies quickly is just as important as discovering profitable ones in quantitative research.",
    practicalAction: "Celebrate discarded losing strategies as capital preserved through sound empirical science.",
    principle: "Elimination of Negative Expectancy"
  },
  {
    title: "Continuous Backtesting as Professional Training",
    tip: "Spend 2 to 3 hours every week backtesting past market data, even when your live trading is running smoothly.",
    whyItMatters: "Continuous backtesting keeps your visual recognition razor-sharp and strengthens your systemic conviction.",
    practicalAction: "Schedule a dedicated weekly 'Backtesting Lab' session on your calendar.",
    principle: "Perpetual Skill Sharpening"
  },
  {
    title: "Backtesting Builds Unshakeable Conviction",
    tip: "When you have personally documented 200 trades proving that your strategy yields positive expectancy across 3 years of market data, you will never fear a 5-trade drawdown again.",
    whyItMatters: "True trading confidence comes from empirical data and rigorous backtesting, not positive thinking or motivational quotes.",
    practicalAction: "Do the work. Backtest until you know your numbers inside and out.",
    principle: "Empirical Conviction Foundation"
  },
  {
    title: "The Golden Rule of Strategy Development",
    tip: "Never trade a strategy live that you have not personally backtested and forward-tested with your own hands.",
    whyItMatters: "Borrowing someone else's strategy without doing the testing means you will abandon it at the very first sign of drawdown.",
    practicalAction: "Own your edge through your own empirical validation.",
    principle: "Personal System Ownership"
  }
];
