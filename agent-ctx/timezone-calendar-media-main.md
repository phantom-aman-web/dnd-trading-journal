# Task: timezone-calendar-media

## Summary

Applied 8 fixes to the DnD trading application:

1. **Timezone awareness** — `getSessionUser()` now selects `settings.timezone`
   and flattens it onto the returned user object. The calendar and analytics
   routes consume `user.timezone` (default `"UTC"`) and use
   `Intl.DateTimeFormat` with `timeZone:` to bucket trades by local day /
   weekday / hour instead of UTC.
2. **Calendar additional metrics** — calendar day objects now also include
   `winRate`, `bestTradeCents`, `bestTradeR`, `worstTradeCents`,
   `ruleViolations`, and `primarySession`. Per-day session tally is kept in
   a transient `DayAcc` and stripped from the JSON response.
3. **Media N+1 query fix** — `GET /api/media` now inlines `buildSignedUrl`
   per item so the client doesn't have to fan out N GET /api/media/[id]
   requests just to render thumbnails. Same treatment for
   `GET /api/trades/[id]` (trade-detail media items now carry `url`).
   `media-view.tsx` no longer does Promise.all of per-item fetches.
   `trade-detail-view.tsx` Evidence tab no longer fetches `/api/media/[id]`
   on click — `m.url` is already populated by the trade-detail API.
4. **Video playback** — `media-view.tsx` already had a `<video controls>`
   element; verified and left alone. Added `<video controls preload="metadata">`
   to the trade-detail Evidence tab for video items. The Evidence grid now
   shows videos alongside images (was previously images-only).
5. **Media download button** — added a small download button (anchor with
   `download` attribute and `&download=1` query param) next to the existing
   delete button on each media card. Added a note in
   `/api/media/[id]` GET about the `&download=1` param.
6. **Top bar mobile menu icon** — changed the mobile-menu toggle from
   `Search` to `Menu` (the Search import is kept since it's still used by
   the command-palette trigger button).
7. **Settings Profile Name field** — Name field is no longer disabled and
   no longer shows the userId. The settings GET response now includes
   `user.name`; the PATCH handler accepts `name` and updates `db.user.name`
   separately from `UserSettings`. The settings-view binds the field to a
   `name` state variable and saves it on the existing Save button.
8. **Image viewer unsaved-annotations warning** — added a `dirty` state
   that becomes true whenever annotations change (gated by a skipRef so the
   initial load doesn't mark dirty). Navigation paths (close button, prev /
   next buttons, Arrow keys, Escape) all funnel through a `maybeNavigate`
   helper that, when dirty, shows `confirm("You have unsaved annotations.
   Save before leaving?")`; OK saves then navigates, Cancel does nothing.
   `saveAnnotations` resets `dirty=false` on success.

## Verification

- `bun run lint` → clean (0 errors, 0 warnings).
- `bunx tsc --noEmit` → 215 errors total (all pre-existing
  `parseJson<T = unknown>` widening, `examples/websocket` missing modules,
  `skills/*`, `src/lib/crypto.ts` Buffer typing, and trade-form-view
  pre-existing `never[]` push). No new errors introduced; actually removed
  some by typing the settings PATCH body as `Record<string, unknown>`.
- Manual end-to-end:
  - Signed in as `trader@dnd.local`.
  - `GET /api/calendar` → returns `timezone: "UTC"`, days with
    `winRate`, `bestTradeCents`, `bestTradeR`, `worstTradeCents`,
    `ruleViolations`, `primarySession` populated correctly.
  - `PATCH /api/settings {name, timezone}` → updates `User.name` and
    `UserSettings.timezone`; subsequent `GET /api/calendar` reflects the
    new timezone in trade grouping.
  - `GET /api/media` → each item includes a signed `url` field.
  - `GET /api/settings` → response now includes `user.name`.

## Files Modified

- `src/lib/auth.ts` — `getSessionUser()` adds `settings.timezone` select.
- `src/app/api/calendar/route.ts` — full rewrite: timezone-aware date
  bucketing, additional metrics, month-boundary buffer, sessionTally.
- `src/app/api/analytics/route.ts` — `time` dimension uses
  `Intl.DateTimeFormat` with `timeZone` for weekday / hour.
- `src/app/api/media/route.ts` — GET inlines `url` per item.
- `src/app/api/media/[id]/route.ts` — added `&download=1` note.
- `src/app/api/trades/[id]/route.ts` — GET inlines `url` per media item.
- `src/app/api/settings/route.ts` — GET returns `user.name`; PATCH persists
  `name` to `db.user.name`; typed body as `Record<string, unknown>`.
- `src/components/views/media-view.tsx` — removed N+1 fetch loop; added
  download button next to delete button.
- `src/components/views/trade-detail-view.tsx` — removed unused
  `/api/media/[id]` fetch on click; renders `<video controls>` for videos;
  Evidence grid now includes both images and videos.
- `src/components/views/calendar-view.tsx` — `CalendarDay` interface +
  empty-cell defaults extended for the new fields.
- `src/components/views/settings-view.tsx` — added `name` state, init from
  `data.user.name`, sent on PATCH; Name Input is now editable (not disabled).
- `src/components/top-bar.tsx` — mobile menu icon: `Search` → `Menu`.
- `src/components/trade/image-viewer.tsx` — `dirty` state, `skipDirtyRef`,
  `maybeNavigate` helper, `maybeNavigateRef`, keyboard handler / close /
  prev / next all gated through `maybeNavigate`; `saveAnnotations` returns
  boolean and resets `dirty=false`.
