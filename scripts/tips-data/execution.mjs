// scripts/tips-data/execution.mjs
export const executionTips = [
  {
    title: "The Pre-Flight Execution Checklist",
    tip: "Never enter a trade with a single impulse click. Run through a rigid 5-point checklist: 1) HTF Bias confirmed, 2) Key Level swept, 3) Invalidation level defined, 4) Position size calculated, 5) Minimum 2:1 R:R available.",
    whyItMatters: "Checklists prevent emotional errors and impulsive trades that bypass your operational strategy rules.",
    practicalAction: "Print or pin your execution checklist directly next to your trading monitor and tick every box before clicking entry.",
    principle: "Aviation Checklist Rigor"
  },
  {
    title: "Limit Orders vs Market Execution",
    tip: "Use limit orders resting at high-probability PD arrays rather than chasing moving price with market orders.",
    whyItMatters: "Market orders in fast markets suffer slippage, wide spread fills, and guarantee you enter at the worst possible price.",
    practicalAction: "Place limit orders at the opening tick or 50% consequent encroachment of your target Fair Value Gap.",
    principle: "Passive Liquidity Provision"
  },
  {
    title: "Spread Buffer Calibration on Stop Losses",
    tip: "Always add your broker's current spread plus a 1-pip buffer above your structural invalidation level on short positions.",
    whyItMatters: "On short trades, buy stops execute at the Ask price; if you place your stop right at the swing high, the Ask will trigger it even if Bid never touched the high.",
    practicalAction: "Measure the current spread on your terminal and add that distance to all short stop loss orders.",
    principle: "Ask-Spread Buffering"
  },
  {
    title: "Waiting for the Candle Close",
    tip: "Never execute an entry based on what an active, unclosed candle is currently doing. A candle that looks like a monster breakout can turn into a rejection wick with 5 seconds remaining.",
    whyItMatters: "Institutional algorithms frequently manipulate price inside the bar and only reveal their true intent at the close.",
    practicalAction: "Enable a candle countdown timer on your charting platform and wait for 00:00 before making an execution decision.",
    principle: "Closed-Bar Confirmation"
  },
  {
    title: "The Art of Scaling Out Partials",
    tip: "Bank 50% of your position at the first major liquidity draw (2R), move stop to breakeven, and let the remaining 50% run for high-timeframe targets.",
    whyItMatters: "Taking partials locks in guaranteed profit, completely eliminates the risk of turning a winning trade into a loss, and keeps you psychologically calm.",
    practicalAction: "Pre-set your first partial take-profit order at the time of entry.",
    principle: "Asymmetric Partial De-risking"
  },
  {
    title: "Handling Slippage During Volatile Openings",
    tip: "Expect 2 to 5 pips of negative slippage when entering via market orders during the first 5 minutes of the New York equity open (09:30 AM EST).",
    whyItMatters: "Ignoring slippage distorts your calculated risk-to-reward ratio and increases your realized dollar risk.",
    practicalAction: "Factor expected slippage into your position size calculation or wait for the initial opening flurry to settle.",
    principle: "Execution Friction Accounting"
  },
  {
    title: "Immediate Setup Invalidation Triggers",
    tip: "If price prints a clear market structure shift against your open trade before hitting your stop loss, exit manually immediately.",
    whyItMatters: "Waiting for the full stop loss to be hit when the technical setup has already clearly broken down wastes valuable capital.",
    practicalAction: "Execute an early manual exit when your technical premise is definitively invalidated on the execution timeframe.",
    principle: "Premise Breakdown Exit"
  },
  {
    title: "Managing the Runner Position",
    tip: "Once your initial target is banked and your stop is at breakeven, leave your runner alone. Do not micro-manage it on 1-minute charts.",
    whyItMatters: "Micro-managing runners leads to premature exits right before massive high-timeframe trend runs.",
    practicalAction: "Manage the runner exclusively from the 1-hour or 4-hour chart, trailing only behind major swing pivots.",
    principle: "Macro Runner Autonomy"
  },
  {
    title: "Execution Latency and VPS Optimization",
    tip: "If you trade fast intraday futures or high-frequency news setups, run your platform on a Virtual Private Server (VPS) located close to your broker's matching engine.",
    whyItMatters: "Reducing latency from 120ms to 2ms eliminates slippage on limit order fills and fast execution triggers.",
    practicalAction: "Ping your broker's server and investigate low-latency VPS hosting if trading rapid scalping strategies.",
    principle: "Infrastructure Edge"
  },
  {
    title: "Avoiding the Market Order Panic Reflex",
    tip: "Never double-click the buy/sell button in panic when price is rocketing away from you.",
    whyItMatters: "Panic market buying into vertical candles is the primary mechanism by which retail liquidity gets trapped at the exact high of the day.",
    practicalAction: "If you miss your planned limit fill, cancel the order and wait for the next setup. Never chase.",
    principle: "Zero-Chase Policy"
  },
  {
    title: "Predefining Take-Profit Orders",
    tip: "Always enter the market with both your Stop Loss and Take Profit orders already attached to your initial ticket.",
    whyItMatters: "Entering 'naked' without pre-set orders leaves you vulnerable to sudden disconnects, platform freezes, and emotional hesitation.",
    practicalAction: "Use bracket / OCO (One-Cancels-the-Other) orders on every single execution.",
    principle: "Bracket Order Discipline"
  },
  {
    title: "Handling Partial Fills on Limit Orders",
    tip: "When only half of your limit order gets filled before price takes off to target, do not chase the rest with a market order.",
    whyItMatters: "Chasing the remaining size with a market order gives you a blended entry price with poor risk-reward.",
    practicalAction: "Accept the partial position as a bonus, cancel the remaining unfilled limit order, and manage the filled portion normally.",
    principle: "Partial Fill Grace"
  },
  {
    title: "Scaling Into Winning Positions (Pyramiding)",
    tip: "Only add size to an open position if it is currently in profit, your initial risk has been moved to breakeven, and a new structural confirmation forms.",
    whyItMatters: "Pyramiding allows you to achieve massive 5R to 10R gains while keeping total risk on the trade at zero.",
    practicalAction: "Add a secondary half-position on the first confirmed pullback after a Break of Structure, locking the original position's stop above breakeven.",
    principle: "Disciplined Pyramiding"
  },
  {
    title: "The Danger of One-Click Trading Without Confirmation",
    tip: "Disable instant one-click trading on your primary charts if you have a habit of accidental clicks or impulsive trigger fingers.",
    whyItMatters: "A 1-second confirmation modal creates a cognitive speedbump that halts impulsive, unplanned trades.",
    practicalAction: "Keep a 2-step order confirmation dialog active to ensure deliberate, conscious clicking.",
    principle: "Execution Speedbump Protocol"
  },
  {
    title: "Trading the Retest vs Trading the Breakout",
    tip: "Executing on the retest of a broken level consistently yields higher risk-to-reward and lower drawdown than executing on the initial breakout tick.",
    whyItMatters: "Breakout entries require wide stops below the entire pattern, whereas retest entries allow tight stops right behind the new structural pivot.",
    practicalAction: "Let breakout traders take the initial risk; wait for the pullback to test the level before firing.",
    principle: "Retest Over Breakout"
  },
  {
    title: "Managing Execution During Broker Maintenance Windows",
    tip: "Be aware of your broker's scheduled daily and weekend server maintenance times when orders cannot be placed or modified.",
    whyItMatters: "Being trapped in an open position during a 30-minute server reboot leaves you blind to market developments.",
    practicalAction: "Avoid initiating new trades within 45 minutes of scheduled server maintenance windows.",
    principle: "Maintenance Schedule Awareness"
  },
  {
    title: "Exiting Before Saturated Target Pools",
    tip: "Place your take-profit limit order 2 to 3 pips BEFORE the obvious liquidity high, not directly on it or above it.",
    whyItMatters: "Front-running the pool ensures your limit order is fully filled in the order queue before price reverses.",
    practicalAction: "Set TP at 1.0998 rather than 1.1000 to guarantee early fill before queue saturation.",
    principle: "Queue Front-Running"
  },
  {
    title: "Order Flow Depth of Market (DOM) Awareness",
    tip: "If trading futures, glance at the DOM to verify there is genuine resting liquidity at your proposed limit entry price.",
    whyItMatters: "Placing orders in thin books leads to erratic fills and severe slippage.",
    practicalAction: "Verify liquidity thickness around key PD arrays before placing large lot sizes.",
    principle: "Book Liquidity Verification"
  },
  {
    title: "The Invalidation of Limit Orders After Extended Time",
    tip: "If your limit order has been sitting unfilled for more than two hours and market structure has drastically changed, cancel it immediately.",
    whyItMatters: "Stale limit orders left forgotten on the order book can get triggered when market context is completely hostile to the original thesis.",
    practicalAction: "Audit all open pending orders at the end of every active session and cancel stale tickets.",
    principle: "Stale Order Pruning"
  },
  {
    title: "Executing Multiple Contracts on Tiered Targets",
    tip: "Split your trade into multiple tickets (e.g. 3 contracts): Contract 1 exits at 2R, Contract 2 exits at 3.5R, and Contract 3 runs for high-timeframe liquidity.",
    whyItMatters: "Tiered execution automates your profit extraction and eliminates all manual exit emotional stress.",
    practicalAction: "Use multi-target order templates in your trading terminal.",
    principle: "Modular Target Architecture"
  },
  {
    title: "Avoiding Market Execution During Low-Volume Squeeze",
    tip: "Never click market buy or sell when the spread is flashing wider than normal.",
    whyItMatters: "You are paying an unnecessary instantaneous penalty to the market maker before the trade even begins.",
    practicalAction: "Wait for the spread indicator to show normal baseline levels before submitting orders.",
    principle: "Spread Cost Consciousness"
  },
  {
    title: "The Discipline of the Clean Cancel",
    tip: "Canceling a pending limit order that didn't fill because price took off to target without you is a mark of professional maturity.",
    whyItMatters: "Immature traders get angry and chase the move with a market order; professionals calmly cancel and await the next setup.",
    practicalAction: "When price reaches your target without tagging your entry limit, immediately delete the pending limit order.",
    principle: "Graceful Order Cancellation"
  },
  {
    title: "Execution Under High Volatility Conditions",
    tip: "During extreme news volatility, use limit orders with positive slippage settings or step away entirely.",
    whyItMatters: "Market orders during CPI or NFP can slip by 20 to 50 pips, turning a planned $100 risk into an accidental $500 loss.",
    practicalAction: "Refrain from market orders when volatility exceeds 3x normal Average True Range.",
    principle: "High-Volatility Protection"
  },
  {
    title: "Setting Hard Price Alerts to Prevent Screen Fatigue",
    tip: "Configure audio and mobile price alerts at your critical points of interest instead of sitting at your desk staring at motionless charts.",
    whyItMatters: "Staring at screens creates subconscious pressure to click out of boredom.",
    practicalAction: "Set alerts 5 pips before your key level and walk away until your alert chimes.",
    principle: "Alert-Driven Workflow"
  },
  {
    title: "The Clean Click Ritual",
    tip: "Before clicking the execute button, take one deep breath, confirm the lot size matches your risk calculator, and click with calm intention.",
    whyItMatters: "This 3-second ritual prevents typos, incorrect lot sizes (e.g. typing 10.0 instead of 1.0), and impulsive trades.",
    practicalAction: "Make the deep breath and lot verification a mandatory physical prerequisite before every click.",
    principle: "The Conscious Click"
  },
  {
    title: "Execution Discipline on Prop Firm Rules",
    tip: "Program your trading platform to enforce your prop firm's maximum daily loss rule mechanically if possible.",
    whyItMatters: "Relying on emotional discipline during intense trading sessions is risky; automated software locks provide absolute protection.",
    practicalAction: "Use broker or platform-level account equity locks to hard-stop your trading at your daily loss threshold.",
    principle: "Automated Rule Enforcement"
  },
  {
    title: "Executing Clean Counter-Trend Retracements",
    tip: "Counter-trend trades require twice the confirmation and half the position size of trend-continuation setups.",
    whyItMatters: "Counter-trend setups have a lower statistical win rate and are prone to sudden trend resumptions.",
    practicalAction: "Halve your standard risk when trading against the dominant higher-timeframe order flow.",
    principle: "Counter-Trend Risk Discount"
  },
  {
    title: "The Trap of Moving Take-Profit Orders Farther Away",
    tip: "Never move your take-profit target farther away in the middle of a trade out of sudden greed.",
    whyItMatters: "Price frequently hits your original objective, turns around, and takes out your stop loss before reaching your greedy new target.",
    practicalAction: "Respect the target you mathematically calculated during your calm pre-market analysis.",
    principle: "Objective Target Fidelity"
  },
  {
    title: "Handling Accidental Order Submissions",
    tip: "If you accidentally enter a trade due to a misclick or wrong lot size, close the entire position immediately at market without debate.",
    whyItMatters: "Hoping that an accidental trade will turn into a winner is pure gambling and reinforces sloppy operational habits.",
    practicalAction: "Close accidental entries instantly, accept whatever minor spread cost occurred, and reset.",
    principle: "Instant Error Correction"
  },
  {
    title: "The Importance of Two-Way Order Confirmation",
    tip: "Always double-check that your Stop Loss is placed on the correct side of price (below entry for longs, above entry for shorts).",
    whyItMatters: "Flipping stop coordinates can cause an immediate instant market fill at the worst possible price.",
    practicalAction: "Visually verify the red stop line on your chart canvas before looking away from the terminal.",
    principle: "Visual Order Verification"
  },
  {
    title: "Trailing Stops Using Structural Lows/Highs",
    tip: "Move your trailing stop loss only after a new swing low (for longs) has formed and price has broken above the prior swing high.",
    whyItMatters: "This guarantees that your stop is always protected by a validated structural barrier.",
    practicalAction: "Follow the step-ladder of market structure to advance your trailing stop.",
    principle: "Step-Ladder Trailing"
  },
  {
    title: "Execution Window Discipline",
    tip: "Restrict all trade executions strictly to your designated session killzone (e.g. 08:30 - 11:00 AM EST).",
    whyItMatters: "Taking trades outside of high-volume killzones exposes you to low liquidity, choppy algorithms, and random noise.",
    practicalAction: "Lock your order routing functionality outside of your approved trading windows.",
    principle: "Temporal Execution Boundaries"
  },
  {
    title: "Executing on Synthetic Assets and Indices",
    tip: "Understand point values and tick sizes: a 10-point stop on the Nasdaq (NQ) is vastly different in cash risk from a 10-point stop on the S&P 500 (ES).",
    whyItMatters: "Failing to calculate instrument-specific point multipliers results in unintended catastrophic dollar losses.",
    practicalAction: "Use AlphaPips Quick Risk Calculator to verify contract multiplier values for every symbol you trade.",
    principle: "Tick Value Calibration"
  },
  {
    title: "Avoiding Simultaneous Execution Across Inverse Pairs",
    tip: "Never short EURUSD while simultaneously buying USDCHF unless you specifically intend to trade spread convergence.",
    whyItMatters: "These pairs are nearly 95% inversely correlated; trading both is simply doubling your US Dollar exposure.",
    practicalAction: "Choose the single cleanest technical setup and execute only that one.",
    principle: "Inverse Pair De-duplication"
  },
  {
    title: "Execution Post-Mortem Routine",
    tip: "After every trade is closed, compare your actual execution fill prices against your planned strategy prices.",
    whyItMatters: "Tracking execution drag reveals whether poor timing or broker slippage is eroding your edge.",
    practicalAction: "Log your planned entry vs actual entry price in your trade journal to measure execution quality.",
    principle: "Execution Drag Measurement"
  },
  {
    title: "The Breakeven Defense Trigger",
    tip: "Once price reaches 2R in profit, move your stop to entry price + 1 pip. Your financial risk on the trade is now zero.",
    whyItMatters: "This permanently protects your capital and transitions your psychological state into total relaxation.",
    practicalAction: "Automate or execute the breakeven move as soon as your 2R milestone is printed.",
    principle: "Zero-Risk Conversion"
  },
  {
    title: "Managing Execution During Flash Events",
    tip: "If a geopolitical headline causes a sudden vertical candle spike while you are in a trade, do not panic.",
    whyItMatters: "Panicking and market-closing during the peak of a spike often sells the exact bottom or buys the top.",
    practicalAction: "Allow your pre-set server stop loss or take profit to handle the execution calmly.",
    principle: "Flash Event Composure"
  },
  {
    title: "The Clean Breakeven Exit Mindset",
    tip: "Exiting a trade at breakeven after hours of holding is not a failure; it is a masterclass in capital defense.",
    whyItMatters: "Protecting your money so you can fight another day is the ultimate objective of professional execution.",
    practicalAction: "Celebrate breakeven exits as successful defensive maneuvers.",
    principle: "Defense as Victory"
  },
  {
    title: "Trading the News Reaction, Not the News Release",
    tip: "Let the initial 15-minute news release spike clear out resting liquidity. Only execute on the subsequent technical market structure shift.",
    whyItMatters: "Trading during the release is gambling; trading the aftermath is technical price action execution.",
    practicalAction: "Hands off the mouse until 15 minutes after the economic news announcement.",
    principle: "Post-News Technical Execution"
  },
  {
    title: "The Power of the One-Trade Day",
    tip: "A single, beautifully executed A+ setup per day is all that is required to achieve elite multi-year compounding.",
    whyItMatters: "Taking 5 trades a day increases cognitive fatigue, error rate, and commission drag.",
    practicalAction: "Target one textbook trade per day and close your charts once it concludes.",
    principle: "Single-Bullet Mastery"
  },
  {
    title: "Executing With Size: Splitting Large Block Orders",
    tip: "If executing large position sizes (e.g. 50+ lots), split your orders into smaller tranches to avoid moving the thin order book.",
    whyItMatters: "Large single market orders eat through multiple depth levels, causing severe average price deterioration.",
    practicalAction: "Use iceberg orders or tranche your entries across 2-3 limit levels within the Fair Value Gap.",
    principle: "Tranche Execution"
  },
  {
    title: "Validating Market Liquidity Before Entry",
    tip: "Avoid executing trades on bank holidays (e.g. US Memorial Day, UK Bank Holiday) when primary financial centers are closed.",
    whyItMatters: "Low liquidity leads to unpredictable slippage and wide spreads.",
    practicalAction: "Check the international bank holiday calendar before opening trading sessions.",
    principle: "Liquidity Calendar Audit"
  },
  {
    title: "The Final Execution Review",
    tip: "Score your execution from 1 to 10 on pure technical adherence regardless of whether the trade won or lost.",
    whyItMatters: "Reinforcing flawless execution habits is the only sustainable driver of long-term profitability.",
    practicalAction: "Record your execution score in your AlphaPips trade journal for every closed position.",
    principle: "Execution Habit Reinforcement"
  },
  {
    title: "Executing on Gold (XAUUSD) Volatility",
    tip: "Gold moves fast: always use limit orders and wider stops than Forex pairs to accommodate for typical intraday swings.",
    whyItMatters: "Using tight 10-pip Forex stops on Gold guarantees you will be stopped out by standard intraday spread noise.",
    practicalAction: "Calibrate stop distances to Gold's current 15-minute Average True Range.",
    principle: "Commodity Volatility Sizing"
  },
  {
    title: "The Non-Negotiable Invalidation Rule",
    tip: "If price touches your pre-determined stop loss level, take the loss instantly without debate, hesitation, or regret.",
    whyItMatters: "Hesitating on stop loss execution is the direct cause of catastrophic blowout losses.",
    practicalAction: "Let your automated stop execute without manual intervention.",
    principle: "Absolute Invalidation Respect"
  },
  {
    title: "Executing Clean Trend Flips",
    tip: "When transitioning from long to short, close the long position completely and wait for a fresh confirmation before entering short.",
    whyItMatters: "Flipping positions instantly via 'Stop & Reverse' buttons often leads to getting whipsawed in the transition chop.",
    practicalAction: "Separate closing old positions from opening new ones with a mandatory 5-minute pause.",
    principle: "De-coupled Trend Reversals"
  },
  {
    title: "Executing Limit Orders at the Open of FVGs",
    tip: "If you fear missing a rapid move, place your limit order at the near boundary of the Fair Value Gap rather than the 50% midpoint.",
    whyItMatters: "In ultra-aggressive institutional trends, price often only touches the boundary of the gap before exploding.",
    practicalAction: "Enter at the boundary with a slightly wider stop to ensure fill in high-momentum markets.",
    principle: "Near-Boundary Fill Security"
  },
  {
    title: "Managing Order Expiry Protocols",
    tip: "Set all pending limit orders with a 'Good 'Til Cancelled' (GTC) or 'Good 'Til End of Session' (GTD) expiration.",
    whyItMatters: "Forgetting open pending orders that trigger days later while you are asleep can cause catastrophic unexpected losses.",
    practicalAction: "Configure auto-expiry on all pending limit tickets to match your session end time.",
    principle: "Automated Order Expiration"
  },
  {
    title: "Executing with Total Emotional Equanimity",
    tip: "When you press the button, your emotional state should be identical to buying a gallon of milk at the grocery store.",
    whyItMatters: "High emotional arousal at execution indicates fear, greed, or over-leverage.",
    practicalAction: "If your heart rate is elevated, step back from the mouse and take 3 deep breaths before executing.",
    principle: "Emotional Neutrality"
  },
  {
    title: "Execution Discipline is Your True Edge",
    tip: "Two traders can trade the exact same strategy; the one with elite execution discipline will compound fortunes while the undisciplined one will blow up.",
    whyItMatters: "The edge is not in the chart lines; the edge is in your flawless human execution of those lines under pressure.",
    practicalAction: "Treat every trade execution as an artistic performance of pure discipline.",
    principle: "Execution as Ultimate Edge"
  },
  {
    title: "The Post-Trade Cooldown Requirement",
    tip: "Mandate a 10-minute cooldown period between closing one trade and opening another.",
    whyItMatters: "A mandatory pause prevents adrenaline-fueled impulse entries immediately after an adrenaline rush.",
    practicalAction: "Set a 10-minute timer using the AlphaPips Focus Timer before looking for any new setups.",
    principle: "Mandatory Cooldown Interval"
  },
  {
    title: "Executing the Plan, Not the Emotion",
    tip: "Trade your pre-market plan. If a setup did not exist in your pre-market analysis, you have no business executing it live.",
    whyItMatters: "Unplanned intraday setups are almost always emotional impulses disguised as opportunities.",
    practicalAction: "Only execute setups that were identified and vetted during your pre-market preparation.",
    principle: "Strict Plan Execution"
  }
];
