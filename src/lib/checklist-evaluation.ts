/**
 * DnD — Checklist evaluation domain module.
 *
 * Replaces the hardcoded A+/A/B/C grade→score mapping in the trade form
 * (which was: A+→0.92, A→0.80, B→0.62, C→0.45) with real weighted
 * checklist evaluation.
 *
 * Pipeline:
 *   1. User checks off checklist items (each item has a `weight`).
 *   2. `calculateChecklistScore` computes the weighted ratio (0..1).
 *   3. `deriveGrade` maps the score to a grade using configurable thresholds
 *      (the `gradingThresholdsJson` stored on `ChecklistVersion`).
 *   4. `evaluateChecklist` combines the above and applies a "required item"
 *      cap: if any item with `required: true` is unchecked, the grade is
 *      capped at "C" (or "Invalid" if the score is below the C threshold).
 *
 * Storage mapping (on `TradeChecklistEvaluation`):
 *   - rawAnswersJson   = JSON.stringify(answers)
 *   - weightedScore    = score.toString()  (decimal string 0..1)
 *   - finalGrade       = grade
 *
 * Pure functions. No I/O. Safe for both server and client use. Mirrors the
 * strict-Typescript / never-NaN conventions of `src/lib/decimal.ts` and
 * `src/lib/calculations.ts`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Grade bands used across the app (matches `Trade.setupGrade` comment). */
export type Grade = "A+" | "A" | "B" | "C" | "Invalid";

/**
 * A single checklist item definition.
 *
 * Mirrors the per-item shape stored in `ChecklistVersion.itemsJson`:
 *   [{ id, text, required, weight, evidenceRequired }]
 */
export interface ChecklistItem {
  /** Stable id (used as the key in `ChecklistAnswer`). */
  id: string;
  /** Human-readable prompt shown to the user. */
  text: string;
  /** If true, an unchecked copy caps the resulting grade at "C" or lower. */
  required: boolean;
  /** Relative importance. Must be a finite, non-negative number. */
  weight: number;
  /** If true, the user is expected to attach evidence (screenshot, etc.). */
  evidenceRequired: boolean;
}

/** One item's answer from the user. */
export interface ChecklistAnswerValue {
  /** Whether the user checked the box. */
  checked: boolean;
  /** Optional free-text note for context/evidence. */
  note?: string;
}

/**
 * Answers map keyed by `ChecklistItem.id`. Stored as
 * `TradeChecklistEvaluation.rawAnswersJson`.
 *
 * Shape: `{ [itemId]: { checked: boolean; note?: string } }`.
 */
export type ChecklistAnswer = Record<string, ChecklistAnswerValue>;

/**
 * Score→grade thresholds. Each value is the minimum score required for that
 * grade. Stored as `ChecklistVersion.gradingThresholdsJson`.
 *
 * Example: { "A+": 0.9, "A": 0.75, "B": 0.6, "C": 0.4 }
 */
export type GradingThresholds = Partial<Record<Exclude<Grade, "Invalid">, number>>;

/** Result of a full checklist evaluation. */
export interface ChecklistEvaluation {
  /** Weighted score in [0, 1]. */
  score: number;
  /** Grade after applying the required-item cap. */
  grade: Grade;
  /** Grade that would have been assigned without the required-item cap. */
  rawGrade: Grade;
  /** True if any required item is unchecked. */
  requiredItemsMissing: boolean;
  /** Number of required items currently checked. */
  requiredCheckedCount: number;
  /** Total number of required items. */
  requiredTotalCount: number;
  /** IDs of items that are checked + `evidenceRequired` but have no note. */
  evidenceMissing: string[];
}

// ---------------------------------------------------------------------------
// Defaults & constants
// ---------------------------------------------------------------------------

/**
 * Default grading thresholds. Used when a `ChecklistVersion` does not specify
 * its own `gradingThresholdsJson`. Matches the seed ("A+ Setup" v1.0).
 */
export const DEFAULT_GRADING_THRESHOLDS: GradingThresholds = {
  "A+": 0.9,
  A: 0.75,
  B: 0.6,
  C: 0.4,
};

/**
 * Ordered list of grade bands, from highest to lowest. Used to find the
 * highest threshold that the score meets.
 */
const GRADE_ORDER: ReadonlyArray<Exclude<Grade, "Invalid">> = ["A+", "A", "B", "C"];

// ---------------------------------------------------------------------------
// Core scoring
// ---------------------------------------------------------------------------

/**
 * Compute the weighted score for a checklist evaluation.
 *
 * Formula:
 *   score = sum(weight of checked items) / sum(weight of all items)
 *
 * - Returns a finite number in [0, 1].
 * - Empty `items`, or all-zero weights → 0 (never NaN/Infinity, per spec
 *   section 110).
 * - An item without a corresponding answer entry is treated as unchecked.
 * - Negative weights are clamped to 0 (defensive).
 * - Result is rounded to 4 decimal places to avoid float noise.
 *
 * Note: this function does NOT apply the required-item cap. It is the raw
 * weighted ratio. Use `evaluateChecklist` for the capped grade.
 */
export function calculateChecklistScore(
  items: ChecklistItem[],
  answers: ChecklistAnswer,
): number {
  if (!Array.isArray(items) || items.length === 0) return 0;

  let totalWeight = 0;
  let checkedWeight = 0;

  for (const item of items) {
    // Defensive: ignore malformed entries.
    if (!item || typeof item.id !== "string") continue;

    const w = toFiniteNonNegative(item.weight);
    totalWeight += w;

    const ans = answers?.[item.id];
    if (ans && ans.checked === true) {
      checkedWeight += w;
    }
  }

  if (totalWeight <= 0) return 0;

  const score = checkedWeight / totalWeight;
  const clamped = Math.max(0, Math.min(1, score));
  return Math.round(clamped * 1e4) / 1e4;
}

// ---------------------------------------------------------------------------
// Grade derivation
// ---------------------------------------------------------------------------

/**
 * Normalize a thresholds object into a guaranteed-complete, ordered list of
 * [grade, threshold] pairs. Falls back to DEFAULT_GRADING_THRESHOLDS for
 * missing entries so the caller can always rely on all four grades being
 * present.
 */
function resolveThresholds(
  thresholds?: GradingThresholds | null,
): Array<[Exclude<Grade, "Invalid">, number]> {
  const src =
    thresholds && typeof thresholds === "object" && !Array.isArray(thresholds)
      ? thresholds
      : {};
  return GRADE_ORDER.map((g) => {
    const v = toFiniteNonNegative(src[g]);
    return [g, v] as [Exclude<Grade, "Invalid">, number];
  });
}

/**
 * Derive a grade from a score using configurable thresholds.
 *
 * Returns the highest grade whose threshold the score meets or exceeds.
 * If the score is below the lowest threshold (typically "C"), returns
 * "Invalid".
 *
 * Note: this function does NOT apply the required-item cap. Use
 * `evaluateChecklist` (or `applyRequiredItemCap`) for that.
 *
 * Example with `{ "A+": 0.9, "A": 0.75, "B": 0.6, "C": 0.4 }`:
 *   0.95 → "A+"
 *   0.80 → "A"
 *   0.65 → "B"
 *   0.45 → "C"
 *   0.30 → "Invalid"
 */
export function deriveGrade(
  score: number,
  thresholds?: GradingThresholds | null,
): Grade {
  const s = toFiniteNonNegative(score);
  const resolved = resolveThresholds(thresholds);

  for (const [grade, threshold] of resolved) {
    if (s >= threshold) return grade;
  }
  return "Invalid";
}

/**
 * Cap a grade based on whether all required items were checked.
 *
 * If any required item is unchecked, the grade is capped at "C" — required
 * items are considered non-negotiable for A+/A (and even B) quality setups.
 *
 * - If `grade` is already "C" or "Invalid", it is returned unchanged.
 * - If `grade` is "A+", "A", or "B" AND a required item is unchecked → "C".
 * - Otherwise `grade` is returned unchanged.
 */
export function applyRequiredItemCap(
  grade: Grade,
  items: ChecklistItem[],
  answers: ChecklistAnswer,
): Grade {
  if (grade === "A+" || grade === "A" || grade === "B") {
    if (!hasAllRequiredItemsChecked(items, answers)) return "C";
  }
  return grade;
}

/**
 * True iff every item with `required: true` has a checked answer.
 * Defensive: returns `true` for an empty/invalid items array (no required
 * items to violate).
 */
export function hasAllRequiredItemsChecked(
  items: ChecklistItem[],
  answers: ChecklistAnswer,
): boolean {
  if (!Array.isArray(items)) return true;
  for (const item of items) {
    if (!item || item.required !== true) continue;
    const ans = answers?.[item.id];
    if (!ans || ans.checked !== true) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Full evaluation
// ---------------------------------------------------------------------------

/**
 * Run the full evaluation pipeline:
 *   score    = calculateChecklistScore(items, answers)
 *   rawGrade = deriveGrade(score, thresholds)
 *   grade    = applyRequiredItemCap(rawGrade, items, answers)
 *
 * Also surfaces diagnostic info (missing required items, missing evidence)
 * that the trade form can use to warn the user before they save.
 */
export function evaluateChecklist(
  items: ChecklistItem[],
  answers: ChecklistAnswer,
  thresholds?: GradingThresholds | null,
): ChecklistEvaluation {
  const score = calculateChecklistScore(items, answers);
  const rawGrade = deriveGrade(score, thresholds);
  const grade = applyRequiredItemCap(rawGrade, items, answers);

  let requiredCheckedCount = 0;
  let requiredTotalCount = 0;
  const evidenceMissing: string[] = [];

  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item || typeof item.id !== "string") continue;
      const ans = answers?.[item.id];
      const checked = !!ans && ans.checked === true;

      if (item.required === true) {
        requiredTotalCount++;
        if (checked) requiredCheckedCount++;
      }

      // Evidence is only "missing" when the item is checked (so the user is
      // claiming it was met) but `evidenceRequired` is true and no note was
      // provided. The caller can decide whether to warn or block on this.
      if (checked && item.evidenceRequired === true) {
        const note = typeof ans?.note === "string" ? ans.note.trim() : "";
        if (note === "") {
          evidenceMissing.push(item.id);
        }
      }
    }
  }

  return {
    score,
    grade,
    rawGrade,
    requiredItemsMissing: requiredCheckedCount < requiredTotalCount,
    requiredCheckedCount,
    requiredTotalCount,
    evidenceMissing,
  };
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/**
 * Parse a `ChecklistVersion.itemsJson` string into typed items.
 * Never throws — malformed entries are filtered out so the UI can degrade
 * gracefully instead of crashing.
 */
export function parseChecklistItems(
  itemsJson: string | null | undefined,
): ChecklistItem[] {
  if (!itemsJson) return [];
  try {
    const parsed = JSON.parse(itemsJson);
    if (!Array.isArray(parsed)) return [];
    const out: ChecklistItem[] = [];
    for (const x of parsed) {
      if (!x || typeof x !== "object") continue;
      const item = x as Record<string, unknown>;
      if (typeof item.id !== "string" || typeof item.text !== "string") continue;
      out.push({
        id: item.id,
        text: item.text,
        required: item.required === true,
        weight:
          typeof item.weight === "number" && Number.isFinite(item.weight)
            ? item.weight
            : 0,
        evidenceRequired: item.evidenceRequired === true,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Parse a `ChecklistVersion.gradingThresholdsJson` string.
 * Falls back to DEFAULT_GRADING_THRESHOLDS for missing entries or entirely
 * invalid JSON. Returned thresholds are clamped to [0, 1].
 */
export function parseGradingThresholds(
  thresholdsJson: string | null | undefined,
): GradingThresholds {
  if (!thresholdsJson) return { ...DEFAULT_GRADING_THRESHOLDS };
  try {
    const parsed = JSON.parse(thresholdsJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...DEFAULT_GRADING_THRESHOLDS };
    }
    const out: GradingThresholds = {};
    for (const g of GRADE_ORDER) {
      const v = (parsed as Record<string, unknown>)[g];
      if (typeof v === "number" && Number.isFinite(v)) {
        out[g] = Math.max(0, Math.min(1, v));
      }
    }
    // Merge with defaults so missing entries still have a threshold.
    return { ...DEFAULT_GRADING_THRESHOLDS, ...out };
  } catch {
    return { ...DEFAULT_GRADING_THRESHOLDS };
  }
}

/**
 * Serialize an answers map for `TradeChecklistEvaluation.rawAnswersJson`.
 * Returns a stable JSON string (keys sorted) for reproducible storage.
 */
export function serializeAnswers(answers: ChecklistAnswer): string {
  const safe = answers && typeof answers === "object" ? answers : {};
  const sorted: ChecklistAnswer = {};
  for (const key of Object.keys(safe).sort()) {
    const v = safe[key];
    if (v && typeof v === "object") {
      const note =
        typeof v.note === "string" && v.note !== "" ? String(v.note) : undefined;
      sorted[key] = {
        checked: v.checked === true,
        ...(note !== undefined ? { note } : {}),
      };
    }
  }
  return JSON.stringify(sorted);
}

/**
 * Parse a `TradeChecklistEvaluation.rawAnswersJson` back into a typed map.
 * Never throws — invalid JSON returns `{}`.
 */
export function parseAnswers(
  rawAnswersJson: string | null | undefined,
): ChecklistAnswer {
  if (!rawAnswersJson) return {};
  try {
    const parsed = JSON.parse(rawAnswersJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: ChecklistAnswer = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const a = v as { checked?: unknown; note?: unknown };
      const note =
        typeof a.note === "string" && a.note !== "" ? a.note : undefined;
      out[k] = {
        checked: a.checked === true,
        ...(note !== undefined ? { note } : {}),
      };
    }
    return out;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Coerce any value to a finite, non-negative number (0 on failure). */
function toFiniteNonNegative(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n;
}

// ---------------------------------------------------------------------------
// Strategy-version rule extraction (shared server + client)
// ---------------------------------------------------------------------------

/**
 * Extract a flat `ChecklistItem[]` from a `StrategyVersion.rulesJson` string.
 *
 * Supports four storage shapes (the trade form has evolved across redesigns):
 *   1. Plain JSON array of strings:           ["rule 1", "rule 2"]
 *   2. Flat JSON array of rule objects:       [{ text, required, weight, evidenceRequired }]
 *   3. Object with an `items` array (current playbooks-view format):
 *        { items: [{ title, required, description }] }
 *   4. Legacy category object:
 *        { entry: [...], stop: [...], target: [...], management: [...], invalidation: [...] }
 *
 * Each rule is normalized to the full `ChecklistItem` shape with stable
 * `id: "rule_<index>"` keys so answers can be keyed consistently. Never
 * throws — malformed JSON returns `[]`.
 *
 * This function is the single source of truth for rule extraction and is
 * used by BOTH the trade-form-view (client preview) and the trade API
 * routes (server-authoritative evaluation). This guarantees the server
 * evaluates against exactly the same items the user saw.
 */
export function extractChecklist(rulesJson: string | null | undefined): ChecklistItem[] {
  if (!rulesJson) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(rulesJson);
  } catch {
    return [];
  }
  const items: ChecklistItem[] = [];
  let idx = 0;

  const pushRule = (rule: unknown) => {
    if (typeof rule === "string") {
      const text = rule.trim();
      if (!text) return;
      items.push({
        id: `rule_${idx}`,
        text,
        required: true,
        weight: 1,
        evidenceRequired: false,
      });
      idx++;
      return;
    }
    if (rule && typeof rule === "object") {
      const r = rule as Record<string, unknown>;
      const text = String(r.text ?? r.title ?? "").trim();
      if (!text) return;
      const weightNum = typeof r.weight === "number" && Number.isFinite(r.weight) ? r.weight : 1;
      items.push({
        id: `rule_${idx}`,
        text,
        required: r.required !== false,
        weight: Math.max(0, weightNum),
        evidenceRequired: r.evidenceRequired === true,
      });
      idx++;
    }
  };

  if (Array.isArray(parsed)) {
    parsed.forEach(pushRule);
    return items;
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    // New playbooks-view format: { items: [...] }
    if (Array.isArray(obj.items)) {
      obj.items.forEach(pushRule);
      return items;
    }
    // Legacy category object: { entry, stop, target, management, invalidation }
    for (const section of ["entry", "stop", "target", "management", "invalidation"]) {
      const arr = obj[section];
      if (Array.isArray(arr)) arr.forEach(pushRule);
    }
    return items;
  }
  return [];
}
