# Task: sidebar-grouping

**Agent:** main
**Component:** `src/components/sidebar.tsx`
**Goal:** Redesign desktop sidebar to use grouped navigation with section labels, preserving visual identity, icons, active/hover/collapsed behavior, and collapsibility.

## Summary of changes

Refactored `src/components/sidebar.tsx` from a flat `NAV_ITEMS` array into a grouped `NAV_GROUPS` array plus a separate `SYSTEM_GROUP`.

### New structure
- **OVERVIEW**: Dashboard
- **TRADE**: Journal, Daily Plans, Calendar
- **UNDERSTAND**: Analytics, Reviews
- **BUILD**: Playbooks, Media
- *(Add Trade button — prominent, in footer)*
- **SYSTEM**: Settings

### Key implementation details
1. `NavGroup = { label: string; items: NavItem[] }` type added.
2. `NAV_GROUPS: NavGroup[]` contains the four primary groups (in spec order).
3. `SYSTEM_GROUP: NavGroup` (label "System", items: Settings) rendered separately in the footer.
4. `renderItem(item)` helper preserves the exact per-item className logic from the original (active/hover/collapsed).
5. `renderGroup(group)` helper renders a subtle label `<div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 select-none">` (hidden when collapsed) followed by the items.
6. Groups separated by `space-y-4` in the scrollable nav (spacing-based divider).
7. Footer area (`border-t border-sidebar-border p-2 space-y-3`) now renders the `Add Trade` Button followed by `renderGroup(SYSTEM_GROUP)` so the SYSTEM label + Settings item sit at the bottom.
8. Active-state logic preserved verbatim:
   `view === item.key || (view === "tradeDetail" && item.key === "journal") || (view === "tradeNew" && item.key === "journal")`.
9. Brand mark ("D" circle + "DnD" text), collapse toggle chevron, and the collapsed-state floating expand button are all unchanged.
10. Widths unchanged: `w-16` (collapsed) ↔ `w-60` (expanded).
11. Icons unchanged: `LayoutDashboard, BookOpen, Calendar, BarChart3, BookMarked, ClipboardList, Star, Image as ImageIcon, Settings, ChevronLeft`.
12. Removed unused `import Link from "next/link"` (was imported but never used in the original file).

## Verification
- `bun run lint` → PASS (zero errors, zero warnings).
- Dev server log reviewed — no compile/runtime errors; routes serving 200.
- New sidebar compiles cleanly (`✓ Compiled in 229ms`).

## Requirements checklist
- [x] Keep current icons for each nav item
- [x] Keep active/hover states exactly as they are
- [x] Keep sidebar collapsible (w-60 ↔ w-16)
- [x] When collapsed, section labels disappear (only icons show)
- [x] Section labels subtle: small text, muted color, uppercase, non-competing
- [x] Add Trade button stays prominent at bottom (above SYSTEM)
- [x] Thin divider / spacing between groups (space-y-4)
- [x] Section labels NOT clickable (plain divs, no button role)
- [x] "DnD" brand mark kept at top
- [x] When collapsed, all nav items centered (justify-center px-0 preserved)
