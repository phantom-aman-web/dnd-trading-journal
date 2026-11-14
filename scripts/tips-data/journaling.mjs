// scripts/tips-data/journaling.mjs
export const journalingTips = [
  {
    title: "Real-Time Logging Over End-of-Day Memory",
    tip: "Log your trades and emotional state in real time as they occur, rather than trying to reconstruct everything from memory at the end of the day.",
    whyItMatters: "Human memory suffers from intense hindsight bias; by 5:00 PM you will rationalize or forget the fear, greed, or hesitation you felt at 9:30 AM.",
    practicalAction: "Open your AlphaPips journal entry the moment you enter the trade and capture your thoughts while the position is active.",
    principle: "Real-Time Emotional Capture"
  },
  {
    title: "The Three-Screenshot Protocol",
    tip: "Every trade entry in your journal must include three screenshots: 1) Higher Timeframe Context (Daily/4H), 2) Lower Timeframe Entry (15m/5m/1m), and 3) Post-Trade Result.",
    whyItMatters: "Without the higher timeframe context, you cannot properly evaluate whether your entry aligned with dominant order flow when reviewing months later.",
    practicalAction: "Save and attach all 3 chart perspectives directly into your AlphaPips trade log before closing the file.",
    principle: "Comprehensive Visual Documentation"
  },
  {
    title: "Tracking Maximum Adverse Excursion (MAE)",
    tip: "MAE measures the maximum drawdown in pips or R-multiples that your trade experienced before moving to its target.",
    whyItMatters: "If your MAE rarely exceeds 0.5R, your stop loss may be unnecessarily wide; if MAE consistently grazes your stop before winning, your entries are premature.",
    practicalAction: "Record your MAE on every winning trade to pinpoint optimal stop loss distance.",
    principle: "MAE Optimization"
  },
  {
    title: "Tracking Maximum Favorable Excursion (MFE)",
    tip: "MFE measures the peak profit in pips or R-multiples that your trade achieved before you exited or price reversed.",
    whyItMatters: "Comparing realized R vs maximum potential R (MFE) reveals whether you are cutting winning trades too early or leaving massive profit on the table.",
    practicalAction: "Log MFE in your AlphaPips trade analytics to objectively assess your profit target efficiency.",
    principle: "MFE Target Calibration"
  },
  {
    title: "Recording No-Trade Observations and Market Notes",
    tip: "Logging why you deliberately chose NOT to trade during a choppy or high-risk session is just as valuable as logging executed trades.",
    whyItMatters: "Tracking your discipline to avoid bad market conditions reinforces capital preservation and builds market intuition.",
    practicalAction: "Use AlphaPips No-Trade Journal Entries to document avoided setups and market observations.",
    principle: "No-Trade Mastery"
  },
  {
    title: "Tagging Mistake Archetypes Systematically",
    tip: "Create standardized tags for recurring errors: #FOMO, #MovedStop, #ChasedEntry, #EarlyExit, #Oversized, #IgnoredTrend, #RevengeTrade.",
    whyItMatters: "Filtering your journal by mistake tags reveals the exact behavioral leak costing you the most money over a 50-trade sample.",
    practicalAction: "Apply at least one honest behavioral tag to every trade that deviated from your playbook.",
    principle: "Behavioral Leak Diagnosis"
  },
  {
    title: "Grading Trade Execution Independently of PnL",
    tip: "Assign an execution grade (A, B, C, F) to every trade based solely on rule adherence, completely ignoring whether the trade made or lost money.",
    whyItMatters: "A losing trade that followed every rule is an 'A' trade; an undisciplined impulsive trade that accidentally made money is an 'F' trade.",
    practicalAction: "Record your execution grade in AlphaPips before looking at your dollar PnL.",
    principle: "Execution Quality Over Outcome"
  },
  {
    title: "The Weekly Journal Post-Mortem",
    tip: "Dedicate 60 minutes every Saturday or Sunday to thoroughly review every trade taken during the week.",
    whyItMatters: "A weekend review with a calm, neutral mind reveals structural patterns, session biases, and behavioral trends invisible during the heat of trading.",
    practicalAction: "Calculate your weekly win rate, average R:R, total mistake cost, and playbook adherence score every weekend.",
    principle: "Retrospective Synthesis"
  },
  {
    title: "Documenting Pre-Trade Mental State",
    tip: "Record your physical and emotional condition before clicking: Rested, Fatigued, Anxious, Confident, Distracted, or Frustrated.",
    whyItMatters: "Correlating emotional states with trading results objectively proves which mental conditions lead to negative expectancy.",
    practicalAction: "Check your emotional state box in your journal before initiating your first trade of the day.",
    principle: "Somatic Self-Audit"
  },
  {
    title: "Calculating Mistake Cost in Currency and R",
    tip: "Keep a running total of the exact dollar and R-multiple amount lost due to rule violations each month.",
    whyItMatters: "Seeing '$3,400 lost to impulsive early entries' creates the emotional urgency required to permanently fix behavioral leaks.",
    practicalAction: "Sum your mistake tag costs at the end of each month and review the total before funding new capital.",
    principle: "Financial Cost of Indiscipline"
  },
  {
    title: "Classifying Trades by Strategy Setup Model",
    tip: "Tag every trade with its specific setup archetype: #SilverBullet, #BreakerRetest, #TurtleSoup, #AsianRangeSweep, #HTFReversal.",
    whyItMatters: "Analyzing performance by setup model shows which specific patterns produce 80% of your profits and which models are losing money.",
    practicalAction: "Filter your AlphaPips analytics by strategy tag and consider eliminating the lowest-performing model.",
    principle: "Setup Taxonomy"
  },
  {
    title: "Logging Market Regime Context",
    tip: "Note the prevailing macroeconomic and volatility regime: Trending, Consolidating, News Day, Bank Holiday, High-Volatility.",
    whyItMatters: "Certain strategies only thrive in high-volatility expansions and fail during summer consolidations.",
    practicalAction: "Tag market regime context on every trade to identify your strategy's environmental edge.",
    principle: "Regime Compatibility"
  },
  {
    title: "The Journal as Your Contract with Yourself",
    tip: "Treat your trading journal as an ironclad legal contract. If you hide a bad trade or omit an embarrassing loss, you are only lying to yourself.",
    whyItMatters: "Dishonest journaling destroys the feedback loop necessary for professional growth.",
    practicalAction: "Log your worst, most embarrassing trades with brutal honesty and zero sugar-coating.",
    principle: "Radical Transparency"
  },
  {
    title: "Documenting Time of Day and Session",
    tip: "Track the exact time of entry and session: London Open, London Close, NY AM Killzone, NY PM Session, Asian Range.",
    whyItMatters: "Most traders discover that 90% of their net profits are concentrated in one specific 2-hour window, while other hours produce net losses.",
    practicalAction: "Run an hourly PnL report inside AlphaPips to identify your most lucrative trading hours.",
    principle: "Temporal Performance Profiling"
  },
  {
    title: "Recording Instrument-Specific Performance",
    tip: "Track your win rate, profit factor, and expectancy separately for each symbol you trade (e.g. EURUSD, GBPUSD, NAS100, XAUUSD).",
    whyItMatters: "You may be highly profitable on EURUSD while bleeding all your profits away on volatile Nasdaq scalps.",
    practicalAction: "Eliminate any instrument where your expectancy is negative over a 30-trade sample.",
    principle: "Symbol-Specific Pruning"
  },
  {
    title: "Tracking Trade Duration and Hold Time",
    tip: "Record the exact duration of each trade: 5 minutes, 45 minutes, 4 hours, or multi-day swing.",
    whyItMatters: "Correlating hold time with trade outcome reveals whether your edge lies in fast momentum scalping or patient swing trading.",
    practicalAction: "Analyze whether holding trades longer increases or decreases your average R-multiple.",
    principle: "Duration Analytics"
  },
  {
    title: "Capturing the Trade Thesis in One Sentence",
    tip: "Force yourself to summarize your entire trade thesis in one concise sentence before entering: 'Long EURUSD at 15m FVG after Asian low sweep targeting 4H Buy-Side Liquidity.'",
    whyItMatters: "If you cannot summarize your trade thesis in one clean sentence, the trade is overly complex and likely low-conviction.",
    practicalAction: "Write your 1-sentence trade thesis in your journal before clicking enter.",
    principle: "Thesis Clarity"
  },
  {
    title: "The Monthly Playbook Audit",
    tip: "At the end of every month, select your top 5 best-executed trades and bind them into your personal 'Playbook of Excellence'.",
    whyItMatters: "Revisiting textbook executions primes your visual cortex to recognize identical setups during live market hours.",
    practicalAction: "Export your 5 best trades into an AlphaPips Playbook collection for daily morning review.",
    principle: "Visual Excellence Priming"
  },
  {
    title: "Tracking Slippage and Spread in Journal Logs",
    tip: "Record the difference between your planned entry/exit price and your actual broker execution price.",
    whyItMatters: "Consistently high slippage indicates poor timing, illiquid execution hours, or an uncompetitive broker.",
    practicalAction: "Audit broker slippage metrics quarterly and switch execution venues if execution drag exceeds 0.5 pips average.",
    principle: "Broker Execution Audit"
  },
  {
    title: "Documenting Missed Trades Without Emotional Regret",
    tip: "When you miss a textbook setup due to hesitation or being away from the desk, log it in your journal as a 'Missed Setup'.",
    whyItMatters: "Logging missed trades objectively proves your system is working and reduces FOMO for the next opportunity.",
    practicalAction: "Screenshot missed setups, note why you missed them, and verify that your system generated a valid signal.",
    principle: "Objective Missed Setup Auditing"
  },
  {
    title: "The Discipline Score Metric",
    tip: "Calculate a weekly Discipline Score: (Number of Trades Following 100% of Rules / Total Trades Taken) * 100.",
    whyItMatters: "Maintaining a Discipline Score above 90% is the single highest statistical predictor of multi-year profitability.",
    practicalAction: "Aim for a minimum 90% Discipline Score every single week.",
    principle: "System Adherence Tracking"
  },
  {
    title: "Recording Exit Rationale and Regret",
    tip: "Log whether you exited based on: Limit TP Hit, Stop Loss Hit, Trailing Stop Hit, or Manual Discretionary Exit.",
    whyItMatters: "Traders who frequently use discretionary manual exits almost always underperform their pre-set bracket orders.",
    practicalAction: "Compare the profitability of your automated limit exits vs your manual discretionary exits.",
    principle: "Exit Mechanism Audit"
  },
  {
    title: "Tracking Drawdown Duration and Depth",
    tip: "Record the duration in days and trades of your deepest drawdown cycles in your journal history.",
    whyItMatters: "Knowing that your maximum historical drawdown was 7 trades over 14 days gives you immense psychological strength during future drawdowns.",
    practicalAction: "Review your historical drawdown stats whenever you enter a losing streak to maintain perspective.",
    principle: "Historical Drawdown Normalization"
  },
  {
    title: "Daily Journal Morning Intentions",
    tip: "Start each trading day by writing down one behavioral goal: 'Today I will wait for candle closes and not touch my stop loss.'",
    whyItMatters: "Setting an explicit morning behavioral intention focuses your conscious mind on rule adherence.",
    practicalAction: "Write your daily intention in your AlphaPips morning journal before opening market charts.",
    principle: "Behavioral Intentionality"
  },
  {
    title: "The Post-Trade Screenshot with Annotations",
    tip: "Annotate your post-trade screenshots with arrows, entry prices, invalidation levels, and notes on what the price delivery demonstrated.",
    whyItMatters: "Visual annotations make retrospective reviews fast, intuitive, and highly educational.",
    practicalAction: "Use clear drawing tools on your chart screenshots before uploading them to your journal.",
    principle: "Annotated Visual Learning"
  },
  {
    title: "Tracking Breakeven Trades Separately",
    tip: "Do not lump breakeven trades into your loss column. Categorize them as 'Preserved Capital' events.",
    whyItMatters: "Preserving capital is a successful defensive outcome that should not penalize your win-rate psychology.",
    practicalAction: "Create a dedicated 'Breakeven' outcome category in your journal.",
    principle: "Defensive Outcome Categorization"
  },
  {
    title: "Journaling Correlated Trades Simultaneously",
    tip: "If you took trades on both EURUSD and GBPUSD during the same session, link them in your journal notes.",
    whyItMatters: "Linking correlated trades ensures you evaluate your aggregate portfolio risk rather than treating them as isolated bets.",
    practicalAction: "Add cross-references between correlated trades taken within the same market session.",
    principle: "Correlated Trade Linking"
  },
  {
    title: "The Quarterly Journal Comprehensive Audit",
    tip: "Every 90 days, conduct a comprehensive audit of your entire trade database to evaluate expectancy, profit factor, and return on capital.",
    whyItMatters: "Quarterly audits provide enough statistical sample size (100+ trades) to make sound strategic decisions.",
    practicalAction: "Generate a quarterly performance report inside AlphaPips and review with a trusted trading peer or mentor.",
    principle: "Quarterly System Review"
  },
  {
    title: "Tracking Day-of-the-Week Edge",
    tip: "Log your performance by day of the week: Monday, Tuesday, Wednesday, Thursday, Friday.",
    whyItMatters: "Many traders find Mondays and Fridays produce net negative results, while Tuesday through Thursday generate 100% of their gains.",
    practicalAction: "If a specific day shows consistent negative expectancy over 6 months, consider not trading on that day.",
    principle: "Day-of-Week Seasonality"
  },
  {
    title: "Documenting the Quality of the Trade Setup (A/B/C)",
    tip: "Tag whether the setup was an 'A+ Setup' (all confluences aligned), 'B Setup' (minor conflict), or 'C Setup' (substandard).",
    whyItMatters: "Proves whether your profitability is coming exclusively from A+ setups, prompting you to cut C setups entirely.",
    practicalAction: "Track your expectancy broken down by setup grade in AlphaPips.",
    principle: "Setup Tier Profiling"
  },
  {
    title: "The Emotional Temperature Check at Exit",
    tip: "Record how you felt immediately upon trade completion: Relieved, Angry, Proud, Regretful, or Neutral.",
    whyItMatters: "Feeling 'relief' after a winning trade indicates you were over-leveraged or uncomfortable with the risk taken.",
    practicalAction: "Aim for consistent 'Neutral' emotional ratings regardless of the trade outcome.",
    principle: "Exit Emotion Diagnostic"
  },
  {
    title: "Logging Account Equity Curve Milestones",
    tip: "Record your account balance and equity high-water mark every Friday after the market closes.",
    whyItMatters: "Tracking equity curves visually reinforces long-term compounding progress.",
    practicalAction: "Plot your weekly equity curve in AlphaPips to monitor trajectory over months and years.",
    principle: "Equity Trajectory Tracking"
  },
  {
    title: "The Power of Voice or Video Journaling",
    tip: "Record a 60-second video or voice memo during your live trade explaining why you entered and what you expect to happen.",
    whyItMatters: "Hearing your own tone of voice exposes hesitation, excitement, or panic that text notes cannot fully capture.",
    practicalAction: "Record a quick voice observation directly into your AlphaPips note before entry.",
    principle: "Multimodal Journaling"
  },
  {
    title: "Tracking Consecutive Win and Loss Streaks",
    tip: "Log your longest winning streak and longest losing streak in your journal statistics.",
    whyItMatters: "Knowing that an 8-trade losing streak is statistically normal for your strategy prevents panic when it happens.",
    practicalAction: "Keep your maximum loss streak prominently displayed to maintain emotional equanimity during drawdowns.",
    principle: "Streak Normalization"
  },
  {
    title: "Documenting Strategy Rule Evolution",
    tip: "Keep a changelog in your journal documenting every time you modify an operational rule, along with the date and reasoning.",
    whyItMatters: "Prevents making random, impulsive rule changes without proper documentation and testing.",
    practicalAction: "Maintain an official 'Strategy Changelog' tab in your trading documentation.",
    principle: "Systemic Version Control"
  },
  {
    title: "Logging News Events Associated with Trades",
    tip: "Note if an economic news release occurred during your trade hold time: CPI, FOMC, NFP, Retail Sales, or None.",
    whyItMatters: "Reveals whether your winners were lucky news gambles or clean technical price action deliveries.",
    practicalAction: "Tag all trades held through news events to separate technical edge from event volatility.",
    principle: "News Event Attribution"
  },
  {
    title: "The Value of Peer Review in Journaling",
    tip: "Share an anonymized export of your weekly journal with a disciplined trading partner for mutual accountability.",
    whyItMatters: "Knowing an objective third party will inspect your trades prevents impulsive rule-breaking during market hours.",
    practicalAction: "Establish a weekly accountability exchange with a fellow serious trader.",
    principle: "External Accountability"
  },
  {
    title: "Tracking Risk-to-Reward Ratio Realization Rate",
    tip: "Compare your planned R:R ratio against your actual realized R:R ratio over a 50-trade sample.",
    whyItMatters: "If your planned R:R is 3:1 but realized R:R is only 1.2:1, you have a chronic habit of premature exits.",
    practicalAction: "Monitor your Realized vs Planned R-multiple efficiency in AlphaPips analytics.",
    principle: "R:R Realization Efficiency"
  },
  {
    title: "Journaling as a Daily Mindfulness Practice",
    tip: "Treat your post-session journaling routine as a sacred decompression ritual that transitions you from 'trader' back to normal life.",
    whyItMatters: "Completing your journal closes open psychological loops, allowing you to enjoy your evening without lingering market anxiety.",
    practicalAction: "Never leave your trading desk until your journal entries for the day are 100% complete and filed.",
    principle: "Psychological Closure Ritual"
  },
  {
    title: "Logging Commission and Swap Costs",
    tip: "Track your cumulative broker commission and financing fees on every trade log.",
    whyItMatters: "Over hundreds of trades, high fees can consume up to 30% of gross profits, requiring adjustments to hold times or brokers.",
    practicalAction: "Audit your net profit vs gross profit ratio monthly to monitor fee efficiency.",
    principle: "Operational Friction Tracking"
  },
  {
    title: "Categorizing Trades by Market Direction (Long vs Short)",
    tip: "Track your win rate and profitability separately for Long trades versus Short trades.",
    whyItMatters: "Many traders have an unconscious psychological bias toward buying or selling that degrades their performance on one side.",
    practicalAction: "Identify whether your Long or Short edge is superior and focus on your stronger directional side.",
    principle: "Directional Bias Auditing"
  },
  {
    title: "Documenting Unexpected Market Behaviors",
    tip: "When the market does something completely shocking or anomalous, create a dedicated 'Market Anomaly' study note.",
    whyItMatters: "Studying anomalous market deliveries expands your playbook and prepares you for rare market conditions.",
    practicalAction: "Save anomalous chart patterns into a dedicated 'Edge Case' folder for ongoing study.",
    principle: "Anomaly Cataloging"
  },
  {
    title: "The Power of Searchable Journal Tags",
    tip: "Use consistent, searchable tags so you can instantly pull up every trade matching a specific pattern: e.g. #BreakerBlock #Loss.",
    whyItMatters: "Instant filtering allows you to study all past failures of a specific setup to identify common warning signs.",
    practicalAction: "Search your AlphaPips journal for recurring losing setups and identify what they had in common.",
    principle: "Taxonomic Searchability"
  },
  {
    title: "Recording Hardware and Software Issues",
    tip: "Document any technical glitches: platform disconnects, order entry freezes, or internet latency spikes.",
    whyItMatters: "Tracking technical failures prompts you to invest in backup internet connections and better trading hardware before disaster strikes.",
    practicalAction: "Log hardware or connection failures and establish redundant backup execution systems.",
    principle: "Infrastructure Resilience"
  },
  {
    title: "The Pre-Weekend Journal Decompression",
    tip: "Complete all Friday trade logs and write a concise 3-sentence summary of your weekly performance before 6:00 PM Friday.",
    whyItMatters: "Entering the weekend with clean, completed records allows your mind to rest and fully recharge for the coming week.",
    practicalAction: "File all records Friday afternoon and deliberately forget about markets until Sunday evening.",
    principle: "Clean Slate Weekends"
  },
  {
    title: "Tracking Rule Adherence Streaks",
    tip: "Track how many consecutive trades you have executed with 100% adherence to your strategy checklist.",
    whyItMatters: "Building a 20-trade or 50-trade perfect execution streak shifts your motivation from dollar hunting to professional mastery.",
    practicalAction: "Gamify your discipline by trying to beat your all-time record for consecutive rule-abiding trades.",
    principle: "Discipline Streak Gamification"
  },
  {
    title: "Logging Post-Trade Physical Sensations",
    tip: "Notice if your body feels relaxed, tense, or fatigued after closing a position.",
    whyItMatters: "Somatic feedback provides early warning signs of subconscious stress and impending burnout.",
    practicalAction: "Record physical comfort levels in your journal notes.",
    principle: "Somatic Monitoring"
  },
  {
    title: "The Annual Journal Retrospective",
    tip: "At the end of each calendar year, review all 12 monthly performance summaries to map your multi-year trading evolution.",
    whyItMatters: "Viewing your long-term progress provides immense perspective and proves how far your skills have developed.",
    practicalAction: "Compile an annual trading report celebrating growth milestones and defining strategic goals for the new year.",
    principle: "Macro Longevity Perspective"
  },
  {
    title: "Evaluating Trade Invalidation Timeliness",
    tip: "Log whether you exited immediately upon setup invalidation or if you hesitated and waited for extra candles.",
    whyItMatters: "Measuring exit timeliness reveals whether you are still harboring hopes on failed ideas.",
    practicalAction: "Score your exit timeliness from 1 to 5 in your trade log.",
    principle: "Invalidation Promptness"
  },
  {
    title: "Your Journal is Your Proprietary IP",
    tip: "A comprehensive trading journal containing 500+ documented trades is the single most valuable intellectual property you will ever own as a trader.",
    whyItMatters: "It contains the empirical mathematical proof of your personal edge, customized to your exact psychology and execution style.",
    practicalAction: "Back up your AlphaPips journal database regularly and treat your data as your most precious professional asset.",
    principle: "Proprietary Data Value"
  },
  {
    title: "The Honest No-Excuses Rule",
    tip: "Never write 'The broker hunted my stop' or 'The market maker was manipulating' in your trade journal.",
    whyItMatters: "Writing victim narratives disempowers you from taking ownership and improving your invalidation criteria.",
    practicalAction: "Frame every journal entry around: 'What did the chart show, and what was my personal execution decision?'",
    principle: "Empowered Ownership"
  },
  {
    title: "Journaling is the Foundation of Mastery",
    tip: "Without a detailed journal, you are simply gambling and hoping for random luck. With a journal, you are running a systematic, data-driven quantitative business.",
    whyItMatters: "Every legendary hedge fund and professional trading firm relies on relentless data logging and performance attribution.",
    practicalAction: "Make journaling non-negotiable. Trade, log, review, optimize, and compound.",
    principle: "The Quantitative Foundation"
  }
];
