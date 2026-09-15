# Task `non-blocking-uploads` — Non-blocking media uploads with real progress

**File touched:** `src/components/views/trade-form-view.tsx` (only file changed, per task scope).

**Lint:** `bun run lint` → exit 0, no errors. Dev server hot-reload compiled cleanly.

## What changed

### 1. Concurrent, non-blocking uploads with real progress
Replaced the old sequential `for`-loop `handleFileUpload` (which `await`ed each `fetch` one at a time, blocking the whole form) with a concurrent XMLHttpRequest-based system:

- `handleFileUpload(files)` — for each file, immediately pushes a placeholder media item into `form.uploadedMedia` with `status: "uploading"`, `progress: 0`, `tempId`, `fileSize`, `kind` (detected from MIME), then calls `uploadFile()` (fire-and-forget, no await). The form keeps rendering and is fully interactive during uploads.
- `uploadFile(file, tempId)` — opens an `XMLHttpRequest` POST to `/api/media`, stores `{ file, xhr }` in a `useRef<Map>` so Cancel/Retry can reach them, and wires:
  - `xhr.upload.onprogress` → updates the placeholder's `progress` (0–100) via `setForm`.
  - `xhr.onload` → on 2xx, parses the media record, then fetches `/api/media/${id}` for the signed URL and merges `{ ...data, id, url, status: "uploaded", progress: 100 }`. On non-2xx, surfaces the server error message (e.g. "File too large") via `markUploadFailed`.
  - `xhr.onerror` → marks failed.
  - `xhr.onabort` → no-op (cancelUpload already cleans up).
- All files upload **concurrently** — selecting 5 files fires 5 parallel XHRs, each with its own progress bar.

### 2. Per-file File + XHR refs (not state)
Added `const fileRefs = useRef<Map<string, { file: File; xhr: XMLHttpRequest | null }>>(new Map())` next to `fileInputRef`. Keeps heavy `File` objects and live XHR handles out of React state so progress ticks (which fire frequently) don't re-render File blobs. The map is keyed by `tempId` so Cancel/Retry can find the right entry.

### 3. Cancel + Retry + Remove-failed
- `cancelUpload(tempId)` — aborts the XHR if in-flight, deletes the ref, removes the placeholder from `form.uploadedMedia`. Wired to the `X` button on uploading items and the `X` button on failed items.
- `retryUpload(tempId)` — reads the stored `File` from `fileRefs`, resets the item to `{ status: "uploading", progress: 0 }`, and calls `uploadFile` again. If the File is gone (e.g. after a page refresh), shows a toast telling the user to re-select.
- `markUploadFailed(tempId, filename, msg?)` — sets `status: "failed"`, keeps the `File` in the ref (clears xhr) so Retry works, and toasts the error.

### 4. Evidence section rendering — three states
The `items.map(...)` in the Trade Evidence card now branches on `m.status ?? "uploaded"`:
- **uploading** — spinner + filename + "Uploading N%" + file size + `X` cancel button + a `bg-primary` progress bar (`h-1.5 bg-muted rounded-full` track, width = `progress%`) with `role="progressbar"` + aria-valuenow/min/max for a11y. Full-width on mobile.
- **failed** — `AlertTriangle` (text-loss) + filename + "Upload failed" + `Retry` button (RotateCcw icon) + `X` remove button. Card border tinted `border-loss/40`, header `bg-loss/5`.
- **uploaded** (or undefined, for existing media loaded from the server) — the unchanged full preview: `ImageAnnotator` for images / `<video controls>` for videos + timeframe `Select` + caption `Input` + delete `Trash2` button.

React keys switched from `m.id ?? i` to `m.tempId ?? m.id ?? i` so placeholders (which have no `id` yet) keep a stable key across progress updates. No form fields are disabled during upload (per the constraints).

### 5. Submit handling
- The media-patch loop now guards with `if (m.id && m.status !== "uploading" && m.status !== "failed")` so items still uploading (no id yet) or failed are skipped — no wasted PATCH calls, no half-attached records.
- After the trade is saved + media patched, if any items are still `uploading`, shows `toast.info("Some media is still uploading and will be attached when complete.")`. For edits this is accurate (the upload's formData already carries `tradeId`); for new trades it's an honest heads-up (the trade didn't exist at upload time, so the media is orphaned and would need a manual attach later).

### 6. Navigation warning
Added a `useEffect` that installs a `beforeunload` listener whenever any media item has `status === "uploading"`, and removes it otherwise. Prevents silent loss of in-flight XHR uploads on tab close/refresh.

### 7. Draft restore robustness
The draft-restore effect now maps any `status: "uploading"` items to `status: "failed"` on restore, because the XHR (and the non-serializable `File`) are gone after a refresh — otherwise they'd be stuck at 0% forever with no retry path. `fileRefs` is empty after refresh, so retry will guide the user to re-select.

## Constraints honored
- Media API (`/api/media` route) — untouched.
- `ImageAnnotator` — untouched.
- Timeframe / caption / annotation persistence logic — unchanged (still PATCHes `timeframe`/`caption` and PUTs `setAnnotations`).
- No form fields disabled during upload.
- Evidence section stays in the same place in the form (Trade Info → Trade Evidence card).
- Upload progress UI is inline inside the Evidence card, not a global toast.
- Mobile: progress bars are `w-full`, compact (`h-1.5`), and the cancel/retry buttons are `flex-shrink-0` so the filename truncates instead of the controls wrapping.
- Semantic tokens used throughout (`bg-primary`, `bg-muted`, `text-muted-foreground`, `text-loss`, `border-border`, `border-loss/40`, `bg-loss/5`).

## Icons added to imports
`X`, `RotateCcw` from `lucide-react` (`Loader2` and `AlertTriangle` were already imported).

## Not changed / out of scope
- The "attached when complete" promise for **new trades** is informational only — for new trades the trade row didn't exist at upload time, so the media is created without a `tradeId`. A follow-up task could re-patch `tradeId` onto media that completes after submit (e.g. via a small queue flushed on each `xhr.onload`). This task's scope was the non-blocking UI + progress, which is complete.
