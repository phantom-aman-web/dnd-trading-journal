# Task `news-screenshots` — News event selector + Screenshot timeframe system

## Summary

Two related changes to the trade form, backed by new schema columns and
lib helpers:

1. **News event selector** — replaced the old `newsImpact` (none/low/normal/high)
   radio-style dropdown with a structured `newsEvent` enum pulled from a new
   `src/lib/news-events.ts` catalog (22 events: FOMC Fund Rate, NFP, CPI, ISM,
   GDP, JOLTS, ADP, etc.). The selected value is persisted on the `Trade` row
   as `newsEvent String? @default("none")`.
2. **Screenshot timeframe system** — every uploaded evidence image now carries
   a `timeframe` (Weekly / Daily / 4H / 1H / 30m / 15m / 5m / 3m / 1m / custom)
   chosen from `src/lib/timeframes.ts`. Evidence items are grouped in the UI
   by timeframe group ("Higher Timeframe", "Execution Timeframe",
   "Entry / Trigger", "Other"), with an "Unassigned" bucket at the top for
   items the user has not yet categorized. The selected value is persisted on
   the `TradeMedia` row as `timeframe String?`.
3. **Annotation persistence bug fix** — non-destructive SVG drawings made in
   the in-form `ImageAnnotator` were previously lost on save because they
   lived only in client state. The submit handler now also calls
   `PUT /api/media/{id}` with `{ action: "setAnnotations", annotations }`
   (serialized to the same `{ kind, payload: { x1, y1, x2, y2, text, color } }`
   shape used by the trade-detail `ImageViewer`) so drawings round-trip
   through the `MediaAnnotation` table. The edit-mode loader also now
   deserializes existing `MediaAnnotation` rows back into the
   `ImageAnnotation[]` shape so previously saved drawings show up when
   re-editing a trade.

## Files touched

### New files

- `src/lib/news-events.ts` — `NEWS_EVENTS` catalog (22 entries), `NewsEvent`
  interface, `getNewsEventLabel(value)` helper.
- `src/lib/timeframes.ts` — `TIMEFRAMES` array (10 entries, grouped),
  `TIMEFRAME_GROUPS` array, `getTimeframeGroup(value)`,
  `getTimeframeLabel(value)` helpers.

### Schema + API

- `prisma/schema.prisma`
  - `Trade.newsEvent String? @default("none")` — structured news event key
    (see `src/lib/news-events.ts`).
  - `TradeMedia.timeframe String?` — chart timeframe the screenshot captures
    (see `src/lib/timeframes.ts`).
- Ran `bun run db:push` — both columns applied, Prisma client regenerated.
- `src/app/api/trades/route.ts`
  - Added `newsEvent: z.string().optional().nullable()` to `TradeCreateSchema`.
  - Save `newsEvent: data.newsEvent ?? "none"` on trade create.
- `src/app/api/trades/[id]/route.ts`
  - Added `newsEvent` to the PATCH allowlist (mass-assignment protection
    still enforced).
- `src/app/api/media/[id]/route.ts`
  - PATCH now accepts `timeframe` alongside `caption`/`stage`/`tags`.
  - Empty timeframe string → `null` (clears the value).
  - The existing PUT `setAnnotations` handler was already correct
    (`deleteMany` then `createMany`); verified it accepts
    `{ action: "setAnnotations", annotations: [{ kind, payload }] }` and
    stores each annotation's `payload` as `payloadJson`.

### Trade form (`src/components/views/trade-form-view.tsx`)

- Imports `NEWS_EVENTS, getNewsEventLabel` from `@/lib/news-events` and
  `TIMEFRAMES as MEDIA_TIMEFRAMES, TIMEFRAME_GROUPS, getTimeframeGroup,
  getTimeframeLabel` from `@/lib/timeframes`.
- Imports `SelectGroup, SelectLabel` from shadcn `select` for the grouped
  dropdown.
- Removed local `NEWS_IMPACTS` constant.
- Form state default: `newsEvent: "none"` (replaces `newsImpact: "none"`).
- Edit-mode restore: `newsEvent: (existing as any).newsEvent ?? "none"`.
- API payload: `newsEvent: form.newsEvent ?? "none"`.
- Step 1 (Trade Basics): "News Event" Select dropdown listing all 22
  events from `NEWS_EVENTS`, with `max-h-72` on the SelectContent so it
  scrolls within long lists.
- Step 1 (Trade Evidence):
  - New `setMediaTimeframe(idx, value)` helper writes to `m.timeframe`.
  - `groupedMedia` useMemo buckets each uploaded media item into a
    timeframe group via `getTimeframeGroup(m.timeframe)`. Items with no
    timeframe land in an "Unassigned" bucket first to nudge the user to
    pick one. Group order: Unassigned → Higher Timeframe → Execution
    Timeframe → Entry / Trigger → Other (then any custom keys as a
    fallback).
  - Each group is rendered with a sticky header showing the group name
    and item count.
  - Each evidence card now has a 2-column footer with:
    - **Timeframe Select** (grouped dropdown via `SelectGroup` +
      `SelectLabel`, includes a `— None —` option to clear).
    - **Caption Input** (the previous textarea is now a single-line input
      for compactness — the underlying field is still `m.caption` and is
      PATCHed to the API as `caption`).
  - Below the selectors, a small helper line shows the resolved label +
    group (e.g. "5m · Entry / Trigger") for confirmation.
- Submit handler:
  - For each uploaded media item with an `id`, PATCHes `caption` and
    `timeframe` to `/api/media/{id}`.
  - For each item with non-empty `annotations`, also PUTs
    `{ action: "setAnnotations", annotations: [{ kind, payload }] }` so
    SVG drawings are persisted to the `MediaAnnotation` table.
- Edit-mode loader: existing `MediaAnnotation` rows are now deserialized
  from `{ id, kind, payloadJson }` into `ImageAnnotation[]` shape
  (`{ id, kind, x1, y1, x2, y2, text?, color }`) so saved drawings show
  up in the annotator when re-editing. Also restores `caption` and
  `timeframe` from the API response.

## Verification

- `bun run db:push` succeeded — both columns applied without data loss.
- `bun run lint` — clean (no warnings, no errors).
- Dev server (`bun run dev`) continues to serve `GET /` 200 OK after
  all edits, with no compile errors in `dev.log`.
- The two "Fast Refresh had to perform a full reload" warnings seen
  during editing are expected (the new `useMemo` and helper signatures
  required a full reload rather than an incremental update); the page
  recompiled successfully each time.

## Notes for downstream agents

- The `newsImpact` field is fully gone from the codebase — no client or
  API reference remains. Existing trades that had a `newsImpact` value
  in client state are simply ignored (the form defaults to `newsEvent:
  "none"`). If you want to migrate historical `newsImpact` data, the
  column is no longer in the Prisma schema; you'd need to add it back
  temporarily or write a one-off SQL update.
- The `caption` vs `description` ambiguity in the task description: the
  trade form already wrote the textarea to `m.caption` (not
  `m.description`), so no field rename was needed. The PATCH already
  sent `caption: m.caption`. The textarea was replaced with a single-line
  `Input` for compactness; the underlying state field is unchanged.
- The `MediaAnnotation` payload shape is intentionally compatible with
  the trade-detail `ImageViewer` (`src/components/trade/image-viewer.tsx`)
  so drawings made in either viewer are visible in the other.
