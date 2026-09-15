# DnD
## Ultimate Production Build Specification
### Trading Performance OS, Journal, Strategy Laboratory, Evidence System, Analytics Engine and Private Trading Workspace

---

# 0. ROLE AND MISSION

You are a senior:

- Product architect
- Full-stack engineer
- TypeScript/React engineer
- Next.js engineer
- PostgreSQL/Supabase engineer
- UX/UI designer
- Security engineer
- Data/analytics engineer
- QA engineer
- Performance engineer

Your task is to design and build **DnD**, a serious production-grade trading performance platform.

Do not build a generic trading journal.

Do not build a static dashboard.

Do not build a visual prototype where buttons only appear to work.

Build a real application with:

- real persistence
- real authentication
- real authorization
- real calculations
- real media storage
- real strategy versioning
- real analytics
- real imports and exports
- real offline behavior
- real error handling
- real validation
- real security
- real tests
- responsive UX
- accessible UX
- maintainable architecture

The finished product should be capable of supporting a real trader who records hundreds or thousands of trades over time.

---

# 1. PRODUCT IDENTITY

## Product

**DnD**

## Category

Private trading performance system.

## Core positioning

DnD connects:

**Strategy → Trading Plan → Setup → Execution → Evidence → Result → Psychology → Review → Analytics → Improvement → Strategy**

DnD exists to help a trader understand not only:

**"Did I win?"**

but:

**"Why did I win or lose, did I follow my process, what evidence supports the decision, what behaviors are repeatedly hurting me, which strategy versions actually perform, and what should I change next?"**

---

# 2. PRODUCT NORTH STAR

The product must make it possible for a trader to answer:

> **How did I trade this week, why did I win or lose, and what should I change?**

in approximately two minutes.

The central learning loop is:

```text
STRATEGY
   ↓
PLAN
   ↓
SETUP
   ↓
TRADE
   ↓
EVIDENCE
   ↓
RESULT
   ↓
PSYCHOLOGY
   ↓
REVIEW
   ↓
ANALYTICS
   ↓
IMPROVE
   ↓
STRATEGY VERSION
   ↺
```

Every major feature must support this loop.

Do not add features just because they are impressive.

If a feature does not materially improve recording, understanding, reviewing, protecting, or improving trading performance, it should not be prioritized for the core product.

---

# 3. GOVERNING PRINCIPLES

DnD must follow these principles:

## 3.1 Record quickly

Logging a trade should be fast.

The trader should be able to create a basic trade in seconds and finish the deeper documentation later.

## 3.2 Review deeply

Every trade should have a place for:

- reasoning
- setup conditions
- evidence
- psychology
- execution quality
- rules
- outcome
- lessons

## 3.3 Understand performance

The system should turn raw trade history into useful, evidence-based patterns.

## 3.4 Protect sensitive data

Trading data, financial data, psychological data, notes and recordings are sensitive.

Security and privacy are product features, not afterthoughts.

## 3.5 Never overwhelm

The application should feel like a polished professional product, not a spreadsheet.

## 3.6 Never fabricate

Never fabricate:

- trades
- metrics
- analytics
- AI insights
- performance
- statistics
- upload state
- successful operations

---

# 4. IMPORTANT BUILDING AGENT RULES

These rules are mandatory.

1. Build in the defined phase order.
2. Do not silently expand scope.
3. Do not silently remove requirements.
4. If implementation requires a meaningful architectural deviation, explain it in the phase completion report.
5. Security requirements apply during every phase.
6. Financial calculations must be unit-tested before the related phase is considered complete.
7. Do not use frontend filtering as an authorization mechanism.
8. Do not trust client-calculated financial values.
9. Do not expose secrets to the client.
10. Do not mutate historical strategy versions.
11. Do not mutate original uploaded evidence when annotations are applied.
12. Do not silently overwrite conflicting offline/server changes.
13. Do not show NaN, Infinity, undefined or misleading zero values to users.
14. Do not create non-functional buttons.
15. Do not create fake loading states.
16. Do not create fake analytics.
17. Do not create fake AI functionality.
18. Do not block the main UI with heavy calculations.
19. Prefer maintainability over cleverness.
20. Prefer secure defaults.
21. Prefer explicitness over magic behavior.

---

# 5. IMPLEMENTATION STRATEGY

Build the application incrementally.

Each phase must result in a working application.

At the end of each phase:

- run type checking
- run linting
- run tests
- verify the relevant user flows
- verify security controls introduced in that phase
- verify responsive behavior
- summarize the implementation
- list anything intentionally deferred
- do not continue to the next phase until the phase is demonstrably stable

The coding agent must not repeatedly rebuild the architecture from scratch.

Establish strong foundations first.

---

# 6. TECHNOLOGY STACK

Use a modern production-oriented stack.

Use the latest stable versions available at implementation time unless there is a documented reason not to.

## Frontend

- Next.js
- App Router
- TypeScript with strict mode
- React
- Tailwind CSS
- shadcn/ui
- Radix primitives where appropriate
- Lucide icons
- Recharts for normal analytics
- D3 only for visualizations that genuinely need custom rendering
- Framer Motion only where subtle transitions improve UX

## State

Use:

- TanStack Query for server state, fetching, caching and synchronization
- Zustand for appropriate local UI state

Do not duplicate server state unnecessarily between multiple state systems.

## Backend

Use Next.js server-side capabilities, route handlers and server actions where appropriate.

Keep business logic in dedicated service/domain layers rather than embedding it directly in presentation components.

## Database

- PostgreSQL
- Supabase

Use:

- foreign keys
- indexes
- transactions
- RLS
- typed database access

## Authentication

Prefer Supabase Auth or another mature authentication provider.

Do not implement custom authentication unnecessarily.

## Storage

Use private object storage, preferably:

- Supabase Storage
- or another S3-compatible private storage provider

## Offline

Use:

- IndexedDB
- Dexie
- Service Worker/PWA capability where appropriate

## Validation

Use:

- Zod

for API and form schemas.

## Testing

Use:

- Vitest for unit/integration logic
- Playwright for end-to-end testing

## Error monitoring

Use a production monitoring system such as Sentry.

Do not expose monitoring credentials to the client unless explicitly designed as public client configuration.

---

# 7. FINANCIAL DATA MODELING

This is critical.

Do not store all financial values as integer cents.

Different types of financial values require different representations.

## Currency amounts

For fixed currency amounts, use integer minor units where appropriate.

Example:

USD 125.34

stored as:

12334 cents

## Prices

Use PostgreSQL `numeric` with an appropriate precision and scale.

Examples:

- entry price
- stop price
- target price
- exit price

## Quantities

Use exact decimal numeric representation.

Examples:

- lot size
- contracts
- shares
- position size

## Ratios

Use exact numeric representation.

Examples:

- risk percentage
- R multiple
- reward/risk
- win rate

Do not perform money-critical arithmetic using unsafe JavaScript floating-point operations.

Use deterministic decimal arithmetic.

All server-side financial calculations must be validated.

---

# 8. HIGH-LEVEL ARCHITECTURE

```text
                    PUBLIC WEBSITE
                          │
                          ▼
                 Next.js Application
                          │
          ┌───────────────┴────────────────┐
          │                                │
          ▼                                ▼
   Authenticated App                 Server Services
          │                                │
          │                       ┌────────┴────────┐
          │                       │                 │
          ▼                       ▼                 ▼
      Supabase                 Analytics        Media Jobs
   Postgres + RLS               Engine          / Processing
          │
          │
          ▼
     Private Storage
          │
          │
          ▼
      Signed URLs

Offline:
Next.js Client
      │
      ▼
IndexedDB / Dexie
      │
      ▼
Sync Engine
      │
      ▼
Conflict Resolution
```

---

# 9. INFORMATION ARCHITECTURE

## Public Website

- Landing
- Features
- Privacy
- Terms
- Cookies
- Sign In
- Sign Up
- Forgot Password
- Reset Password

## Application

### Dashboard

### Journal

- All Trades
- Add Trade
- Trade Detail

### Calendar

### Analytics

- Overview
- Performance
- Instruments
- Sessions
- Strategies
- Setups
- Behavior
- Risk
- Time

### Playbooks

- Strategies
- Strategy Detail
- Versions
- Rules
- Experiments

### Reviews

- Daily
- Weekly
- Monthly
- Action Items

### Media

- Images
- Videos

### Settings

- Profile
- Accounts
- Trading
- Timezone
- Tags
- Checklists
- Notifications
- Appearance
- Accessibility
- Privacy
- Security
- Data

---

# 10. DESIGN PHILOSOPHY

DnD must feel like:

**Professional trading software + modern SaaS + research notebook**

It must not feel like:

- a crypto casino
- a neon trading simulator
- a generic admin dashboard
- a spreadsheet clone
- an AI gimmick

Avoid:

- excessive gradients
- neon overload
- excessive glassmorphism
- excessive shadows
- giant decorative illustrations
- excessive rounded cards
- aggressive animations
- flashing profit/loss
- cluttered layouts

Professionalism should come from:

- spacing
- typography
- hierarchy
- precision
- consistency
- responsiveness
- information architecture
- interaction quality

---

# 11. DESIGN SYSTEM

Create three appearance presets.

These are themes of the same application, not separate designs.

---

## THEME A: NORDIC CLEAN

Default theme.

Background:

`#F8FAFC`

Surface:

`#FFFFFF`

Primary text:

`#1E293B`

Secondary text:

`#64748B`

Borders:

`#E2E8F0`

Profit:

`#34D399`

Loss:

`#FB7185`

Feel:

- clean
- quiet
- precise
- readable

---

## THEME B: SLEEK TERMINAL

Background:

`#0E1114`

Surface:

`#1A2026`

Secondary text:

`#A0AEC0`

Profit:

`#10B981`

Loss:

`#F43F5E`

Feel:

- dark
- technical
- focused
- data-oriented

Do not use pure black as the primary surface.

---

## THEME C: INSTITUTIONAL BLUE

Background:

`#0F172A`

Surface:

`#1E293B`

Secondary text:

`#94A3B8`

Profit:

`#06B6D4`

Loss:

`#EF4444`

Feel:

- institutional
- premium
- analytical

---

# 12. DESIGN RULES

Use:

- consistent spacing scale
- consistent typography scale
- consistent control heights
- consistent radius system
- semantic colors
- restrained borders
- restrained shadows

Do not let individual pages invent their own visual language.

Profit/loss must never rely only on color.

Pair color with:

- sign
- label
- icon
- text

No emoji anywhere in the UI.

Use Lucide or another professional icon set.

Do not use em dash characters anywhere in UI copy.

---

# 13. RESPONSIVE UX

Desktop:

Persistent sidebar.

Tablet:

Compact sidebar/drawer.

Mobile:

The application should feel designed for mobile, not merely compressed.

Use:

- bottom navigation
- mobile drawers
- touch-friendly targets
- compact headers
- responsive forms
- horizontally manageable data
- mobile-friendly media viewers
- mobile-friendly charts

Mobile primary navigation:

```text
Dashboard
Journal
Add
Calendar
More
```

Add Trade must be one tap away on mobile.

---

# 14. ACCESSIBILITY

Build accessibility from the start.

Requirements:

- semantic HTML
- keyboard navigation
- visible focus states
- proper labels
- accessible dialogs
- appropriate ARIA
- proper form descriptions
- sufficient contrast
- screen-reader-friendly status messages
- accessible tables
- keyboard-accessible menus
- reduced-motion support

Never use color alone to communicate critical information.

Respect:

`prefers-reduced-motion`

---

# 15. PUBLIC LANDING PAGE

The landing page must provide useful information before signup.

Do not immediately force registration.

---

## Hero

Primary message:

**Turn every trade into measurable progress.**

Supporting copy should communicate that DnD combines:

- trading journal
- strategy playbooks
- evidence
- psychology
- reviews
- analytics
- risk management

Primary CTA:

**Start journaling**

Secondary CTA:

**Explore DnD**

Use actual application screenshots/mock interface views.

Do not use generic finance stock photography as the primary visual identity.

---

# 16. LANDING PAGE SECTIONS

Include:

### Hero

### Problem

Explain why ordinary trading journals are insufficient.

### How DnD Works

```text
Plan
↓
Trade
↓
Document
↓
Review
↓
Improve
```

### Features

### Evidence-first journaling

### Strategy Playbooks

### Psychology and behavior

### Analytics

### Daily plan vs execution

### Privacy

### Offline capability

### Product screenshots

### FAQ

### Final CTA

---

# 17. LEGAL DOCUMENTS

Create:

- Terms of Service
- Privacy Policy
- Cookie Policy

The exact legal content must remain editable and should be written for later legal review.

The application should record:

- document type
- version
- acceptance timestamp
- user ID

Distinguish appropriately between:

- legally required terms acceptance
- privacy acknowledgement/notice
- optional analytics or marketing consent
- technically necessary cookies

Do not implement a misleading single "accept everything" mechanism.

---

# 18. AUTHENTICATION

Support:

- sign up
- sign in
- sign out
- password recovery
- session management
- protected routes
- session revocation where supported
- optional MFA where supported

Do not hand-roll password storage.

Use mature authentication infrastructure.

---

# 19. APPLICATION SHELL

Desktop navigation:

- Dashboard
- Journal
- Calendar
- Analytics
- Playbooks
- Reviews
- Media
- Settings

Include:

- active route state
- tooltips
- collapsible sidebar
- mobile navigation
- account menu
- theme control
- global search
- command palette

---

# 20. COMMAND PALETTE

Implement:

`Ctrl/Cmd + K`

Possible actions:

- Add Trade
- Search Trades
- Open Dashboard
- Open Calendar
- New Strategy
- Start Daily Review
- Start Weekly Review
- Export Data
- Open Settings

Do not intercept browser/system shortcuts unnecessarily.

---

# 21. DASHBOARD

The dashboard must answer:

**How am I performing?**

Provide date filters:

- Today
- This Week
- This Month
- This Quarter
- This Year
- Custom

Primary metrics:

- Net P&L
- Win Rate
- Average R
- Profit Factor
- Expectancy
- Trade Count
- Average Win
- Average Loss
- Max Drawdown
- Current Drawdown

Allow metric customization.

---

# 22. DASHBOARD VISUALS

Include:

### Equity Curve

Cumulative account performance.

### Daily P&L

Daily result overview.

### R Distribution

Distribution of trade outcomes.

### Instrument Performance

### Strategy Performance

### Session Performance

### A+ vs Non-A+

### Rule Compliance

### Psychology Effects

Charts must use actual data.

---

# 23. DASHBOARD INSIGHT ENGINE

Create:

**What is affecting your performance?**

Insights must be generated from actual user data.

Example:

> Your trades tagged "Entered Early" have historically produced lower average R than trades without that tag.

The system should allow the user to inspect the underlying trades.

Do not use causal language unless causal inference is actually justified.

Prefer:

- "associated with"
- "historically correlated with"
- "has produced"

instead of:

- "causes"
- "guarantees"

---

# 24. SAMPLE SIZE RULE

Do not create strong-looking insights from tiny datasets.

Default minimum bucket sample:

`N >= 10`

Make this configurable.

Show the sample size with relevant insights.

Example:

`Entered Early | 18 trades | Avg R: -0.41`

Do not tell users that an insight is statistically significant unless an actual appropriate statistical test has been performed.

---

# 25. JOURNAL

The Journal is the core workflow.

Support:

- create
- edit
- view
- duplicate
- archive
- delete
- restore where appropriate
- search
- filter
- sort
- bulk actions where safe

---

# 26. JOURNAL TABLE

Possible columns:

- Date
- Instrument
- Direction
- Strategy
- Setup Grade
- Session
- Entry
- Exit
- P&L
- R
- Rule Compliance
- Psychology
- Status

Allow column visibility customization.

---

# 27. QUICK ADD TRADE

The trader must be able to rapidly record:

- instrument
- direction
- entry
- stop
- target
- account

Then choose:

**Save and finish later**

Create autosaved drafts.

Never lose entered information because the user accidentally navigates away.

---

# 28. FULL TRADE ENTRY

Break the full form into logical stages.

Suggested:

```text
1. Basics
2. Execution
3. Trading Plan
4. ICT Setup
5. Risk
6. Psychology
7. Evidence
8. Review
```

Do not show dozens of fields simultaneously.

Use progressive disclosure.

Allow advanced sections to remain collapsed until needed.

---

# 29. TRADE BASICS

Fields:

- date
- entry time
- exit time
- timezone
- instrument
- market
- direction
- account
- session
- strategy
- strategy version
- setup
- tags
- status

Markets:

- Forex
- Gold
- Indices
- Futures
- Crypto
- Stocks
- Custom

---

# 30. EXECUTION DATA

Fields:

- entry price
- stop loss
- target
- exit price
- position size
- risk amount
- risk percentage
- fees
- commission
- swap
- slippage
- currency

---

# 31. SERVER-COMPUTED VALUES

Never trust client-provided calculated financial values.

Server-side calculations should validate and derive:

- risk amount
- stop distance
- target distance
- planned R:R
- gross P&L
- total costs
- net P&L
- actual R
- return percentage where meaningful

The client may display calculations optimistically, but the authoritative value comes from validated server-side logic.

---

# 32. POSITION AND P&L ENGINE

Support:

- long
- short
- Forex
- Gold
- indices
- futures
- stocks
- crypto
- custom instrument definitions

Support:

- fractional quantities
- multiple fills
- multiple exits
- commissions
- fees
- swap
- slippage
- currency conversion

Do not hardcode assumptions about pip/tick/contract specifications.

Use configurable instrument specifications.

---

# 33. EXECUTION LEDGER

A trade may contain:

- multiple entries
- multiple exits
- partial fills
- partial exits

Represent execution events separately.

Example:

```text
Entry 1
Entry 2
Exit 1
Exit 2
Exit 3
```

Trade-level performance should derive from underlying execution records.

Do not overwrite the execution history.

---

# 34. BREAK-EVEN AND RESULT STATES

Support:

- Win
- Loss
- Break-even
- Partial Win
- Partial Loss
- Open
- Cancelled

Do not force every outcome into a simplistic win/loss model.

---

# 35. R MULTIPLE

R represents performance relative to valid initial risk.

Examples:

`+2.4R`

`-1.0R`

`+0.5R`

`BE`

If valid initial risk cannot be established:

`R: N/A`

Never divide by zero.

Never show Infinity.

---

# 36. DAILY TRADING PLAN

Create a dedicated:

# Daily Plan

Fields:

- date
- overall bias
- weekly bias
- daily bias
- instruments
- PWH
- PWL
- PDH
- PDL
- HTF levels
- liquidity targets
- session
- setup conditions
- invalidation
- maximum trades
- maximum daily risk
- notes

The user can create a plan before trading.

---

# 37. PLAN VS EXECUTION

This is a signature DnD feature.

Compare what the trader planned against what happened.

Example:

### Planned

NY AM only  
Maximum 2 trades  
Wait for MSS  
Risk 0.5%

### Executed

London trade  
4 trades  
Entered before MSS  
Risked 1.1%

Generate a factual adherence summary.

Track:

- planned session vs actual
- planned risk vs actual
- planned number of trades vs actual
- required setup conditions vs actual
- planned instruments vs actual
- planned target vs actual

This becomes part of behavior analytics.

---

# 38. ICT SETUP DOCUMENTATION

DnD should strongly support ICT-style journaling while remaining methodology-flexible.

Do not make ICT hardcoded into the entire application.

Create configurable setup frameworks.

Potential categories:

## Higher Timeframe Context

- Weekly bias
- Daily bias
- 4H bias
- 1H context
- premium/discount
- dealing range
- HTF liquidity

## Liquidity

- PDH
- PDL
- PWH
- PWL
- equal highs
- equal lows
- buy-side liquidity
- sell-side liquidity
- internal liquidity
- external liquidity
- session liquidity

## Structure

- BOS
- MSS
- displacement
- protected high
- protected low
- structure shift

## Entry Model

- liquidity sweep
- displacement
- FVG
- Order Block
- Breaker
- Mitigation
- SMT
- retracement
- entry location

## Session

- Asia
- London
- New York AM
- New York PM
- Custom

---

# 39. CONFIGURABLE CHECKLIST SYSTEM

Users can create reusable checklists.

Each checklist supports:

- name
- description
- sections
- items
- required status
- optional status
- weights
- scoring
- grading thresholds
- evidence requirement
- version

Example:

```text
A+ Setup

HTF aligned
Liquidity taken
Displacement confirmed
MSS confirmed
FVG present
Entry inside defined zone
Risk compliant
Valid session
```

---

# 40. CHECKLIST VERSIONING

Checklist definitions must be versioned.

Historical trade evaluations must remain associated with the exact checklist version used.

Do not silently change old trade grades when the checklist changes.

Provide optional explicit action:

**Re-evaluate using current checklist**

If performed, save it as a new evaluation rather than overwriting the historical evaluation.

---

# 41. SETUP GRADE

Allow grades such as:

- A+
- A
- B
- C
- Invalid

But allow users to customize grading systems.

Store:

- raw answers
- checklist version
- weighted score
- final grade
- evaluation timestamp

---

# 42. TRADE THESIS

Every trade should allow structured reasoning.

Fields:

- Why am I taking this trade?
- What is the market narrative?
- What liquidity am I targeting?
- What confirms the setup?
- What invalidates it?
- Where is the target?
- What would make me exit early?

Support free-form notes as well.

---

# 43. EVIDENCE SYSTEM

Evidence is a first-class part of the trade.

Each trade supports chronological stages:

```text
Before Entry
↓
Setup
↓
Entry
↓
During Trade
↓
Exit
↓
Post Trade / Review
```

---

# 44. SCREENSHOT EVIDENCE

Support:

- drag and drop
- file picker
- multiple selection
- Ctrl/Cmd + V clipboard paste
- mobile gallery/camera
- image preview
- image reordering
- stage assignment
- captions
- tags
- timestamps
- annotations
- delete
- download
- export

Uploads must provide clear status.

---

# 45. IMAGE VIEWER

Support:

- zoom
- pan
- fullscreen
- fit-to-screen
- next/previous
- thumbnail strip
- stage navigation
- compare
- annotation mode

---

# 46. NON-DESTRUCTIVE ANNOTATION

Annotations must be stored separately from the original media.

Support:

- lines
- arrows
- rectangles
- circles
- text
- labels
- price levels
- thickness
- undo
- redo
- hide/show
- delete

The original image must never be modified simply because the user added an annotation.

Allow optional flattened export.

Use a canvas system such as Konva or another suitable layer-based implementation.

---

# 47. VIDEO EVIDENCE

Support:

- trade execution recordings
- chart replay
- screen recordings
- journaling reviews
- strategy demonstrations
- research evidence

Videos can be attached to:

- trades
- strategies
- strategy versions
- reviews

---

# 48. VIDEO UPLOAD STATES

Display:

```text
Selecting
↓
Uploading
↓
Processing
↓
Ready
```

Failure:

```text
Upload failed
[Retry]
```

Show accurate progress.

Do not make the user wonder whether a 500 MB upload is frozen.

Use resumable uploads where infrastructure supports them.

---

# 49. VIDEO STORAGE

Use private object storage.

Do not require:

- YouTube
- Vimeo
- public cloud links

Use controlled access such as short-lived signed URLs.

Validate:

- MIME type
- extension
- file signature when practical
- file size
- ownership
- storage quota

Generate thumbnails where practical.

---

# 50. MEDIA LIBRARY

Dedicated Media section.

Views:

- Grid
- List

Filters:

- image
- video
- trade
- strategy
- review
- tag
- date

Support search.

Do not design this as a generic file manager.

It should feel contextual to trading.

---

# 51. PSYCHOLOGY SYSTEM

Capture psychology before and after execution.

## Before

- calm
- confident
- hesitant
- fearful
- FOMO
- impatient
- distracted
- excited
- tired
- focused

## After

- satisfied
- frustrated
- regret
- relief
- overconfident
- disappointed
- calm
- confused
- angry

Also allow:

- confidence 1 to 5
- energy/focus
- emotional impact on execution
- custom tags

---

# 52. BEHAVIOR FLAGS

Support explicit behavioral flags:

- entered early
- broke rules
- moved stop
- moved target
- exited early
- revenge trade
- overtraded
- increased size
- chased price
- ignored plan

These should be analytics dimensions.

---

# 53. BEHAVIOR ANALYTICS

Analyze actual historical outcomes.

Examples:

- Entered Early vs Avg R
- Broke Rules vs Avg R
- FOMO vs Avg R
- Revenge Trade vs Avg R
- Planned vs Actual trade count
- Psychology state vs rule adherence

Do not claim causation.

Show sample size.

Allow opening the underlying trades.

---

# 54. TRADE DETAIL PAGE

This is the most important detailed page in the product.

It should contain:

## Header

- instrument
- direction
- date
- session
- strategy
- result
- P&L
- R

## Plan

- market bias
- setup thesis
- risk
- target

## Setup

- HTF context
- liquidity
- structure
- entry model
- checklist
- score
- grade

## Execution

- fills
- entry
- exits
- stop
- targets
- fees
- slippage

## Plan vs Actual

## Psychology

## Evidence Timeline

## Review

## Lessons

## Audit History

---

# 55. EVIDENCE TIMELINE

The Trade Detail page should present evidence in chronological context.

Example:

```text
09:10
Before Entry
Chart screenshot

09:18
Setup
Liquidity sweep screenshot

09:24
Entry
Entry screenshot

09:31
During Trade
Chart recording

09:47
Exit
Exit screenshot

10:15
Review
Post-trade notes
```

This should make the trade understandable as a story, not just a row in a table.

---

# 56. STRATEGY PLAYBOOKS

DnD should treat strategies like version-controlled engineering artifacts.

Think:

**Git for trading strategies**

A strategy contains:

- name
- description
- purpose
- instruments
- market
- timeframe
- session
- conditions
- required conditions
- optional conditions
- risk rules
- entry rules
- stop rules
- target rules
- management rules
- invalidation rules
- examples
- notes

---

# 57. STRATEGY VERSIONING

Every meaningful change creates a new strategy version.

Example:

```text
London Sweep
V1.0
V1.1
V1.2
V2.0
```

Each version preserves:

- rules
- checklist
- notes
- effective date
- change reason
- author
- status

A trade must preserve the exact strategy version used when the trade occurred.

Historical strategy data must not silently mutate.

---

# 58. STRATEGY CHANGE LOG

Each version may record:

- what changed
- why it changed
- expected impact
- evidence motivating the change
- effective date
- supporting review
- associated media

---

# 59. STRATEGY PERFORMANCE

For every strategy and strategy version calculate:

- trades
- P&L
- win rate
- average R
- expectancy
- profit factor
- max drawdown
- best trade
- worst trade
- average hold time
- rule adherence
- session performance
- instrument performance
- setup performance
- psychology patterns

---

# 60. STRATEGY LAB

Create a research-oriented area for comparing strategy versions.

Example:

| Metric | V1.0 | V1.1 |
|---|---:|---:|
| Trades | 84 | 73 |
| Win Rate | 53% | 59% |
| Avg R | 0.42 | 0.68 |
| Profit Factor | 1.42 | 1.71 |
| Max DD | 8.1R | 5.4R |

Always show sample sizes.

Warn when samples are too small to support strong conclusions.

---

# 61. STRATEGY EXPERIMENTS

Allow users to record controlled strategy changes.

Example:

```text
Experiment:
Reduce risk from 0.5% to 0.25%

Hypothesis:
Lower drawdown without materially damaging expectancy.

Version:
2.1

Start date:
...

Results:
...
```

The system must observe and record results.

It must not present experiments as guaranteed improvements.

---

# 62. CALENDAR

Create an interactive trading calendar.

Each day should show:

- P&L
- R
- trade count
- wins
- losses
- A+ count

Hover provides:

- trades
- result
- win rate
- best trade
- worst trade
- A+ count

Clicking opens daily details.

---

# 63. DAILY VIEW

For a selected day show:

- daily plan
- executed trades
- plan vs execution
- P&L
- R
- psychology
- media
- notes
- daily review

---

# 64. DAILY REVIEW

Fields:

- market conditions
- plan followed?
- best trade
- worst trade
- biggest mistake
- emotional state
- biggest lesson
- next-session focus
- action items

Automatically link relevant trades.

---

# 65. WEEKLY REVIEW

Automatically calculate:

- P&L
- R
- win rate
- expectancy
- profit factor
- drawdown
- best trade
- worst trade
- best strategy
- worst strategy
- best instrument
- worst instrument
- best session
- worst session
- rule violations
- psychology patterns
- plan adherence

Then allow free-form reflection.

---

# 66. MONTHLY REVIEW

Include:

- monthly performance
- drawdown
- recovery
- strategy performance
- behavior
- psychology
- rule adherence
- best setups
- weakest setups
- biggest lessons
- next-month goals

---

# 67. ACTION ITEMS

Reviews should be able to create action items.

Example:

> Wait for MSS confirmation before entry.

Fields:

- title
- description
- due date
- status
- linked strategy
- linked checklist
- linked review

This turns reviewing into behavioral improvement.

---

# 68. ANALYTICS ENGINE

The analytics architecture should look like:

```text
Raw Trades
    ↓
Validation
    ↓
Analytics Engine
    ↓
Derived Metrics
    ↓
Cached Results
    ↓
Dashboard / Analytics
```

---

# 69. ANALYTICS DIMENSIONS

Support analysis by:

- date
- instrument
- market
- account
- strategy
- strategy version
- setup
- setup grade
- session
- direction
- day of week
- hour
- psychology tag
- behavioral flag
- rule compliance
- daily-plan adherence
- risk category

---

# 70. PERFORMANCE ANALYTICS

Calculate:

- total trades
- total P&L
- average P&L
- win rate
- average win
- average loss
- average R
- expectancy
- profit factor
- max drawdown
- current drawdown
- largest win
- largest loss
- consecutive wins
- consecutive losses
- recovery period
- average holding time

---

# 71. DRAWDOWN ENGINE

Calculate drawdown from the equity curve.

Support:

- current drawdown
- maximum drawdown
- drawdown duration
- recovery duration
- equity peak
- recovery percentage

Do not define drawdown as merely "negative P&L".

---

# 72. PROFIT FACTOR

Use:

```text
Gross Profits / Absolute Gross Losses
```

When there are no losing trades:

do not show Infinity.

Show:

**N/A**

and optionally:

**No losing trades in selected period**

---

# 73. EXPECTANCY

Provide expectancy in R where valid.

Example conceptual model:

```text
Expectancy = average realized R per trade
```

Do not calculate when the necessary underlying values are invalid.

---

# 74. A+ VS NON-A+

The dashboard should maintain a standing comparison:

- A+ setups
- Non-A+ setups

Compare:

- sample size
- win rate
- average R
- expectancy
- P&L
- drawdown

This should be one of the core performance questions in DnD.

---

# 75. PERFORMANCE BY SESSION

Support:

- Asia
- London
- New York AM
- New York PM
- custom

Show:

- trade count
- win rate
- average R
- expectancy
- P&L

---

# 76. PERFORMANCE BY INSTRUMENT

Example:

```text
XAUUSD
NQ
ES
EURUSD
```

Show:

- trades
- P&L
- average R
- expectancy
- win rate
- drawdown

---

# 77. PERFORMANCE BY TIME

Analyze:

- weekday
- hour
- session
- month
- quarter
- year

Be careful with timezone normalization.

---

# 78. RISK ANALYTICS

Track:

- average risk %
- risk variance
- oversized trades
- undersized trades
- daily risk breaches
- maximum daily risk
- risk during drawdown
- risk after winning streaks
- risk after losing streaks

---

# 79. RISK MANAGEMENT ENGINE

Inputs:

- account
- balance
- risk %
- risk amount
- entry
- stop
- instrument

Outputs:

- position size
- risk amount
- stop distance
- target distance
- planned R:R
- estimated loss
- estimated reward

Support:

- Forex
- Gold
- Indices
- Futures
- Stocks
- Custom

Do not hardcode universal assumptions for instrument specifications.

---

# 80. ACCOUNT RULES

Allow user-defined rules:

- maximum risk per trade
- maximum daily loss
- maximum trades/day
- maximum total exposure

Each rule can be:

- warning
- blocking

Blocking rules must be enforced server-side when applicable.

Client UI should provide immediate feedback but cannot be the only enforcement layer.

---

# 81. GOALS

Allow behavior-oriented and performance-oriented goals.

Examples:

- journal every trade
- maximum two trades/day
- risk below configured level
- complete daily review
- complete weekly review
- maintain checklist adherence

Prefer process goals over unrealistic profit guarantees.

---

# 82. SEARCH

Global search should cover:

- trades
- strategies
- strategy versions
- reviews
- notes
- tags
- media

Examples:

```text
XAUUSD
A+
FVG
Entered Early
London
```

Search should return contextual results.

---

# 83. TAGGING SYSTEM

Tags are reusable user-owned entities.

Support:

- create
- rename
- archive
- merge where safe
- assign
- remove
- search
- filtering

Do not rely on dozens of colors as the primary semantic mechanism.

---

# 84. DATA IMPORT

Import must always follow:

```text
Upload
↓
Detect
↓
Map
↓
Preview
↓
Validate
↓
Detect duplicates
↓
Confirm
↓
Import
↓
Summary
```

Never perform a blind database insert.

---

# 85. CSV IMPORT

Allow field mapping.

Example:

```text
Broker:
Open Time

DnD:
entry_time
```

Allow reusable mapping templates.

---

# 86. IMPORT VALIDATION

Detect:

- invalid dates
- invalid timestamps
- invalid prices
- missing required fields
- invalid currencies
- unsupported values
- duplicate records
- malformed CSV
- inconsistent rows

Show exact row-level issues.

Do not expose raw database errors.

---

# 87. DUPLICATE DETECTION

Use available identifiers and combinations such as:

- broker trade ID
- timestamp
- account
- instrument
- direction
- entry
- exit

Do not automatically delete anything.

Show possible duplicates and allow the user to decide.

---

# 88. EXPORT

Support:

- CSV
- JSON

Export structured data such as:

- trades
- executions
- accounts
- strategies
- strategy versions
- checklists
- reviews
- goals
- tags
- metadata

Provide media manifests separately.

Allow direct media downloads where appropriate.

---

# 89. BACKUP

Backup should include:

- structured data
- strategy data
- reviews
- settings where appropriate
- metadata
- media manifest

Show:

- timestamp
- record counts
- approximate size
- backup status

---

# 90. RESTORE

Restore process:

```text
Upload Backup
↓
Validate
↓
Preview
↓
Conflict Check
↓
Select Merge / Replace behavior
↓
Confirm
↓
Restore
↓
Summary
```

Never silently overwrite current user data.

---

# 91. OFFLINE MODE

DnD should remain useful without a connection.

Support:

- viewing cached journal data
- creating trade drafts
- editing drafts
- adding notes
- working on reviews
- annotation where feasible
- queued synchronization

Use IndexedDB with Dexie.

---

# 92. OFFLINE SYNC

When connectivity returns:

```text
Local Changes
↓
Sync Queue
↓
Server Validation
↓
Apply
↓
Conflict Check
↓
Success
```

Never silently lose local work.

---

# 93. SYNC CONFLICT RESOLUTION

When local and server versions conflict, show:

- local version
- remote version
- timestamps
- fields changed

Options:

- Keep mine
- Keep server
- Compare
- Merge

Never silently choose one.

---

# 94. LOCAL PRIVACY MODE

Create:

# Privacy Mode

The system may encrypt selected sensitive fields client-side before persistence using:

- Web Crypto API
- AES-GCM
- key derivation such as PBKDF2 or another appropriate secure derivation strategy

Potential protected fields:

- private journal notes
- psychology notes
- strategy notes
- private review notes

The architecture must clearly distinguish between:

- encrypted application data
- non-sensitive metadata
- required server-side data

Do not claim:

"Even DnD cannot access your data"

unless the architecture truly guarantees this.

---

# 95. PRIVACY MODE UX

Clearly explain:

- what gets encrypted
- what remains available server-side
- whether encrypted data can be synchronized
- what happens if the passphrase is lost
- whether recovery is possible
- what metadata is still processed

Never make security promises the implementation does not satisfy.

---

# 96. NOTIFICATIONS

Notification categories:

### Trading

- session reminder
- daily plan reminder
- daily loss limit reached

### Journal

- incomplete trade
- end-of-day journal reminder
- weekly review reminder

### System

- import completed
- import failed
- upload completed
- upload failed
- backup complete
- sync conflict

Allow:

- category preferences
- enable/disable
- preferred time
- timezone
- quiet hours
- channel

Do not spam users.

---

# 97. TIMEZONE

Support separate concepts where required:

- user timezone
- display timezone
- trading timezone
- account timezone

Handle:

- DST
- overnight trades
- midnight crossings
- session boundaries

Store timestamps in UTC where appropriate and preserve the relevant trading timezone context.

---

# 98. DATABASE MODEL

Create a normalized PostgreSQL schema.

Suggested core entities:

```text
profiles
trading_accounts
instruments

trades
trade_executions
trade_targets

strategies
strategy_versions
strategy_rules
strategy_experiments

checklist_configs
checklist_versions
checklist_items
trade_checklist_evaluations

trade_media
media_annotations

psychology_logs
trade_tags
tags

daily_plans
reviews
review_trade_links
action_items
goals

notifications
notification_preferences

imports
import_rows

backups

audit_events

analytics_cache

user_settings
sync_records
device_sessions
```

Adjust table names and relationships when necessary, but preserve the domain integrity.

---

# 99. DATABASE PRINCIPLES

Use UUIDs.

Use foreign keys.

Use appropriate constraints.

Use indexes strategically.

Likely indexes include:

- user_id
- trade timestamp
- account_id
- instrument_id
- strategy_id
- strategy_version_id
- session
- status

Every user-owned table must have appropriate user ownership enforcement.

---

# 100. ROW LEVEL SECURITY

RLS must be enabled on every user-owned table.

Example conceptual policy:

```sql
using (auth.uid() = user_id)
with check (auth.uid() = user_id)
```

But implement policies appropriate to the exact relational structure.

For child tables whose ownership is inherited through a parent, enforce secure relational ownership checks.

Never rely on client-side filtering.

---

# 101. AUTHORIZATION

Every protected operation must perform authorization.

Being authenticated is not enough.

The system must verify ownership of:

- trade
- account
- strategy
- strategy version
- media
- reviews
- backups
- settings
- imports
- checklist data

A user must never access another user's objects by manually changing an ID in the request.

---

# 102. MASS ASSIGNMENT PROTECTION

Every mutation must use an explicit allowlist/schema.

Do not blindly spread client objects into database updates.

Reject or ignore unauthorized fields such as:

```text
is_admin
user_id
owner_id
system_status
billing_status
```

where the user should not control them.

---

# 103. SECRETS

Never expose:

- service-role keys
- private storage credentials
- database passwords
- signing secrets
- server-only API keys

Never commit secrets.

Provide:

`.env.example`

with placeholders only.

Check Git history before production release.

---

# 104. FILE SECURITY

Every upload must validate:

- ownership
- file size
- MIME type
- extension
- file signature where practical
- storage quota

Do not trust the filename.

Do not serve arbitrary uploaded HTML as active content.

Use private storage.

Use short-lived signed URLs.

---

# 105. SECURITY HEADERS

Configure appropriate production security headers, including where applicable:

- Content-Security-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- frame protection through CSP/frame-ancestors or equivalent
- Referrer-Policy
- Permissions-Policy

Do not blindly copy a generic CSP.

Tune it to the actual application.

---

# 106. RATE LIMITING

Rate limit sensitive and expensive operations:

- sign in
- sign up
- password reset
- media upload
- import
- export
- expensive analytics
- notification endpoints
- future AI endpoints

---

# 107. ERROR HANDLING

Never expose internal errors.

Bad:

```text
Postgres error 23505
```

Good:

```text
This trade could not be saved.
Try again.
```

Technical details belong in secure logs.

Provide an error identifier when useful.

---

# 108. LOADING ARCHITECTURE

Use appropriate loading behavior:

- skeletons
- progressive rendering
- upload progress
- import progress
- processing states
- optimistic UI where safe
- background jobs

Never display a meaningless spinner for a long-running operation without context.

---

# 109. EMPTY STATES

Do not show meaningless zeros.

For zero trades:

Instead of:

```text
Win rate: 0%
```

show:

```text
Your performance history starts here.

Log your first trade to begin building your journal.
```

Use contextual empty states throughout:

- dashboard
- analytics
- calendar
- media
- strategies
- reviews

---

# 110. EDGE CASES

Explicitly handle:

- zero trades
- one trade
- all wins
- all losses
- no losses
- no wins
- zero profit
- zero loss
- missing stop
- missing target
- missing exit
- partial fills
- partial exits
- break-even
- fees
- negative fees where valid
- currency mismatch
- unsupported currency
- missing historical prices
- duplicate imports
- invalid dates
- invalid timestamps
- DST transition
- overnight trade
- weekend trade
- large datasets
- failed uploads
- interrupted uploads
- storage limits
- offline changes
- sync conflicts
- deleted strategy
- archived strategy
- deleted media

Never display:

- NaN
- Infinity
- undefined
- misleading zero

Use:

**N/A**

when a metric cannot legitimately be calculated.

---

# 111. AUDIT TRAIL

Track meaningful mutations:

- trade created
- trade edited
- trade deleted
- strategy created
- strategy version created
- strategy rule changed
- checklist version created
- review changed
- import performed
- export performed
- backup performed
- restore performed
- important settings changed

Audit event should contain:

- actor
- timestamp
- entity
- action
- useful before/after diff where appropriate

Do not record pointless UI noise.

---

# 112. CONCURRENCY

Support multiple tabs/devices.

Use optimistic concurrency/version checks where appropriate.

Detect stale modifications.

Do not silently discard a newer server state.

---

# 113. PERFORMANCE

Design for:

- 1,000+ trades
- potentially tens of thousands of trades
- large media libraries
- large imports

Use:

- pagination
- virtualization
- server-side filtering
- indexed queries
- cached analytics
- lazy loading
- background workers
- efficient media previews

Do not load every trade into the browser unnecessarily.

---

# 114. ANALYTICS CACHING

Cache expensive derived calculations.

Start with straightforward calculations.

As the dataset grows:

```text
New Trade
    ↓
Affected Analytics Buckets
    ↓
Invalidate
    ↓
Recompute
    ↓
Cache
```

Do not recalculate the entire historical dataset for every small mutation once scale makes that inefficient.

---

# 115. BACKGROUND COMPUTATION

Use Web Workers or appropriate background infrastructure for:

- large CSV parsing
- heavy analytics
- Monte Carlo simulations
- complex pattern calculations

The main UI thread should remain responsive.

---

# 116. MONTE CARLO FOUNDATION

Architect for future Monte Carlo analysis.

Possible future capabilities:

- randomized trade sequence
- equity path simulations
- drawdown distributions
- risk of ruin analysis
- probability ranges

Do not block initial development on this.

Never present complex statistical output without explaining it.

---

# 117. COMPONENT SYSTEM

Create reusable components such as:

```text
AppShell
Sidebar
MobileNav
PageHeader
MetricCard
DataTable
FilterBar
DateRangePicker
TagSelector
TradeForm
TradeTimeline
SetupChecklist
SetupGrade
PsychologySelector
PnLDisplay
RDisplay
ChartCard
Calendar
MediaGallery
ImageViewer
VideoViewer
AnnotationCanvas
UploadManager
ImportWizard
BackupWizard
ConflictResolver
EmptyState
LoadingSkeleton
ErrorState
ConfirmDialog
CommandPalette
Toast
Tooltip
```

Do not create massive monolithic components.

---

# 118. DOMAIN LAYER

Business logic should not live primarily inside UI components.

Create dedicated modules for:

- calculations
- validation
- analytics
- authorization
- imports
- strategy versioning
- sync
- media
- risk
- formatting

The frontend should consume reliable domain services.

---

# 119. FINANCIAL CALCULATION TESTS

At minimum test:

- long winning trade
- short winning trade
- long losing trade
- short losing trade
- exact break-even
- partial exit
- multiple entries
- multiple exits
- commissions
- fees
- swap
- slippage
- missing stop
- zero risk
- invalid risk
- currency conversion
- price precision
- fractional position sizes

No calculation should produce NaN or Infinity.

---

# 120. SECURITY TESTS

Test cross-user access.

For example:

User A attempts to retrieve:

- User B trade
- User B strategy
- User B media
- User B review
- User B account
- User B backup

All must be denied.

Test both:

- application authorization
- database RLS

---

# 121. END-TO-END TESTS

At minimum:

```text
Sign up
↓
Create account
↓
Create strategy
↓
Create strategy version
↓
Create checklist
↓
Create trade
↓
Add ICT setup
↓
Add psychology
↓
Upload screenshot
↓
Annotate screenshot
↓
Complete review
↓
Open dashboard
↓
Open calendar
↓
Open analytics
↓
Export data
```

Also test:

- sign in
- sign out
- invalid auth
- failed upload
- import
- duplicate detection
- offline draft
- sync
- conflict resolution

---

# 122. MOBILE TESTING

Test:

- small mobile
- standard mobile
- tablet
- laptop
- desktop
- large desktop

Pay particular attention to:

- trade entry
- bottom nav
- media viewer
- charts
- tables
- drawers
- dialogs
- annotation
- import flow

---

# 123. DEMO DATA

Create realistic development seed data.

Seed data must be clearly identified as demo/development data.

Never automatically contaminate production accounts with fake trades.

Provide a safe reset/seed mechanism.

---

# 124. DEMO MODE

Optionally provide a read-only product demo.

The demo can showcase:

- dashboard
- journal
- trade detail
- strategy
- calendar
- analytics
- reviews

Demo data must be isolated from real users.

---

# 125. SETTINGS

Create a polished settings system.

## Profile

- name
- email
- avatar

## Accounts

- trading accounts
- balances
- broker
- currency

## Trading

- default risk
- default account
- default session
- default instrument
- preferences

## Timezone

## Tags

## Checklists

## Playbooks

## Notifications

## Appearance

## Accessibility

## Privacy

## Security

## Data

---

# 126. DATA SETTINGS

Provide:

- export CSV
- export JSON
- import CSV
- backup
- restore
- media export
- deletion controls

Destructive actions require confirmation.

---

# 127. ACCOUNT SETTINGS

Account objects should support:

- name
- broker
- account type
- account currency
- starting balance
- current balance where applicable
- demo/live flag
- default account

Do not assume all accounts use the same currency.

---

# 128. TRADING SETTINGS

Allow configuration of:

- default risk
- default session
- default checklist
- default strategy
- daily trade limit
- daily loss limit
- preferred instruments

Avoid silently altering trade records because defaults changed.

Defaults only affect future flows.

---

# 129. NOTIFICATION SETTINGS

Provide fine-grained controls.

Example:

```text
Journal reminders     ON
Weekly review         ON
Upload completion     OFF
Sync conflict         ON
Trading reminders     ON
```

Allow quiet hours.

---

# 130. ACCESSIBILITY SETTINGS

Provide optional:

- reduced motion
- compact density
- larger text
- keyboard shortcut visibility

Respect browser/system preferences.

---

# 131. UI MICROCOPY

Use concise professional language.

Prefer:

**Trade saved.**

instead of:

**Amazing! Your awesome trade has been saved!**

Prefer:

**No trades match the current filters.**

instead of:

**Oops! We couldn't find anything!**

Prefer:

**Your trade could not be saved. Try again.**

Do not use hype-driven financial language.

---

# 132. NO EMOJI

There must be no emoji in the product UI.

Use professional icons.

Use Lucide consistently.

---

# 133. NO EM DASH

Do not use em dash characters in product interface copy.

Use standard punctuation instead.

---

# 134. NO EMPTY CHARTS

For empty datasets:

Do not render meaningless:

- axes
- zeros
- flat equity lines

Show a useful empty state with an appropriate action.

---

# 135. NO FAKE AI

DnD must function fully without AI.

AI may later provide:

- trade summaries
- review summaries
- journal search
- pattern exploration
- natural language questions

But AI must never replace deterministic financial calculations.

If AI is unavailable:

do not simulate AI.

---

# 136. FUTURE AI SECURITY

If AI is later introduced:

- API keys remain server-side
- prompt inputs are validated
- user data access is scoped
- prompt injection is considered
- model output cannot directly mutate trades
- model output cannot change permissions
- model output cannot change security settings
- usage is rate-limited
- expensive operations are capped

Clearly label AI-generated observations.

---

# 137. ANALYTICS LANGUAGE

Use precise language.

Good:

> Trades tagged "FOMO" have an average realized R of -0.48 across 23 trades.

Bad:

> FOMO causes traders to lose money.

Good:

> Your NY AM setups have historically produced higher average R than London setups.

Bad:

> NY AM is the best session.

---

# 138. STATISTICAL HONESTY

Always show:

- sample size
- period
- filters

where relevant.

Never present four trades as proof of a strategy.

Warnings should appear when:

- sample size is low
- missing data affects results
- currency conversion is incomplete
- historical records are incomplete

---

# 139. REVIEW DIFFERENCE SYSTEM

Reviews should compare:

### What happened

with:

### What was planned

and:

### What should change

This three-part structure should be present throughout daily/weekly/monthly review workflows.

---

# 140. PRODUCT FEEL

When a user opens DnD after a trading session:

They should feel:

**"This is my trading command center."**

not:

**"This is a form I have to fill in."**

The UX should guide the trader naturally from:

recording → evidence → review → insight.

---

# 141. MAIN PRODUCT LOOP

The application should make this loop frictionless:

```text
Prepare
  ↓
Trade
  ↓
Quick Capture
  ↓
Evidence
  ↓
Detailed Journal
  ↓
Review
  ↓
Analytics
  ↓
Behavior Insight
  ↓
Strategy Improvement
  ↓
Next Trading Plan
```

---

# 142. PHASED BUILD PLAN

## PHASE 0: FOUNDATION

Build:

- repository
- project scaffold
- environment configuration
- strict TypeScript
- linting
- formatting
- testing foundation
- Next.js architecture
- Supabase setup
- database migrations
- RLS foundation
- authentication
- basic application shell
- design tokens

Done when:

A new user can sign up, sign in, sign out and reach a protected dashboard.

---

# 143. PHASE 1: PUBLIC WEBSITE + APP SHELL

Build:

- landing page
- features
- legal pages
- consent
- responsive app shell
- desktop sidebar
- mobile bottom nav
- themes
- settings shell
- profile
- accounts
- timezone
- command palette
- empty-state system

Done when:

The entire application can be navigated coherently and the public site feels production-ready.

---

# 144. PHASE 2: CORE JOURNAL

Build:

- accounts
- instruments
- trade creation
- quick add
- trade drafts
- trade detail
- trade history
- filters
- sorting
- financial calculation engine
- execution ledger
- psychology
- notes
- tags

Done when:

A real trade can be recorded from start to finish.

---

# 145. PHASE 3: ICT SETUPS + EVIDENCE

Build:

- daily plan
- ICT setup structure
- configurable checklists
- checklist versioning
- setup scoring
- setup grade
- thesis
- screenshot uploads
- media stages
- image viewer
- annotations
- trade evidence timeline
- plan vs execution

Done when:

A trader can fully document a real setup and compare the plan to the actual execution.

---

# 146. PHASE 4: PERFORMANCE

Build:

- dashboard
- equity curve
- daily P&L
- R distribution
- calendar
- performance analytics
- instrument analytics
- session analytics
- setup analytics
- behavior analytics
- risk analytics
- A+ vs non-A+
- sample-size-aware insights

Done when:

The application can answer meaningful questions about trading performance using real seeded data.

---

# 147. PHASE 5: REVIEW SYSTEM

Build:

- daily review
- weekly review
- monthly review
- action items
- linked trades
- review media
- lessons
- plan-vs-execution summaries

Done when:

A trader can complete a repeatable review workflow.

---

# 148. PHASE 6: STRATEGY PLAYBOOKS

Build:

- strategy creation
- strategy rules
- strategy versions
- change log
- trade relationships
- strategy analytics
- version comparison
- experiments

Done when:

A strategy edit creates a new version and historical trades remain tied to the correct version.

---

# 149. PHASE 7: DATA PORTABILITY

Build:

- CSV import
- import mapping
- validation
- duplicate detection
- import progress
- CSV export
- JSON export
- backup
- restore

Done when:

A user can safely move their data in and out of DnD without silent corruption.

---

# 150. PHASE 8: PRIVACY + OFFLINE

Build:

- IndexedDB
- Dexie
- offline drafting
- offline journal access
- synchronization
- conflict detection
- conflict resolution
- Local Privacy Mode
- client-side encryption where supported

Done when:

A user can create a trade offline, reconnect, synchronize, and correctly handle a forced conflict.

---

# 151. PHASE 9: VIDEO + ADVANCED MEDIA

Build:

- video uploads
- resumable upload where practical
- upload progress
- video processing
- thumbnail generation
- playback
- private signed access
- media metadata
- video search/filter

Done when:

A large video can upload with visible, accurate progress and be privately replayed from the appropriate trade/strategy/review.

---

# 152. PHASE 10: ADVANCED INFRASTRUCTURE + HARDENING

Build:

- notification infrastructure
- audit trail
- error monitoring
- security hardening
- dependency scans
- production logging
- performance optimization
- accessibility audit
- large dataset optimization
- concurrency checks
- backup/restore verification

Done when:

The application passes the production readiness review below.

---

# 153. PRODUCTION SECURITY REVIEW

Before declaring DnD complete, verify:

## Authentication

- protected routes
- secure session handling
- session revocation
- rate limiting
- password reset security

## Authorization

- ownership checks
- RLS
- server-side authorization
- child-object ownership verification

## Secrets

- no exposed private keys
- no secrets in frontend
- no secrets in repository
- no secrets in logs

## Files

- private buckets
- signed URLs
- upload validation
- size limits
- MIME validation
- file signature checking where practical

## Input

- server-side validation
- sanitization
- explicit allowlists

## API

- authorization
- rate limiting
- minimal responses
- safe errors

## Infrastructure

- HTTPS
- security headers
- dependency scans
- debug disabled
- production configuration

## Backups

- working backup
- tested restore path

---

# 154. PERFORMANCE REVIEW

Verify:

- first load
- dashboard rendering
- large trade table
- analytics filtering
- calendar navigation
- image loading
- video startup
- import processing
- export processing
- offline synchronization

Test with:

- 100 trades
- 1,000 trades
- 10,000 trades where practical

---

# 155. UX REVIEW

Verify:

- user understands current location
- primary action is obvious
- forms are not overwhelming
- trade creation is fast
- mobile navigation is natural
- error recovery is clear
- empty states are useful
- loading states communicate progress
- destructive actions require confirmation
- analytics are understandable
- strategy versioning is understandable
- privacy mode is understandable

---

# 156. DATA INTEGRITY REVIEW

Verify:

- no orphan records
- no duplicate unintended records
- no cross-user records
- no invalid financial calculations
- no broken trade/media relationships
- no broken strategy references
- no silent overwrite
- no NaN
- no Infinity
- no corrupted imports

---

# 157. TEST COVERAGE REQUIREMENTS

At minimum:

## Unit tests

- P&L
- R
- expectancy
- profit factor
- drawdown
- position sizing
- RR
- currency conversion
- partial exits
- risk rules
- checklist scoring

## Integration tests

- trade creation
- trade editing
- strategy versioning
- checklist versioning
- media relationships
- imports
- exports
- authorization

## E2E

- auth
- journal
- setup
- evidence
- review
- strategy
- analytics
- import/export
- offline sync
- conflict resolution

---

# 158. DEVELOPMENT DOCUMENTATION

Provide a high-quality README containing:

- product overview
- architecture
- stack
- setup
- environment variables
- database setup
- migrations
- local Supabase setup
- authentication
- storage
- testing
- deployment
- security model
- RLS model
- privacy mode
- offline mode
- analytics architecture

---

# 159. ENVIRONMENT

Provide:

`.env.example`

Never include real credentials.

Document:

- required variables
- optional variables
- production variables
- server-only variables

---

# 160. MIGRATIONS

All schema changes must be reproducible.

Use real migrations.

Do not rely on manually changing production databases.

---

# 161. CODE QUALITY

Avoid:

- giant files
- giant components
- duplicated calculations
- duplicated validation
- magic numbers
- hidden mutations
- client-only security checks
- scattered business rules

Use:

- clear types
- schemas
- service modules
- domain functions
- reusable components
- tests
- explicit naming

---

# 162. PRODUCT EXTENSIBILITY

Architect for future support of:

- AI analysis
- broker imports
- broker integrations
- market data
- advanced statistics
- Monte Carlo
- team features
- mobile applications
- external API
- strategy marketplaces

But do not let future possibilities complicate v1 unnecessarily.

---

# 163. WHAT NOT TO BUILD AS CORE V1

Do not prioritize:

- social feeds
- public trader profiles
- meaningless gamification
- trading signals
- trade-copying
- investment advice
- guaranteed-profit claims
- excessive AI features
- unnecessary social mechanics

DnD is about improving the user's own process.

---

# 164. FINANCIAL DISCLAIMER

DnD is a trading journaling, analytics and performance-management product.

It must not represent itself as:

- financial advice
- investment advice
- guaranteed profit
- guaranteed prediction
- a signal provider

---

# 165. FINAL DEFINITION OF DONE

DnD is done only when:

- authentication works
- users are securely isolated
- RLS is correctly configured
- trades persist
- calculations are correct
- partial fills work
- strategy versions work
- checklist versions work
- psychology is captured
- evidence works
- annotations are non-destructive
- media is private
- videos work
- daily plans work
- plan vs execution works
- calendar works
- analytics work
- insights use real data
- sample-size rules are enforced
- reviews work
- action items work
- import works
- export works
- backups work
- restore works
- offline mode works
- sync works
- conflicts are visible
- Privacy Mode works according to its stated guarantees
- settings work
- notifications work
- accessibility is addressed
- mobile works
- desktop works
- error handling is understandable
- tests pass
- production build succeeds
- security checks pass
- no important feature is fake

---

# 166. FINAL BUILDING AGENT DIRECTIVE

Build DnD as a real product.

Do not think of this as creating pages.

Think of it as creating a connected trading performance system.

The most important object in the system is the **Trade**.

A trade connects:

```text
Account
   │
   ├── Execution
   │
   ├── Trading Plan
   │
   ├── Strategy Version
   │
   ├── Setup Checklist
   │
   ├── Risk
   │
   ├── Psychology
   │
   ├── Evidence
   │
   ├── Review
   │
   └── Analytics
```

A Strategy connects:

```text
Strategy
   ↓
Version
   ↓
Rules
   ↓
Checklist
   ↓
Trades
   ↓
Results
   ↓
Review
   ↓
Next Version
```

A Review connects:

```text
Trades
   ↓
Patterns
   ↓
Problems
   ↓
Lessons
   ↓
Action Items
   ↓
Future Plans
```

That interconnected model is the heart of DnD.

The product should transform:

**raw trading history**

into:

**structured evidence**

then into:

**measurable understanding**

then into:

**behavioral improvement**

then into:

**better strategy development.**

Build the system so every important piece of information has context, every important calculation has a trustworthy source, every sensitive record is protected, and every meaningful user action leads naturally toward better review and decision-making.

Do not optimize for "how much UI can be generated."

Optimize for:

**correctness, security, clarity, speed, data integrity, usability, maintainability and long-term value.**

Execute the build in phase order.

At every phase, leave the application working.

Do not silently deviate from this specification.

When a technical choice requires interpretation, choose the solution that maximizes:

**Security + Data Integrity + UX + Maintainability + Performance + Scalability**

while minimizing unnecessary complexity.

The final result should feel like a product that a serious trader could use every trading day for years.