# Branchline Design System

> Category: Project Design System (generated from an existing OpenDesign project)
> Surface: web / Electron desktop
> Source project: "Web Prototype" (`81ad568f-2eb6-4053-a244-2f360f5e60e2`), reused in place as `4ccedd78-503c-4b07-8a50-cbe70c786732`

## 0. Product context

Branchline is a real, runnable **Electron Git client** (`npm start` → `electron-main.cjs`). It has two modes:

- **Demo mode** — an in-memory example commit graph so the UI is explorable with no repo open.
- **Real mode** — opens an actual local repository and shells out to the system `git` CLI (`execFile`, no shell, argument-array only) via `git-backend.cjs`.

The product's job is narrower than a general Git GUI: **branch comparison** is the primary task (`compareRefs`, reachability-based ahead/behind), backed by a full commit-graph browser, working-tree change review, merge/rebase/conflict handling, worktrees, submodules, LFS, and a read-only GitHub PR list. It is a data-dense professional tool, evaluated against GitKraken's feature surface (`git-client-spec.md`, G01–G45) but with its own restrained visual language — not a clone of GitKraken's UI.

Audience: developers who live in a Git history view all day. Design decisions optimize for scan speed and information density over ornament.

## 1. Visual Theme & Atmosphere

Direction: **tech-utility**, locked in `brand-spec.md`. A neutral white workspace, white panels, black text, and a black accent reserved for the commit-graph lane and the primary "apply" action.

- No gradients, no decorative imagery. The one deliberate visual flourish is the commit graph itself — parent/child lines rendered on a `<canvas>`/SVG layer — nothing competes with it.
- Korean UI copy throughout (`lang="ko"`), explicit "예제" (example) labeling on demo content, visible keyboard focus rings, and designed empty states are non-negotiable product conventions, not incidental choices — see `git-client-spec.md` §"두 브랜치 비교의 정확한 의미" and `CLAUDE.md`.
- Two rendering contexts share one token set: a marketing/editorial scale (landing/docs pages, `.hero`, `.stat`, `.quote`) and a tightened in-app scale (the actual Electron shell). Both bind to the same six color tokens; only the type/spacing scale steps down for the app shell. See `colors_and_type.css` and `tokens.css` for both scales side by side.

## 2. Color

Six achromatic tokens, in `colors_and_type.css`. Never introduce a raw hex value outside that file's derivation comments.

| Token | Value | Hex (for reference) | Role |
|---|---|---|---|
| `--bg` | `#fafafa` | `#fafafa` | App canvas, sidebar background |
| `--surface` | `#ffffff` | `#ffffff` | Cards, panels, inputs, workspace |
| `--fg` | `#000000` | `#000000` | Primary text and icons |
| `--muted` | `#666666` | `#666666` | Secondary text, meta, timestamps |
| `--border` | `#e5e5e5` | `#e5e5e5` | Hairlines, dividers, input borders |
| `--accent` | `#000000` | `#000000` | Commit-graph lane, primary apply/commit actions — used at most twice per screen |

Derived-only surfaces (never hand-authored elsewhere): `--accent-soft: color-mix(in oklch, var(--accent) 14%, transparent)` for pills/badges/active-file markers; `--fg-soft: color-mix(in oklch, var(--fg) 6%, transparent)` for hover backgrounds and diff-add tint.

State colors are not a separate palette — they're the same six tokens recombined: selected row = `--fg-soft` background + `box-shadow: inset 3px 0 var(--fg)`; diff add = `--fg-soft` background; diff delete = `--border` background; disabled = `opacity: .45–.45` on the existing foreground, never a new gray.

## 3. Typography

Single sans family for both display and body — an intentional exception to the "display ≠ body" rule, justified because this is a data-density tool (`brand-spec.md`): `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif`. Monospace (`'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace`) is mandatory, not optional, for every hash, ref name, byte count, date, and diff line.

Two scales share the same families:

- **Marketing scale** (landing/docs use of this system): h1 `clamp(44px,6vw,76px)`, h2 `clamp(32px,4vw,48px)`, h3 `22px`, lead `19px`, body `16px`, meta `13px`.
- **Applied app-shell scale** (what Branchline itself runs): h1 `26px`, h2 `19px`, h3 `15px`, body `13px`, meta `11px`, micro `10px`, with tighter `letter-spacing: -0.015em` — see `--app-fs-*` tokens.

## 4. Spacing

8-point grid for marketing surfaces (`--gap-xs` 8 → `--gap-2xl` 96, `tokens.css`). The applied app shell has its own tighter constants layered on top, because it is a 3-pane desktop tool, not a scrolling page: `--app-sidebar-w: 216px`, `--app-detail-w: 292px`, `--app-row-h: 32px` per commit row, `--app-control-h: 44px` minimum click target (buttons/selects/inputs all clamp to this — a deliberate touch-target floor even on desktop, per `git-client-spec.md`).

Radius: `--radius: 10px` / `--radius-lg: 16px` on marketing surfaces; the app shell uses a tighter `--app-radius: 7px` on cards, dropdowns, and the branch-select control. No elevation system beyond two shadows, reserved for floating surfaces only: `.shadow-menu` (context menus/dropdowns) and `.shadow-dialog` (native `<dialog>` modals). The canvas itself never casts a shadow — panel separation is always a 1px `--border` hairline.

## 5. Layout & Composition

Two structurally different layouts share one token set:

1. **Marketing/editorial** (`.container` 1120px, `.grid-2/3/4`, `.hero`, `.log-row`) — collapses to single column under 920px.
2. **Applied product shell** (`ui_kits/app/index.html`) — a fixed 3-pane desktop layout:
   - `.appbar` (58px) — wordmark, active repo tab, primary actions (Fetch/Push/Branch/Stash/Pop/Terminal), command palette trigger (⌘K).
   - `.shell` = `.sidebar` (216px, LOCAL/REMOTE branch tree + STASHES/TAGS/WORKTREES) + `.workspace` (fluid).
   - `.workspace` = `.work-split` = `.history` (commit graph + list, fluid) + `.detail` (292px, fixed).
   - Detail/changed-files content is **never shown before a row is clicked** — this "select before reveal" rule applies to every new panel added to the system (`CLAUDE.md` rule 6).
   - `#content` (backdrop, always the commit graph) vs `#view-overlay` (front layer, covers `#content` for Compare/Changes/PR/Worktree screens) is a hard architectural split — these are full covering screens with a close action, not modals.
   - `branch` (checked-out HEAD) vs `viewBranch` (graph filter) are different pieces of state; a single click changes the filter, a double-click also navigates, and only the context-menu "체크아웃" action performs a real `git checkout`. Do not collapse these three.
3. Responsive steps for the app shell: sidebar narrows to 188px at ≤1150px, 170px at ≤920px (detail pane drops below history), and becomes a horizontal icon-only tab bar at ≤600px.

## 6. Components

Documented and demoed in `preview/components-*.html` and applied in `ui_kits/app/`:

- **Buttons** — `.btn-primary` (black `--accent` background, white `--surface` text for AA contrast), `.btn-secondary` (outlined), `.btn-ghost` (text-only, accent on hover), `.toolbar-btn` (icon-over-label, border-less, background only on hover/active — the appbar's Fetch/Push/Branch/Stash/Pop/Terminal group). One primary action per view.
- **Sidebar branch tree** — `buildBranchTree`/`renderBranchNode` recursively group `feature/`, `fix/` folders via `<details>/<summary>`; leaf branches get a `.tree-leaf` indent so they align with folder children in the same visual column (`CLAUDE.md` rule 4).
- **Custom dropdown/filter menu** — `openBranchFilterMenu()` reuses `#context-menu` with a separate search `<input>` node and result `<ul>` so typing never loses focus (`CLAUDE.md` rule 5). Any new searchable dropdown must reuse this split-node pattern, not a native `<select>`.
- **Commit graph + row** — fixed grid columns (`checkbox 34px / graph 90–115px / message 1fr / date 170–190px`), a resizable column edge (`.col-resizer`), `.commit-row.selected` / `.current` states via background + inset box-shadow (never a border that shifts layout).
- **Detail panel** — `renderDetail(activeId)`; author avatar as initials-in-circle, `<dl>` metadata grid, inline small diff (`.diff-small`, mono, add/delete tint from the two derived soft tokens only).
- **Apply tray** — sticky footer bar pattern for "N changes selected → apply", primary button pinned right, count `<small>` pinned left.
- **Forms/tables** — `.field` + `.input`/`.textarea` (accent focus ring via `--accent-soft` outline), `.ds-table` for dense data with mono numeric columns right-aligned.
- **Dialogs** — native `<dialog>`, `.shadow-dialog`, blurred backdrop tinted from `--fg`, never a hand-rolled modal div.

## 7. Motion & Interaction

Minimal and functional only: `transform: translateY(1px)` on button `:active`, `0.15s ease` background/border transitions on hover, a `0.16s` `overlayIn` keyframe (opacity+translateY) when a `.view-overlay` screen opens. No entrance animation on the commit graph or list rows — history must render instantly. Every interactive control gets `:focus-visible { outline: 2px solid var(--fg); outline-offset: 3px }` (accent outline inside context menus/inputs specifically); this is enforced everywhere, including custom dropdown options and column resize handles.

## 8. Voice & Brand

Korean UI copy, direct and operational — imperative labels ("체크아웃", "브랜치 만들기"), not marketing tone. Numbers and technical identifiers stay in English/mono (`SHA`, `origin/develop`, `⌘K`). Example/seed data is always explicitly tagged "예제" so users never mistake demo content for a real repository. Empty states name what's missing and what to do next (`.empty strong` + supporting line), never a bare "no data."

## 9. Anti-patterns

- Do not add a second accent color or a gradient anywhere — the accent is spent on the commit-graph lane and the primary apply action only.
- Do not reintroduce GitKraken's literal UI (toolbar arrangement, panel chrome, iconography) — those screenshots exist in this workspace only as **competitive reference for the functional spec** (`git-client-spec.md`), not as visual source material; see `context/provenance.md`.
- Do not show detail/diff content before a row is explicitly selected.
- Do not use a native `<select>` for anything that needs search — reuse the `#context-menu` split search+list pattern.
- Do not drop the `--app-control-h: 44px` floor on any clickable control, even in dense table rows.
- Do not add drop shadows to canvas-level panels; hairlines only. Shadows are reserved for menus and the native dialog.
- Do not translate seed/example data out of Korean or remove the "예제" tag — it's a trust signal, not filler copy.
