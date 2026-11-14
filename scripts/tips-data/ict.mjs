// scripts/tips-data/ict.mjs
export const ictTips = [
  {
    title: "Anatomy of a Valid Fair Value Gap (FVG)",
    tip: "A true Fair Value Gap is a 3-candle sequence where candle 1's high (for bullish FVG) does not overlap with candle 3's low, created by institutional displacement in candle 2.",
    whyItMatters: "FVGs represent price delivery inefficiency where one side of the market was aggressively bypassed; price frequently returns to balance this inefficiency.",
    practicalAction: "Only mark FVGs created by energetic displacement bodies that break prior market structure.",
    principle: "Imbalance & Price Delivery"
  },
  {
    title: "Inversion Fair Value Gap (IFVG) Transition",
    tip: "When price aggressively violates and closes through a Fair Value Gap instead of respecting it, that gap inverses its polarity and acts as support/resistance in the opposite direction.",
    whyItMatters: "Failed PD arrays provide tremendous insight into true institutional order flow and imminent momentum shifts.",
    practicalAction: "When a bullish FVG is cleanly closed below by candle bodies, look to use it as a bearish resistance ceiling on the next retest.",
    principle: "Array Inversion"
  },
  {
    title: "Buy-Side and Sell-Side Liquidity (BSL/SSL)",
    tip: "Liquidity resides above clean swing highs (Buy-Side Liquidity - buy stops) and below clean swing lows (Sell-Side Liquidity - sell stops).",
    whyItMatters: "Institutions require counterpart liquidity to fill massive block orders. They hunt these resting stops before launching genuine directional runs.",
    practicalAction: "Always ask: 'Whose stop losses are resting at this obvious level, and is smart money using them for exit or entry liquidity?'",
    principle: "Liquidity Pools & Counterparts"
  },
  {
    title: "Market Structure Shift (MSS) vs Break of Structure (BOS)",
    tip: "A Break of Structure (BOS) occurs in the direction of the existing trend. A Market Structure Shift (MSS) requires energetic displacement violating the swing point that created the extreme high or low.",
    whyItMatters: "Confusing a minor pullback break with a true market structure shift leads to prematurely trying to pick tops and bottoms.",
    practicalAction: "Look for strong candle bodies closing beyond the swing level accompanied by a fresh Fair Value Gap to confirm an MSS.",
    principle: "Structural Disruption Confirmation"
  },
  {
    title: "Order Block Qualification Criteria",
    tip: "Not every opposite-colored candle is an Order Block. A valid bullish Order Block is the lowest down-close candle prior to an explosive up-move that breaks structure and creates an FVG.",
    whyItMatters: "Trading random candles without displacement creates endless stopped-out trades at pseudo-support levels.",
    practicalAction: "Verify that the candidate Order Block successfully engineered displacement and broke opposing market structure before placing an order.",
    principle: "Institutional Footprint Verification"
  },
  {
    title: "Breaker Block vs Mitigation Block",
    tip: "A Breaker Block is an Order Block that swept prior liquidity before failing and breaking structure. A Mitigation Block failed without sweeping liquidity.",
    whyItMatters: "Breakers are far more powerful because they trapped institutional volume on the wrong side during the liquidity purge.",
    practicalAction: "Give higher conviction weight to Breaker Blocks that took out significant buy-side or sell-side stops before shifting structure.",
    principle: "Trapped Volume Dynamics"
  },
  {
    title: "Optimal Trade Entry (OTE) Fibonacci Levels",
    tip: "Draw your Fibonacci retracement from the swing low to swing high of the displacement leg: OTE resides between the 62% and 79% levels, with 70.5% as the sweet spot.",
    whyItMatters: "Entering in the OTE zone ensures you buy deep in discount or sell high in premium, maximizing your risk-to-reward ratio.",
    practicalAction: "Align the 62%-79% OTE retracement zone with a concurrent Fair Value Gap or Order Block for textbook high-probability confluence.",
    principle: "Deep Discount/Premium Confluence"
  },
  {
    title: "Consequent Encroachment (C.E.) of FVGs and Wicks",
    tip: "Consequent Encroachment is the exact 50% midpoint of a Fair Value Gap or a long price wick.",
    whyItMatters: "Algorithms often respect the 50% midpoint of an imbalance to achieve equilibrium without needing to fully close the gap.",
    practicalAction: "Place your limit orders or alert triggers at the 50% C.E. level of high-timeframe imbalances.",
    principle: "Equilibrium Imbalance Pricing"
  },
  {
    title: "Mean Threshold of an Order Block",
    tip: "The Mean Threshold is the exact 50% halfway point of the qualifying Order Block's real candle body.",
    whyItMatters: "Healthy institutional order flow respects the Mean Threshold; a candle body closing beyond the 50% level typically invalidates the block.",
    practicalAction: "Place your stop loss safely beyond the Order Block or invalidate your thesis if candle bodies close beyond its Mean Threshold.",
    principle: "Order Block Integrity Metric"
  },
  {
    title: "Smart Money Tool (SMT) Divergence",
    tip: "SMT Divergence occurs when correlated assets (like EURUSD vs GBPUSD, or ES vs NQ) fail to confirm each other at key structural highs or lows.",
    whyItMatters: "When EURUSD makes a higher high but GBPUSD makes a lower high at a key resistance level, it signals institutional crack in correlation and imminent reversal.",
    practicalAction: "Monitor EURUSD and GBPUSD side by side during the London and New York Killzones to spot SMT liquidity sweeps.",
    principle: "Inter-Market Correlation Cracks"
  },
  {
    title: "The Judas Swing in London Open",
    tip: "During the London Open (02:00 - 05:00 AM EST), the algorithm often creates an aggressive false push in the opposite direction of the true daily trend.",
    whyItMatters: "This Judas Swing manipulates retail traders into taking breakout positions while sweeping Asian session liquidity before the real expansion.",
    practicalAction: "Wait for the false manipulation run to sweep Asian high/low, watch for an MSS on the 5-minute chart, and trade the reversal.",
    principle: "Session Manipulation Protocol"
  },
  {
    title: "New York Silver Bullet Setup",
    tip: "Between 10:00 AM and 11:00 AM EST (New York AM), identify liquidity sweep, wait for an MSS with displacement, and enter the newly formed Fair Value Gap targeting opposite liquidity.",
    whyItMatters: "The Silver Bullet is a time-based algorithmic execution model with standardized high-probability delivery parameters.",
    practicalAction: "Mark the 10:00 - 11:00 AM EST window on your chart daily and execute only when an obvious liquidity draw is present.",
    principle: "Time & Price Precision"
  },
  {
    title: "Power of 3 (AMD): Accumulation, Manipulation, Distribution",
    tip: "Every classic trading bar or session consists of Accumulation (Asian consolidation), Manipulation (London Judas fake-out), and Distribution (NY trend expansion).",
    whyItMatters: "Understanding which phase of AMD you are currently observing prevents buying into the top of manipulation or selling the bottom.",
    practicalAction: "Do not buy breakouts during the Accumulation phase; wait for the Manipulation swing to purge liquidity before joining Distribution.",
    principle: "Algorithmic Delivery Cycle"
  },
  {
    title: "New Week Opening Gap (NWOG)",
    tip: "The New Week Opening Gap is the price differential between Friday's 5:00 PM EST close and Sunday's 6:00 PM EST market open.",
    whyItMatters: "NWOGs remain potent algorithmic magnetic support and resistance zones for days or weeks into the future.",
    practicalAction: "Mark Friday's close and Sunday's open on your charts and extend the gap forward across the entire trading week.",
    principle: "Weekly Temporal Imbalance"
  },
  {
    title: "New Day Opening Gap (NDOG)",
    tip: "The price gap between 4:59:59 PM EST settlement and 6:00 PM EST daily restart in CME futures contracts.",
    whyItMatters: "Like NWOGs, the 50% Consequent Encroachment of the NDOG serves as a powerful intraday inflection point.",
    practicalAction: "Plot daily opening gaps on index futures (ES/NQ) to identify hidden support/resistance levels.",
    principle: "Daily Settlement Imbalance"
  },
  {
    title: "Internal to External Range Liquidity",
    tip: "Price moves in a continuous harmonic cycle: it expands from internal liquidity (FVGs, OBs) to external liquidity (old swing highs/lows), then retraces back inside.",
    whyItMatters: "When price takes external liquidity (sweeps an old high), do not buy the breakout; expect a retracement back toward internal imbalances.",
    practicalAction: "Target external highs/lows when holding trades from internal PD arrays, and vice-versa.",
    principle: "Harmonic Range Delivery"
  },
  {
    title: "The Midnight New York Open Price Benchmark",
    tip: "The price at 00:00 midnight New York time (EST) is the algorithmic baseline for determining true intraday premium vs discount.",
    whyItMatters: "In a bullish daily expansion, the best buy setups occur BELOW the midnight NY open price (buying in discount).",
    practicalAction: "Plot a horizontal line across your chart at the 00:00 NY midnight opening tick every single trading day.",
    principle: "True Day Baseline"
  },
  {
    title: "Daily Bias Determination via Higher Timeframe Arrays",
    tip: "Do not determine daily bias from the 5-minute or 15-minute chart. Daily bias is governed by what the Daily and 4-Hour charts are reaching for next.",
    whyItMatters: "Day-trading against higher-timeframe order flow results in quick stop-outs even on clean lower-timeframe patterns.",
    practicalAction: "Check the Daily chart every morning: has it recently swept liquidity, or is it drawing toward an unfilled Daily FVG?",
    principle: "HTF Directional Dominance"
  },
  {
    title: "Balanced Price Range (BPR)",
    tip: "A Balanced Price Range is created when an aggressive up-close FVG is immediately followed by an aggressive down-close FVG overlapping the same exact price coordinates.",
    whyItMatters: "Because liquidity was delivered efficiently on both sides in rapid succession, price will treat this shared zone as ironclad support or resistance.",
    practicalAction: "Mark the overlap between the two opposite gaps as a high-conviction institutional rejection barrier.",
    principle: "Dual-Delivery Balance"
  },
  {
    title: "Volume Imbalance vs True Gap",
    tip: "A Volume Imbalance occurs when candle bodies do not overlap, but their wicks do touch or overlap.",
    whyItMatters: "Volume Imbalances indicate fast algorithmic trading without substantial volume at those price ticks, drawing price back for re-delivery.",
    practicalAction: "Treat the space between candle bodies as a minor FVG even if the wicks overlapped.",
    principle: "Microstructure Inefficiency"
  },
  {
    title: "Relative Equal Highs (EQH) and Equal Lows (EQL)",
    tip: "When two or more swing highs or lows line up at almost the exact same price tick, retail traders see double tops/bottoms, but smart money sees massive liquidity pools.",
    whyItMatters: "Double tops are engineered liquidity traps. The algorithm will almost always sweep clean equal highs before any major reversal.",
    practicalAction: "Never short right below clean equal highs; wait for the inevitable liquidity purge before considering a short.",
    principle: "Engineered Liquidity Magnets"
  },
  {
    title: "Turtle Soup Reversal Model",
    tip: "Turtle Soup is an ICT reversal setup where price penetrates an established 20-day high or low by a small margin, fails to displace, and rapidly closes back inside the range.",
    whyItMatters: "It traps breakout traders and consumes resting stop orders without intending to facilitate price continuation.",
    practicalAction: "When a major multi-day low is swept by a wick that immediately prints an inverted displacement candle, look for a long entry.",
    principle: "False Breakout Exploitation"
  },
  {
    title: "Inducement Liquidity Highs and Lows",
    tip: "An inducement is a minor, obvious swing high or low formed just before price reaches a major higher-timeframe PD array.",
    whyItMatters: "Retail traders jump into the minor swing early, providing the fuel and stops that smart money sweeps into the actual key level.",
    practicalAction: "Do not enter at the minor swing; wait for the inducement to get swept directly into the higher timeframe Order Block.",
    principle: "Pre-Target Liquidity Traps"
  },
  {
    title: "London Close Killzone Reversal Profile",
    tip: "Between 10:00 AM and 12:00 PM EST, London traders close their daily books, frequently generating a counter-trend retracement or daily high/low.",
    whyItMatters: "Trying to enter trend-continuation trades during the London Close often results in getting caught in the daily profit-taking retracement.",
    practicalAction: "Take profits on day trades as the clock approaches 11:30 AM EST or look for shallow counter-trend scalps.",
    principle: "Session Book-Squaring"
  },
  {
    title: "Propulsion Block Mechanics",
    tip: "A Propulsion Block is an Order Block that retests and bounces off a previously established, valid Order Block.",
    whyItMatters: "It signals extreme institutional urgency; the algorithm will not allow price to retrace deeper into the initial block.",
    practicalAction: "Place entries aggressively at the high of a bullish propulsion block, using its low as a tight invalidation stop.",
    principle: "Accelerated Momentum Blocks"
  },
  {
    title: "Rejection Block Identification",
    tip: "A Rejection Block forms when price creates long wicks at a swing high or low, with candle bodies clustered well below the wick extremes.",
    whyItMatters: "Smart money orders reside at the candle body highs rather than the wick tips; price will often respect the body highs without revisiting wicks.",
    practicalAction: "Set entries and invalidation levels at the candle body tops/bottoms of the rejection formation.",
    principle: "Wick Inefficiency Discounting"
  },
  {
    title: "Vacuum Block / Opening Gap Mechanics",
    tip: "A Vacuum Block is an unfilled gap created during scheduled news releases or sudden weekend geopolitical events.",
    whyItMatters: "Price treats the vacuum as an empty void that must eventually be auctioned and back-filled by institutional algorithms.",
    practicalAction: "Identify unfilled vacuum blocks as primary magnetic draws on liquidity over multi-day horizons.",
    principle: "Void Repatriation"
  },
  {
    title: "The Interbank Price Delivery Algorithm (IPDA) 20-40-60 Lookback",
    tip: "Algorithms reference the high and low extremes of the trailing 20-day, 40-day, and 60-day institutional lookback windows.",
    whyItMatters: "Major trend reversals and liquidity runs consistently terminate at the 20-day or 60-day trailing swing levels.",
    practicalAction: "Mark the trailing 20-day and 40-day highs and lows on your daily chart every Monday morning.",
    principle: "Institutional Lookback Framework"
  },
  {
    title: "Equilibrium Definition of a Dealing Range",
    tip: "Define your current dealing range from major swing low to major swing high: the exact 50% level separates Premium (above 50%) from Discount (below 50%).",
    whyItMatters: "Never buy in Premium and never sell in Discount. High-probability institutional longs occur exclusively in Discount.",
    practicalAction: "Apply a 50% equilibrium box to your current dealing range and filter out all setups that violate this rule.",
    principle: "Wholesale vs Retail Pricing"
  },
  {
    title: "Algorithmic Macro Delivery Windows",
    tip: "Algorithmic macro routines inject targeted volume during specific intraday windows: 08:50-09:10, 09:50-10:10, 10:50-11:10, and 13:10-13:40 EST.",
    whyItMatters: "Price frequently accelerates, fills FVGs, or reverses sharply during these 20-minute programmed injection windows.",
    practicalAction: "Anticipate execution triggers or take-profit targets right at the onset of these algorithmic windows.",
    principle: "Macro Window Precision"
  },
  {
    title: "The Role of Central Bank Dealer's Range (CBDR)",
    tip: "The CBDR measures the price range between 2:00 PM and 8:00 PM EST (14:00 - 20:00).",
    whyItMatters: "A tight CBDR (under 30-40 pips on majors) often forecasts an explosive, high-volume London session expansion.",
    practicalAction: "Measure the CBDR pip range to gauge whether tomorrow's London session will be a trending day or a consolidation day.",
    principle: "Volatility Expansion Forecasting"
  },
  {
    title: "Asian Range Consolidation Archetype",
    tip: "The Asian session (8:00 PM - 02:00 AM EST) establishes the initial liquidity bracket for the coming European and US trading day.",
    whyItMatters: "High-probability London setups typically start by sweeping either the Asian session high or low during the Judas Swing.",
    practicalAction: "Draw horizontal lines across the Asian high and low; wait for London to raid one side before executing your trade.",
    principle: "Asian Liquidity Brackets"
  },
  {
    title: "Reclaimed Order Block Dynamics",
    tip: "When an Order Block has already been tested once and price subsequently penetrates slightly deeper before rejecting again, it becomes a Reclaimed Block.",
    whyItMatters: "Reclaimed blocks offer secondary continuation opportunities for traders who missed the initial expansion.",
    practicalAction: "Watch for price to respect the extreme tail of the reclaimed block on lower timeframe confirmation.",
    principle: "Secondary Re-delivery"
  },
  {
    title: "Liquidity Void Rapid Filling Mechanics",
    tip: "A liquidity void is characterized by long, consecutive one-directional candles with very small wicks, indicating a lack of two-way trade.",
    whyItMatters: "When price turns back into a liquidity void, it typically traverses through it very rapidly with minimal friction.",
    practicalAction: "Do not place intermediate counter-trend limit orders inside an open void; wait for the void to completely fill.",
    principle: "Low-Friction Travel"
  },
  {
    title: "The Power of the 08:30 AM EST News Drop",
    tip: "08:30 AM EST is the standard release time for major US macroeconomic data (CPI, Non-Farm Payrolls, GDP, Retail Sales).",
    whyItMatters: "The 08:30 spike is an algorithmic repricing event designed to reach higher-timeframe PD arrays in seconds.",
    practicalAction: "Never front-run 08:30 AM news with market orders. Wait for the initial spike to resolve into a clean MSS.",
    principle: "Macro Repricing Event"
  },
  {
    title: "Validating Institutional Sponsorship",
    tip: "True institutional sponsorship is marked by wide-range candle bodies, consecutive candles closing near their highs/lows, and clean gaps left open.",
    whyItMatters: "Small, overlapping candles with long wicks reflect retail squabbling, not institutional order flow.",
    practicalAction: "Only enter trades when the displacement leg clearly shows institutional footprint candles.",
    principle: "Footprint of Smart Money"
  },
  {
    title: "Fair Value Gap Invalidation Rule",
    tip: "If a candle closes with its full real body beyond the boundary of a Fair Value Gap, that gap is considered violated and spent.",
    whyItMatters: "Continuing to treat violated imbalances as active support leads to repeatedly fighting the new order flow.",
    practicalAction: "Remove violated FVGs from your chart immediately to keep your operational workspace clean.",
    principle: "Array Depreciation"
  },
  {
    title: "The Breaker with Confluent FVG Archetype",
    tip: "The highest probability setup in the ICT model occurs when an energetic Market Structure Shift creates a Breaker Block that directly overlaps a Fair Value Gap.",
    whyItMatters: "This dual confluence combines trapped institutional volume with an un-auctioned liquidity imbalance.",
    practicalAction: "Prioritize this setup above all others in your playbook; size at full risk when fully confirmed.",
    principle: "Highest-Conviction Confluence"
  },
  {
    title: "Wick as a Liquidity Pool",
    tip: "Long wicks on 1-hour or 4-hour charts contain hidden Fair Value Gaps and liquidity pools on the 5-minute or 15-minute timeframe.",
    whyItMatters: "What looks like a simple wick on a high timeframe is a full auction vacuum that price often retests to 50% Consequent Encroachment.",
    practicalAction: "Drill down into long HTF wicks to map out lower timeframe imbalances for precision sniper entries.",
    principle: "Fractal Wick Resolution"
  },
  {
    title: "Displacement as the Litmus Test",
    tip: "Without displacement, there is no valid setup. Displacement is the undeniable proof that large institutional capital has stepped in.",
    whyItMatters: "Slow, lethargic grinds across levels are easily reversed because no significant market participants are defending them.",
    practicalAction: "Require at least one large, clear displacement candle before confirming any structural shift.",
    principle: "Displacement Primacy"
  },
  {
    title: "Premium and Discount Array Hierarchy",
    tip: "PD Arrays follow an order of priority: Old Highs/Lows > Rejection Blocks > Order Blocks > Fair Value Gaps > Liquidity Voids.",
    whyItMatters: "Understanding the hierarchy prevents expecting price to reverse at an FVG when an un-swept major old high sits 5 pips above it.",
    practicalAction: "Map out all PD arrays in sequence between current price and the ultimate draw on liquidity.",
    principle: "Sequential Array Priority"
  },
  {
    title: "Draw on Liquidity (DOL) Primacy",
    tip: "Before looking for an entry pattern, you must first answer: 'Where is price being drawn to right now?'",
    whyItMatters: "Taking an entry pattern without knowing the destination is like boarding a high-speed train without checking the tracks.",
    practicalAction: "Identify the high-timeframe DOL (unfilled FVG or major swing liquidity) before switching to lower timeframes.",
    principle: "Destination First"
  },
  {
    title: "The Friday Profit-Taking Drift",
    tip: "Between 1:00 PM and 4:00 PM EST on Fridays, institutional trading desks square positions, causing sideways chop or slow drift against the weekly trend.",
    whyItMatters: "Entering new trades on Friday afternoon exposes you to poor risk-reward and spread widening.",
    practicalAction: "Pack up your trading desk by 12:00 PM EST on Friday and preserve your weekly profits.",
    principle: "Weekly Book Square"
  },
  {
    title: "Engineered Liquidity Run Cycles",
    tip: "When the market prints three or four equal highs in a row over several days, it is actively building a massive pool of buy stops for an upcoming expansion.",
    whyItMatters: "Institutions deliberately refrain from taking highs to accumulate enough retail stop volume for their large exit orders.",
    practicalAction: "Be patient while liquidity builds; prepare to trade the violent expansion when the pool is finally breached.",
    principle: "Liquidity Engineering"
  },
  {
    title: "Optimal Stop Placement Behind the Swing Origin",
    tip: "Place your stop loss behind the structural swing origin that engineered the displacement, not just behind the entry FVG.",
    whyItMatters: "Algorithms frequently test through the FVG to the root Order Block before reversing.",
    practicalAction: "Give your trade structural survivability by placing stops beyond the swing origin.",
    principle: "Structural Armor"
  },
  {
    title: "The 09:30 AM EST Equity Open Shockwave",
    tip: "The 09:30 AM EST New York equity bell brings a massive flood of volume and index rebalancing.",
    whyItMatters: "Intraday trends established prior to 09:30 AM are often completely reversed or violently whipsawed within the first 15 minutes of the open.",
    practicalAction: "Wait until 09:45 AM or 10:00 AM EST before entering index trades (NQ, ES, US30).",
    principle: "Equity Open Settlement"
  },
  {
    title: "Relative Equal Lows as Target Objectives",
    tip: "When shorting, target clean Relative Equal Lows (EQL) for your take-profit orders rather than arbitrary support lines.",
    whyItMatters: "Equal lows are guaranteed to have dense stop-loss orders resting beneath them, providing immediate filling liquidity for your limit covers.",
    practicalAction: "Place your limit buy-to-cover 1-2 pips above clean equal lows to ensure guaranteed execution.",
    principle: "Targeting Resting Fuel"
  },
  {
    title: "The Danger of Overlapping Low-Timeframe Arrays",
    tip: "When 1-minute charts show five overlapping FVGs within a 10-pip span, price action is consolidating and choppy.",
    whyItMatters: "Overlapping arrays indicate a lack of clear institutional direction.",
    practicalAction: "Zoom out to the 15-minute chart to identify the true controlling PD array before trading.",
    principle: "Timeframe Filtering"
  },
  {
    title: "Mitigation Block Clean-Up",
    tip: "A Mitigation Block is an un-mitigated order block that failed to create a new high/low and was subsequently broken by price.",
    whyItMatters: "Institutions return to these levels to close out lingering breakeven exposure.",
    practicalAction: "Use mitigation blocks as secondary bounce areas when no breaker block is present.",
    principle: "Order Book Balancing"
  },
  {
    title: "Consequent Encroachment of Long Candle Bodies",
    tip: "In exceptionally large news candles, the 50% midpoint of the candle body functions as dynamic support or resistance.",
    whyItMatters: "Price rarely fills 100% of a massive 80-pip news expansion immediately; the 50% body mark is the primary inflection level.",
    practicalAction: "Measure the body from open to close, calculate the 50% midpoint, and look for reaction wicks.",
    principle: "News Body Equilibrium"
  },
  {
    title: "The Complete ICT Setup Lifecycle",
    tip: "A full textbook ICT setup consists of: 1) HTF Draw on Liquidity established, 2) Session Killzone active, 3) Liquidity pool swept, 4) MSS with displacement, 5) Entry at FVG/OTE in discount/premium, 6) Target opposite liquidity.",
    whyItMatters: "Executing only when all six phases align is the secret to high win-rate, high-expectancy consistency.",
    practicalAction: "Check off all 6 steps before placing your entry order.",
    principle: "Complete Lifecycle Execution"
  },
  {
    title: "ICT Concepts Work Across All Asset Classes",
    tip: "The algorithms that deliver price operate on the exact same liquidity mechanics whether trading Forex, Futures, Crypto, or Commodities.",
    whyItMatters: "Liquidity, displacement, and time-based delivery are universal mathematical principles of electronic financial markets.",
    practicalAction: "Master the core framework on one instrument first, then apply the identical model across other liquid markets.",
    principle: "Universal Algorithmic Delivery"
  }
];
