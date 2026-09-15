---
name: branchline-design-system
description: Tokens, components, and applied UI kit for Branchline, a real Electron Git client with a "tech-utility" visual direction (neutral white workspace, black accent, mono for all technical values). Use for any new artifact or edit bound to this design system.
user-invocable: true
---

# Branchline Design System — agent usage

Use this when generating or editing any artifact bound to the Branchline design system (the "tech-utility" direction: neutral white Git-client workspace, black accent, mono for all technical values).

## What is inside

- `DESIGN.md` — full narrative system: product context, color, type, spacing, layout, components, motion, voice, anti-patterns.
- `colors_and_type.css` / `tokens.css` — the actual importable tokens.
- `preview/` — 8 focused HTML cards (colors, typography, spacing, radius/shadow, two component cards, brand assets, applied UI) plus `manifest.md` mapping each to its source.
- `ui_kits/app/` — a browsable, self-contained applied interface kit reflecting Branchline's real 3-pane desktop shell.
- `assets/` — the extracted wordmark mark and 8 genuine Branchline demo-mode screenshots.
- `context/` — provenance, the original handoff manifest, and the original session-log README.
- Preserved real implementation at project root: `branchline.html`, `git-backend.cjs`, `electron-main.cjs`, `preload.cjs`, `github-backend.cjs`, `check-prototype.cjs`, `git-client-spec.md`.

## Source context

Generated from the OpenDesign project "Web Prototype" — a real, runnable Electron Git client (branch-comparison-first), not a mockup. `DESIGN.md` §0 has the full product context; `git-client-spec.md` has the complete G01–G45 feature-target list. See `context/provenance.md` for exactly what was kept, converted, or deliberately excluded from the source project's files.

## When to use

Any time you're building or editing a screen, component, or marketing surface that should look like it belongs to Branchline — including net-new screens for the app (worktrees, PRs, Gitflow, etc. per the "미구현" list in the project's `CLAUDE.md`) and any deck/landing page/doc site that uses the Branchline brand.

## How to use

1. Read `DESIGN.md` in full before laying out anything. It has the product context (§0) you need to judge whether a request is a marketing surface or an applied-product surface — the two use different type/spacing scales from the same six color tokens.
2. Paste `colors_and_type.css` and `tokens.css` verbatim into the artifact's first `<style>` (or `@import` them if the runtime supports it). Do not restate the token values by hand and do not introduce a raw hex/rgb/hsl anywhere downstream of them.
3. If the artifact is an **applied product screen** (anything meant to look like it belongs inside the real Branchline app, not a marketing page about it), start from `ui_kits/app/index.html`, not from `branchline.html` or from scratch. Copy its shell structure and swap in only the content that changes.
4. If the artifact is a **marketing/editorial surface** (landing page, doc site, pitch deck) that happens to use this brand, use the marketing-scale classes documented in `DESIGN.md` §3 (`.hero`, `.stat`, `.quote`, `.grid-2/3/4`) — don't force the tight app-shell density onto a scrolling page.

## Component reuse order

Before writing new component markup, check `preview/components-buttons.html` and `preview/components-forms-tables.html` — most needs (buttons, toolbar buttons, fields, dense tables, tags/pills, dropdowns) already have a documented pattern with interaction states defined. Only invent a new component class when none of the previewed ones fit, and if you do, extend `DESIGN.md` §6 with it so the next session doesn't reinvent it again.

Three patterns are load-bearing and must not be silently reinvented differently elsewhere in the same artifact:

- **Detail-on-select**: never render commit/file/PR detail content before something is explicitly clicked. Show the empty-state copy (`.empty`) until then.
- **Searchable dropdown = `#context-menu` + separate search input + separate result list**, never a native `<select>` once search is needed.
- **`branch` vs `viewBranch`**: if you add anything that lets a user "look at" a branch's history without checking it out, keep that state separate from the actually-checked-out branch, exactly as `DESIGN.md` §5 describes.

## What not to do

- Don't add a second accent color, a gradient, or a drop shadow on canvas-level panels — see `DESIGN.md` §9 for the full anti-pattern list.
- Don't pull visual inspiration from the GitKraken screenshots that were part of the source project. They were excluded from this package on purpose (copyright + real personal data — see `context/provenance.md`); the functional intent they captured is already in `git-client-spec.md`'s prose, which is what to read instead.
- Don't translate or drop the "예제" (example) labeling on any seed/demo content you generate for this product — it's a trust signal specific to this product, not decorative copy.

## Where the real behavior lives

Visual tokens live in this package. Actual git/IPC behavior does not — read `git-backend.cjs`, `electron-main.cjs`, and `preload.cjs` directly (preserved unmodified at the project root) before assuming what an action does or what shape its response takes.

## Design-System Highlights

- Six achromatic tokens only (`brand-spec.md`): `--bg #fafafa`, `--surface #fff`, `--fg #000000`, `--muted #666666`, `--border #e5e5e5`, `--accent #000000` (black, ≤2 uses/screen: graph lane + primary apply action).
- One sans family for both display and body, by deliberate exception (data-density tool); mono is mandatory for every hash/ref/date/number (`branchline.html` `:root`).
- Two type/spacing scales, same tokens: marketing (`--fs-h1` etc.) vs. applied app-shell (`--app-fs-h1` etc., `tokens.css`).
- Applied shell is a fixed 3-pane layout (`appbar` → `sidebar` 216px + `history` fluid + `detail` 292px), not a responsive marketing grid.
- Two shadows total, reserved for floating surfaces only (context menu, native `<dialog>`); everything else on the canvas uses a 1px `--border` hairline.
- Hard interaction rules: detail/diff content never renders before an explicit click; searchable dropdowns split their search input and result list into two nodes instead of using a native `<select>`; `branch` (checked out) and `viewBranch` (graph filter) are always separate state.
