# Provenance

What every copied source file became in this design-system package, and why.

## Tokens & visual language

- `brand-spec.md` (root, preserved as-is) is the authoritative token source — six oklch tokens + font stacks, already locked to the "tech-utility" direction. `colors_and_type.css` and `tokens.css` are that spec made reusable/importable; no value was invented, only converted (oklch → hex reference in `DESIGN.md`'s color table) or derived (`color-mix` soft surfaces already present in `branchline.html`).
- `branchline.html` `<style id="model">`'s block (lines 9–453) is the single source for spacing, radius, component CSS, and the two type scales (marketing vs. applied app-shell) documented in `DESIGN.md` §3–6.

## Genuine Branchline screenshots (kept in `assets/`)

These are the product's own demo-mode UI (Korean labels, "예제" tags, the Branchline wordmark, `branchline-desktop` repo name) and are safe to reuse as design-system reference:

| File | Source | Shows |
|---|---|---|
| `screenshot-commit-graph-full.png` | `image-17.png` | Full commit-graph page: filter bar, graph list, detail placeholder, "예제 커밋 그래프" caption |
| `screenshot-commit-graph-header.png` | `image-9.png` | Page header + branch/scope selects for the same screen |
| `screenshot-wordmark-card.png` | `image-10.png` | Wordmark + workspace label card |
| `screenshot-branch-filter-dropdown.png` | `image-14.png` | Custom branch-filter dropdown (split search input + list pattern) |
| `screenshot-branch-filter-summary.png` | `image-15.png` | Branch-filter summary line typography |
| `screenshot-branch-folder-tree.png` | `image-6.png` | Sidebar `feature/`/`fix/` folder tree crop |
| `screenshot-sidebar-tree.png` | `image-18.png` | Sidebar LOCAL/REMOTE tree with counts |
| `screenshot-toolbar-buttons.png` | `image-11.png` | Appbar toolbar buttons (Fetch/Push/Branch/Stash/Pop/Terminal) |
| `branchline-mark.svg` | extracted from `branchline.html` inline `<svg class="mark">` | The literal wordmark glyph, recolored from `currentColor`/`var(--surface)` to its computed hex equivalents for standalone use |

## Excluded images: GitKraken competitive reference

`image.png`, `image-1.png`, `image-2.png`, `image-3.png`, `image-4.png`, `image-5.png`, `image-7.png`, `image-8.png`, and `image-16.png` are screenshots of **GitKraken** (a different, commercial product), not of Branchline. They were almost certainly captured to write the functional target list in `git-client-spec.md` ("GitKraken 12.4.1 기준 기능 목표 명세"). They also contain real, non-fictional data — an internal company name ("INNOGRID"), real employee names, and real internal ticket IDs (QATAB-/CMPTEAM- prefixes).

They are **not** included in `assets/`, `preview/`, or `ui_kits/app/`, and are not used as visual source material anywhere in this package, for two independent reasons:

1. **Copyright / anti-cloning**: this design system must not encode another company's distinctive UI patterns as something to reproduce.
2. **Privacy**: the screenshots contain real personal names and real internal project data that don't belong in a redistributable design-system package.

They remain at the project root exactly as copied (unmodified, untouched) so the raw evidence isn't destroyed — but the functional intent they informed is already captured in `git-client-spec.md`'s prose feature table, which is what this package treats as authoritative for "what Branchline should eventually do," not the screenshots themselves.

## Preserved implementation source (kept at project root, outside `context/`)

Per the generation contract, substantial implementation code stays as real, readable examples rather than being stubbed:

- `branchline.html` — the entire frontend (tokens, components, state, render logic)
- `git-backend.cjs`, `electron-main.cjs`, `preload.cjs`, `github-backend.cjs` — the real Electron/Node backend
- `check-prototype.cjs`, `package.json`, `package-lock.json` — build/test scaffolding
- `git-client-spec.md` — the GitKraken-benchmarked feature target list (G01–G45)
- `CLAUDE.md` — prior agent handoff notes with architecture rules folded into `DESIGN.md` §5–6

## Renamed for package-structure reasons

- The original root `README.md` (a 55KB chronological session log) is preserved verbatim at `context/source-readme.md`. The root `README.md` in this package is a newly written design-system guide, since the two documents serve different readers and the design-system README must describe *this package*, not the app's build history.
