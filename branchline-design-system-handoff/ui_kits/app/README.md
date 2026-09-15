# Branchline applied UI kit

## Structure

```
ui_kits/app/
  index.html   The applied kit itself — one screen today (commit graph / branch compare)
  README.md    This file
```

There is one component file (`index.html`) because the source evidence in `branchline.html` only fully specifies one screen's markup path (the commit-graph/compare view is what the preserved screenshots in `../../assets/` show end to end, including the Sidebar branch tree, appbar toolbar, and detail panel). Add sibling files for other screens as they're designed — see "Extending this kit" below. If a future rebuild splits this into framework components, mirror the existing class names into files like `components/Sidebar.jsx`, `components/CommitRow.jsx`, and `components/DetailPanel.jsx` rather than inventing new naming.

## Usage workflow

1. Open `index.html` directly in a browser, or via `../../preview/applied-ui.html` (same file, in an iframe next to the other preview cards).
2. To build a new applied screen: copy `index.html`, keep the `<style>` block and the `appbar`/`shell`/`sidebar` scaffold untouched, and replace only the `<main class="workspace">` contents.
3. To change a token: edit `../../colors_and_type.css` or `../../tokens.css`, never this file's `<style>` block — the local styles here are structural/layout CSS only, not token values.

## Design notes

`index.html` is a self-contained, browsable reference implementation of Branchline's real 3-pane desktop shell — the same structure and CSS as `branchline.html`'s appbar/sidebar/history/detail layout, trimmed of Electron IPC calls and populated with static example data (all commits, branches, and file names shown are fictional/demo, consistent with the product's own "예제" convention).

It binds `../../colors_and_type.css` and `../../tokens.css` directly — no token is redefined locally.

## What's wired up

- Sidebar branch tree (`LOCAL` → `feature/`/`fix/` folders → leaf branches, `REMOTE`, `TAGS`, `STASHES`) matching `DESIGN.md` §6's folder/leaf alignment rule.
- Branch-compare header (two `branch-select` controls + swap button + ahead/behind summary).
- Commit graph list with fixed grid columns, selected/current row states.
- **Detail-on-select**: clicking a commit row swaps the detail panel content — the panel is never empty-by-omission, it always shows either the placeholder or real content, per `DESIGN.md`'s "select before reveal" rule.
- View tabs (커밋 이력 / 변경 파일) with the underline-on-selected pattern.
- Apply tray footer with a single primary action.
- Toolbar buttons row (Fetch/Push/Branch/Stash/Pop/Terminal) with the icon-over-label pattern.

## Extending this kit

Add new screens as sibling files in this folder (e.g. `worktrees.html`, `pull-requests.html`) rather than growing `index.html` indefinitely — each screen should stay a readable, single-purpose reference. Reuse the `<style>` block's class names verbatim; they are the same class names `branchline.html` uses, so anything that looks right here will look right in the real app. If a screen needs the `#view-overlay`-over-`#content` pattern (Compare/Changes/PR/Worktree screens in the real app), model it as a second `<main>`-level layer with a visible close affordance, not a modal.

Do not wire this kit to a real backend — it exists to demonstrate visual/structural fidelity, not to replace `branchline.html` or the Electron app itself.
