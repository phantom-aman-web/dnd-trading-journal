// scripts/tips-data/market-structure.mjs
export const marketStructureTips = [
  {
    title: "Fractal Nature of Price Structure",
    tip: "Market structure is strictly fractal: a 1-minute trend is simply a single pullback leg inside a 15-minute swing, which is a single candle inside a 4-hour trend.",
    whyItMatters: "Trading a 1-minute breakout directly into a 4-hour resistance zone is one of the most common causes of retail stop-outs.",
    practicalAction: "Always align your lower-timeframe execution with the directional bias of the higher-timeframe structure.",
    principle: "Multi-Timeframe Fractality"
  },
  {
    title: "Strong vs Weak Highs and Lows",
    tip: "A strong (protected) swing low is one that successfully created a higher high. A weak (target) swing low failed to break the prior high.",
    whyItMatters: "Weak highs and lows are fragile and targeted by institutional order flow for liquidity sweeps.",
    practicalAction: "Never place your stop loss behind a weak swing point; place stops behind protected swings that caused displacement.",
    principle: "Protected vs Target Extremes"
  },
  {
    title: "Wick Closes vs Body Closes for BOS",
    tip: "A wick piercing an old high is an exploratory probe that sweeps resting liquidity. A full candle body close above that high confirms true structural expansion.",
    whyItMatters: "Mistaking a wick liquidity grab for a genuine Break of Structure (BOS) causes traders to buy the exact top of an institutional trap.",
    practicalAction: "Wait for the current candle to close before declaring that a Break of Structure has occurred.",
    principle: "Candle Body Confirmation"
  },
  {
    title: "Change of Character (CHoCH) Dynamics",
    tip: "A Change of Character is the earliest signal that the prevailing trend is losing momentum, marked by the violation of the most recent minor swing low in an uptrend.",
    whyItMatters: "CHoCH alerts you to stop looking for trend continuation and prepare for either a deep retracement or complete reversal.",
    practicalAction: "When CHoCH prints, avoid taking new trend continuation entries until high-timeframe confirmation confirms resumption.",
    principle: "Early Trend Deceleration"
  },
  {
    title: "Swing High and Low Definition (3-Bar Fractal)",
    tip: "A valid swing high requires at least one candle with a lower high immediately to its left and at least one candle with a lower high immediately to its right.",
    whyItMatters: "Having an objective, non-discretionary rule for identifying swing points prevents subjective, emotional charting.",
    practicalAction: "Program or train your eyes to require the 3-bar or 5-bar fractal pattern before drawing structural lines.",
    principle: "Objective Swing Identification"
  },
  {
    title: "Consolidation Precedes True Expansion",
    tip: "Markets alternate between contraction (range-bound consolidation) and expansion (trending displacement).",
    whyItMatters: "The longer the consolidation phase, the more violent and directional the subsequent expansion will be when liquidity is released.",
    practicalAction: "Do not force trades in the dead middle of a consolidation box; wait for the breakout and first pullback.",
    principle: "Volatility Compression & Release"
  },
  {
    title: "Clean vs Dirty Highs and Lows",
    tip: "Clean highs are smooth, equal, or rounded peaks that look visually obvious. Dirty highs are jagged, overlapping, and filled with deep wicks.",
    whyItMatters: "Clean highs attract massive retail stops and are prioritized by algorithms for liquidity sweeps.",
    practicalAction: "Look for clean, smooth highs as primary magnet targets for your long positions.",
    principle: "Visual Liquidity Magnetism"
  },
  {
    title: "Inducement vs Genuine Breakout",
    tip: "An inducement break is a minor structural push that tempts breakout traders into the market right before a deeper counter-trend pullback.",
    whyItMatters: "Buying the first minor breakout often results in getting stopped out during the true deep retracement to discount.",
    practicalAction: "Allow the initial breakout to pull back into equilibrium or discount before taking your entry.",
    principle: "Patience Through Inducement"
  },
  {
    title: "Deep Retracements vs Shallow Momentum Flags",
    tip: "Shallow retracements (less than 38.2%) signal overwhelming institutional momentum; deep retracements (62%-79%) indicate healthy two-way rebalancing.",
    whyItMatters: "Trying to wait for a 79% deep retracement in a runaway momentum trend will cause you to miss the entire move.",
    practicalAction: "Classify the market condition as either 'Runaway Momentum' or 'Auction Rebalancing' before deciding on entry criteria.",
    principle: "Market Condition Classification"
  },
  {
    title: "The Anatomy of Failed Breakouts",
    tip: "When price breaks an established range high with large volume, but immediately prints an opposite engulfing bar back into the range, a false breakout has occurred.",
    whyItMatters: "False breakouts trap late breakout buyers and provide the highest-probability counter-trend setups in technical analysis.",
    practicalAction: "Enter short on the candle close back inside the range, targeting the opposite range low.",
    principle: "Range Boundary Trapping"
  },
  {
    title: "Trend Invalidation vs Normal Retracement",
    tip: "An uptrend is officially invalidated only when the structural low that created the most recent higher high is breached with displacement.",
    whyItMatters: "Traders often panic during deep pullbacks and think the trend is over when price is simply retesting a discount array.",
    practicalAction: "Mark the true invalidation low with a clear horizontal alert line and stay calm during pullbacks above it.",
    principle: "Structural Boundary Respect"
  },
  {
    title: "Candle Wick Rejection Significance",
    tip: "A long upper wick indicates that buyers attempted to push price higher but were met with overwhelming institutional selling, rejecting that price level.",
    whyItMatters: "Wicks show where the market refused to accept trading volume, signaling a lack of institutional interest at that level.",
    practicalAction: "Do not buy into the face of multiple long upper rejection wicks on higher timeframes.",
    principle: "Price Rejection Signatures"
  },
  {
    title: "The Power of Higher Timeframe Closes",
    tip: "A 4-Hour candle close carries vastly more structural weight than twenty-four 10-minute candle closes combined.",
    whyItMatters: "Algorithms and institutional funds make macro allocation decisions based on 4-Hour, Daily, and Weekly candle closes.",
    practicalAction: "Never let lower-timeframe noise contradict a clear Daily or 4-Hour candle close direction.",
    principle: "Timeframe Weighting"
  },
  {
    title: "Market Compression Patterns",
    tip: "Price compression occurs when higher lows and lower highs form with diminishing volume and tighter candle spreads.",
    whyItMatters: "Compression indicates liquidity is drying up on both sides, setting the stage for an explosive directional repricing.",
    practicalAction: "Prepare for a high-volatility breakout; mark the outer boundaries of the compression zone.",
    principle: "Compression Explosiveness"
  },
  {
    title: "Pin Bar and Hammer Context Matters",
    tip: "A hammer or pin bar candle in the middle of nowhere has zero predictive edge. A hammer rejecting a key discount FVG or old swing low is an A+ confirmation.",
    whyItMatters: "Single candle patterns are completely meaningless without structural location and institutional context.",
    practicalAction: "Only trade candlestick patterns when they occur directly at high-timeframe points of interest.",
    principle: "Contextual Candlestick Analysis"
  },
  {
    title: "Engulfing Bar Confirmation Mechanics",
    tip: "A valid bullish engulfing candle must have its entire real body completely encompass the real body and wicks of the preceding bearish candle.",
    whyItMatters: "Complete engulfment proves that buyers have completely overwhelmed the sellers from the prior period.",
    practicalAction: "Enter on the close of the engulfing candle or on a 50% retracement of its range.",
    principle: "Total Buyer Overwhelm"
  },
  {
    title: "Volume Footprint and Spread Correlation",
    tip: "A wide-range candle on low volume is an artificial push; a wide-range candle accompanied by massive institutional volume confirms real commitment.",
    whyItMatters: "Volume provides the fuel and legitimacy for genuine structural breakouts.",
    practicalAction: "Check volume spikes at key breakout levels to confirm institutional sponsorship.",
    principle: "Volume-Price Synergy"
  },
  {
    title: "Inside Bar Breakout Protocol",
    tip: "An Inside Bar forms when a candle's entire high-low range is contained within the high-low range of the mother candle.",
    whyItMatters: "It reflects temporary pause and equilibrium before the next momentum continuation leg.",
    practicalAction: "Place entry orders just beyond the mother bar's high/low in the direction of the dominant trend.",
    principle: "Mother-Bar Expansion"
  },
  {
    title: "Exhaustion Candlestick Signatures",
    tip: "A trend exhaustion signature appears as an abnormally huge, climactic candle after a prolonged trend, accompanied by extreme volume and immediate reversal.",
    whyItMatters: "This is a classic 'blow-off top' or selling climax where retail buyers rush in at the exact moment institutions dump their inventory.",
    practicalAction: "Tighten trailing stops or take full profits when a climactic expansion candle prints after a mature trend.",
    principle: "Climactic Blow-Off Recognition"
  },
  {
    title: "The Dealing Range Box Technique",
    tip: "Draw a box encompassing the entire recent impulsive swing: subdivide it into 4 equal quartiles (0-25% Extreme Discount, 25-50% Discount, 50-75% Premium, 75-100% Extreme Premium).",
    whyItMatters: "Buying in the 0-25% Extreme Discount quartile provides the highest mathematical payoff ratio in all of market structure analysis.",
    practicalAction: "Filter your trade entries to only execute in the outer quartiles (0-25% for longs, 75-100% for shorts).",
    principle: "Quartile Sizing and Entry"
  },
  {
    title: "Three-Drive Pattern Recognition",
    tip: "A Three-Drive pattern consists of three consecutive, symmetrical pushes into a major support or resistance level, with each push exhausting momentum.",
    whyItMatters: "The third drive frequently marks the final trap before an aggressive multi-timeframe structural reversal.",
    practicalAction: "Look for divergence on the third push and prepare to trade the reversal upon a structural shift.",
    principle: "Harmonic Push Exhaustion"
  },
  {
    title: "Support and Resistance Flip Levels",
    tip: "When a major structural resistance ceiling is cleanly broken with displacement, it flips to become a structural support floor.",
    whyItMatters: "Institutions that sold at the ceiling will use the retest to buy back short positions at breakeven.",
    practicalAction: "Wait for the retest of the broken ceiling to confirm it holds as support before entering long.",
    principle: "Polarity Flip Dynamics"
  },
  {
    title: "Price Action Inefficiency Resolution",
    tip: "Price tends to retrace to where the fastest moves originated to establish two-way liquidity and balance the order book.",
    whyItMatters: "Explosive moves leave thin order books behind, creating a vacuum that draws price back like a rubber band.",
    practicalAction: "Map out the origin of explosive moves as primary targets for deep retracement plays.",
    principle: "Liquidity Vacuum Resolution"
  },
  {
    title: "Trendline Liquidity Engineering",
    tip: "Retail traders draw diagonal trendlines and place stop losses right below the third or fourth touch of that diagonal line.",
    whyItMatters: "Diagonal trendlines are engineered liquidity lines. Smart money loves to slice straight through diagonal lines to hunt resting stops.",
    practicalAction: "Never rely purely on diagonal trendlines for stop placement; always use horizontal structural pivots.",
    principle: "Diagonal Liquidity Traps"
  },
  {
    title: "Ascending and Descending Wedges",
    tip: "An ascending wedge within an uptrend indicates diminishing buyer momentum as higher highs become increasingly shallow.",
    whyItMatters: "Wedges represent market exhaustion and high probability of a sharp breakdown.",
    practicalAction: "Wait for price to break the lower boundary of the wedge with displacement before initiating short positions.",
    principle: "Wedge Exhaustion Dynamics"
  },
  {
    title: "The First Pullback After Trend Reversal",
    tip: "The very first pullback following a major higher-timeframe trend reversal offers the highest risk-to-reward ratio of the entire new trend cycle.",
    whyItMatters: "Most traders are still in denial about the reversal, allowing early entrants to capture massive R-multiples.",
    practicalAction: "Execute decisively on the first valid FVG or Order Block retest after a confirmed structural reversal.",
    principle: "First Pullback Primacy"
  },
  {
    title: "Double Bottom vs Liquidity Raid",
    tip: "A genuine double bottom requires equal lows with a strong subsequent rally. If price pauses and chops right on top of the second low, it is about to get raided.",
    whyItMatters: "Chopping on top of support indicates buyers lack the strength to displace price away from danger.",
    practicalAction: "Anticipate a sweep of the lows rather than a bounce when price hugs support sluggishly.",
    principle: "Lingering At Support Warning"
  },
  {
    title: "The Role of Round Psychological Numbers",
    tip: "Major institutional orders cluster around round numbers (e.g. 1.1000 on EURUSD, 2000 on Gold, 100,000 on Bitcoin).",
    whyItMatters: "Option barriers, bank hedging algorithms, and retail stop orders accumulate heavily at big round figures.",
    practicalAction: "Plot major institutional round numbers on your charts to anticipate explosive volatility reactions.",
    principle: "Round Figure Clustering"
  },
  {
    title: "Multi-Bar Structural Consolidation",
    tip: "When five or more consecutive candles overlap within the high-low range of a single anchor candle, market structure is in complete equilibrium.",
    whyItMatters: "Trying to day-trade inside tight consolidation leads to frequent whipsaws and spread loss.",
    practicalAction: "Step away and wait for a clear expansion candle to break out of the consolidation range.",
    principle: "Equilibrium Inaction"
  },
  {
    title: "Dynamic vs Static Support and Resistance",
    tip: "Static horizontal structural levels (prior swing highs/lows) are vastly more reliable than dynamic indicators like Moving Averages.",
    whyItMatters: "Moving averages lag price action and change value every time a new candle forms, whereas structural pivots remain fixed in history.",
    practicalAction: "Prioritize horizontal market structure over moving average lines in your core decision making.",
    principle: "Static Structural Reliability"
  },
  {
    title: "The Reversal Bar at Liquidity Extreme",
    tip: "When a candle sweeps an old high with a sharp wick and immediately closes in the lower 20% of its range, a powerful reversal bar has formed.",
    whyItMatters: "This confirms that all aggressive buy orders were absorbed and sellers are in total control.",
    practicalAction: "Enter short on the next candle with a stop loss resting above the wick extreme.",
    principle: "Extreme Absorption Signature"
  },
  {
    title: "Price Magnetism of Unvisited Highs",
    tip: "Clean highs that have stood untouched for weeks or months act as gravitational magnets for institutional algorithmic pricing.",
    whyItMatters: "These levels harbor immense pools of liquidity that large funds need to exit multi-million dollar positions.",
    practicalAction: "Use historical unvisited highs as macro target objectives for long swing trades.",
    principle: "Historical Magnetism"
  },
  {
    title: "Momentum Divergence Across Structural Swings",
    tip: "When price makes a higher high, but momentum indicators or candle body sizes show significant shrinkage, a momentum divergence exists.",
    whyItMatters: "Divergence signals that fewer market participants are willing to commit capital at higher prices, preconditioning a reversal.",
    practicalAction: "Tighten stop losses on long positions and look for lower timeframe market structure shifts.",
    principle: "Momentum Attenuation"
  },
  {
    title: "The Trapped Trader Phenomenon",
    tip: "When a breakout from a tight range fails immediately, the breakout traders are trapped offside with their stops clustered right outside the range.",
    whyItMatters: "Their forced liquidations accelerate the reversal in the opposite direction.",
    practicalAction: "Trade with the trappers (smart money) against the trapped retail breakout traders.",
    principle: "Trapped Liquidity Mechanics"
  },
  {
    title: "High-Volume Churn at Key Levels",
    tip: "High volume accompanied by tiny candle price movement indicates intense institutional absorption of orders.",
    whyItMatters: "Someone is taking the other side of thousands of contracts without letting price move an inch.",
    practicalAction: "Watch which direction price breaks from the absorption cluster and trade in that direction.",
    principle: "Institutional Absorption"
  },
  {
    title: "Structural Momentum Deceleration",
    tip: "Observe the angle and speed of successive trend legs: if leg 1 took 5 candles to cover 50 pips, and leg 2 took 15 candles to cover 30 pips, momentum has decelerated.",
    whyItMatters: "Deceleration provides advance notice of an impending structural change of character.",
    practicalAction: "Prepare for trend exhaustion when the slope and speed of impulse legs visibly flattens.",
    principle: "Slope and Velocity Analysis"
  },
  {
    title: "The Clean Range Expansion Rule",
    tip: "When price exits a multi-day range with a clean, wide-spread marubozu candle, the market has transitioned from accumulation to trend expansion.",
    whyItMatters: "This is the green light for aggressive trend-following playbook models.",
    practicalAction: "Shift your mental mode from range-fading to aggressive trend-continuation buying/selling.",
    principle: "Regime Transition Recognition"
  },
  {
    title: "Multiple Timeframe Structural Synchronization",
    tip: "The highest probability trades occur when the Monthly, Daily, 4-Hour, and 15-Minute market structures are all printing higher highs and higher lows simultaneously.",
    whyItMatters: "Complete multi-timeframe alignment eliminates counter-trend resistance barriers.",
    practicalAction: "Create a multi-timeframe checklist and trade at maximum size only when all timeframes synchronize.",
    principle: "Complete Structural Synergy"
  },
  {
    title: "The Danger of Anticipating Structural Breaks",
    tip: "Never enter a trade assuming a structural high will break before it actually breaks.",
    whyItMatters: "The market can easily reject off that high, leaving you trapped at the worst possible entry price.",
    practicalAction: "Wait for the break and confirmation before committing capital.",
    principle: "Confirmation Over Premonition"
  },
  {
    title: "The Structural Significance of Candle Opens",
    tip: "The opening price of a daily candle establishes the benchmark line for that entire 24-hour period.",
    whyItMatters: "Bullish days spend significant time testing below the daily open before exploding higher; bearish days test above.",
    practicalAction: "Mark the daily open at 00:00 UTC and look to buy below it on bullish days.",
    principle: "Daily Open Calibration"
  },
  {
    title: "Wick-to-Wick Price Delivery",
    tip: "In tight ranges, price often bounces cleanly from wick tip to wick tip without candle bodies ever establishing directional momentum.",
    whyItMatters: "Recognizing wick-to-wick delivery prevents premature trend-continuation bias.",
    practicalAction: "Fade the range extremes with tight stops just outside the wicks until a real body breaks out.",
    principle: "Wick-Bound Delivery"
  },
  {
    title: "Structural Retracement Depth as Trend Strength Indicator",
    tip: "In ultra-strong trends, pullbacks only retrace to the 23.6% or 38.2% Fibonacci level. Deep 70% pullbacks indicate a weak, choppy trend.",
    whyItMatters: "Adjusting your target expectations to the depth of pullbacks optimizes your exit timing.",
    practicalAction: "Target larger R-multiples when pullbacks are shallow, and tighter targets when pullbacks are deep.",
    principle: "Retracement Depth Calibration"
  },
  {
    title: "Price Action Symmetry and Measured Moves",
    tip: "Impulse legs often exhibit equal mathematical length (Leg 1 = Leg 2 in pip distance and duration).",
    whyItMatters: "Measured moves provide objective mathematical targets for taking final profits on swing trades.",
    practicalAction: "Project the length of impulse leg 1 from the low of the subsequent pullback to establish your target.",
    principle: "Measured Move Geometry"
  },
  {
    title: "The Invalidation of Support by Multiple Touches",
    tip: "Contrary to retail textbooks that claim a support level gets stronger the more times it is touched, every touch actually weakens the level by consuming buy orders.",
    whyItMatters: "After 3 or 4 touches, all resting buy liquidity is exhausted, paving the way for a catastrophic breakdown.",
    practicalAction: "Avoid buying support that has already been tested 3 or 4 times; prepare for the breakdown.",
    principle: "Liquidity Depletion Principle"
  },
  {
    title: "Market Structure Shifts on the 1-Minute Chart",
    tip: "Use 1-minute market structure shifts strictly as a micro execution trigger inside a pre-identified 15-minute or 1-hour point of interest.",
    whyItMatters: "Trading 1-minute shifts in isolation without higher timeframe context will produce endless false signals.",
    practicalAction: "Only look for 1-minute confirmation when price is actively touching your higher-timeframe PD array.",
    principle: "Micro Trigger inside Macro Level"
  },
  {
    title: "The Power of the Morning Star / Evening Star",
    tip: "A true Morning Star pattern consists of a large down candle, a small indecision candle gapping below, and a large up candle closing well above the midpoint of the first candle.",
    whyItMatters: "It visualizes the complete three-phase cycle of selling, exhaustion, and aggressive buying reversal.",
    practicalAction: "Use Morning/Evening Star patterns as reliable confirmation triggers at higher-timeframe key levels.",
    principle: "Tri-Candle Reversal Cycle"
  },
  {
    title: "Price Expansion from Structural Squeeze",
    tip: "When Bollinger Bands or ATR reach multi-month historical lows, a monster structural trend is imminent.",
    whyItMatters: "Low volatility is the direct precursor to extreme volatility expansions.",
    practicalAction: "Position yourself for breakout continuation and prepare to hold runners for extended targets.",
    principle: "Squeeze to Expansion Cycle"
  },
  {
    title: "Respecting Prior Day High and Low (PDH/PDL)",
    tip: "The Prior Day High and Prior Day Low are the two most heavily traded liquidity levels in intraday financial markets.",
    whyItMatters: "Intraday algorithms target these levels almost every single day to clean out resting stop orders.",
    practicalAction: "Always draw PDH and PDL on your chart before the morning bell rings.",
    principle: "Prior Day Benchmark"
  },
  {
    title: "The Meaning of Continuous Narrow-Range Candles",
    tip: "A series of small, narrow-range candles drifting slowly in one direction indicates low liquidity and lack of institutional participation.",
    whyItMatters: "These slow grinds are vulnerable to sudden, violent reversals when real volume returns.",
    practicalAction: "Do not participate in low-volume drifts; wait for institutional displacement.",
    principle: "Low-Volume Drift Vulnerability"
  },
  {
    title: "Recognizing the Exhaustion Gap",
    tip: "An exhaustion gap appears near the end of a rapid, extended trend, representing late retail FOMO buying right before the trend collapses.",
    whyItMatters: "Identifying the exhaustion gap allows you to exit winning positions at the absolute peak of market irrationality.",
    practicalAction: "Close winning positions into the opening gap when it occurs after a prolonged multi-week run.",
    principle: "Exhaustion Gap Climax"
  },
  {
    title: "Market Structure is Pure Human Psychology",
    tip: "Every swing high is a point where fear overcame greed; every swing low is a point where greed overcame fear.",
    whyItMatters: "Charts are not abstract math; they are real-time graphical representations of collective human psychology under financial risk.",
    practicalAction: "Read price action with empathy for where retail traders are feeling maximum panic and euphoria.",
    principle: "Psychological Substrate of Structure"
  },
  {
    title: "Simplicity Wins in Price Action Analysis",
    tip: "A clean chart with only key structural swing highs, lows, and high-probability imbalances will outperform a chart cluttered with 10 conflicting indicators every single day.",
    whyItMatters: "Cluttered charts cause cognitive overload, analysis paralysis, and late execution.",
    practicalAction: "Strip away all indicators and focus 100% on raw price action, market structure, and liquidity.",
    principle: "Naked Price Action Clarity"
  }
];
