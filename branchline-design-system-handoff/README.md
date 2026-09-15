# Branchline Design System

A reusable OpenDesign package generated from the **Branchline** prototype — a real, runnable Electron Git client built with OpenDesign's Web Prototype skill. This package documents and re-packages that product's actual visual language, tokens, components, and applied UI so future work (in this project or new ones) can build on it without re-deriving it from `branchline.html`.

## Product Overview

Branchline is a branch-comparison-first Git GUI, generated from and reusing the source OpenDesign project's own repository as evidence (`context/source-context.md`). It runs two modes:

- **Demo mode** — explorable in-memory example commit graph, no repo required.
- **Real mode** — opens a local repository and drives the real system `git` CLI through Electron IPC (`git-backend.cjs` → `electron-main.cjs` → `preload.cjs` → `branchline.html`).

Primary surfaces: a 3-pane desktop shell (sidebar branch tree → commit graph/list → detail panel), a branch-compare screen, working-tree change review, merge/rebase/conflict resolution, worktrees/submodules/LFS management, and a read-only GitHub PR list. See `DESIGN.md` §0 for the full product context and `git-client-spec.md` for the complete G01–G45 feature-target table this product is benchmarked against.

## Package contents

Preserved brand assets live under `assets/branchline-mark.svg` and `assets/screenshot-*.png` — the only visual source material this package treats as reusable (see `context/provenance.md` for what was deliberately left out and why).

```
DESIGN.md                  Full design system: color, type, spacing, layout, components, motion, voice, anti-patterns
SKILL.md                   Agent-facing instructions for reusing this system
colors_and_type.css        The six oklch tokens + both type scales, ready to @import
tokens.css                 Spacing, radius, and app-shell layout constants
brand-spec.md              Original locked token spec (source of truth for colors_and_type.css)
git-client-spec.md         GitKraken-benchmarked feature target list (G01–G45)
CLAUDE.md                  Prior agent handoff notes (architecture rules, "actual implementation status")

context/
  source-context.md        Handoff manifest from the source OpenDesign project
  provenance.md             What every source file became, and why (incl. what was deliberately excluded)
  source-readme.md          Original 55KB session log (moved here to make room for this README)

assets/
  branchline-mark.svg        Extracted, preserved product wordmark glyph (brand asset)
  screenshot-*.png            8 genuine Branchline demo-mode screenshots, captured from the source component and preserved as brand/runtime evidence (see provenance.md for what each shows)

preview/
  colors-primary.html         Six color tokens + derived soft surfaces, swatches with contrast notes
  typography-specimens.html   Marketing scale vs. applied app-shell scale, side by side
  spacing-tokens.html         8-point marketing grid + app-shell layout constants, to scale
  radius-shadow.html          Radius pairs and the two reserved shadows
  components-buttons.html     Button variants + toolbar buttons, all interactive states
  components-forms-tables.html  Fields, dense table, tags/pills
  brand-assets.html           Wordmark, mark, and the preserved screenshots rendered inline
  applied-ui.html             Embeds ui_kits/app/index.html live in an iframe
  manifest.md                 What each card demonstrates and which source file backs it

ui_kits/app/
  index.html                  Applied interface kit: Branchline's real 3-pane shell, wired with example data
  README.md                   How to extend the kit

branchline.html, git-backend.cjs, electron-main.cjs, preload.cjs,
github-backend.cjs, check-prototype.cjs, package.json, package-lock.json
                              Preserved real implementation (unchanged from the source project)
```

## Preview manifest

| Card | Demonstrates | Backed by |
|---|---|---|
| `preview/colors-primary.html` | Six oklch color tokens, derived soft surfaces, contrast notes | `colors_and_type.css`, `brand-spec.md` |
| `preview/typography-specimens.html` | Marketing type scale vs. applied app-shell type scale, mono usage rule | `colors_and_type.css`, `branchline.html` `:root` |
| `preview/spacing-tokens.html` | 8-point marketing spacing scale + app-shell layout constants to scale | `tokens.css`, `branchline.html` `.shell`/`.work-split` |
| `preview/radius-shadow.html` | Three radius steps, the two reserved shadows (menu/dialog only) | `tokens.css`, `branchline.html` `#context-menu`/`dialog` rules |
| `preview/components-buttons.html` | Button variants, appbar toolbar buttons, interaction states | `branchline.html` `.btn*`/`.toolbar-btn` |
| `preview/components-forms-tables.html` | Fields, search input, tags/pills, dense data table | `branchline.html` `.field`/`.ds-table`/`.pill`/`.tag` |
| `preview/brand-assets.html` | Wordmark + 8 genuine Branchline demo-mode screenshots, with excluded-assets note | `assets/`, `context/provenance.md` |
| `preview/applied-ui.html` | Live iframe of the full applied interface kit | `ui_kits/app/index.html` |

(Full detail in `preview/manifest.md`.)

## Reuse Workflow

1. **Start with `DESIGN.md`** for the narrative system, then bind `colors_and_type.css` + `tokens.css` verbatim into any new artifact's `:root`.
2. **Check `preview/`** for what each token/component actually looks like before writing new markup — `manifest.md` maps each card to its source.
3. **Copy structure from `ui_kits/app/index.html`** rather than re-deriving the 3-pane shell from `branchline.html` — it's the same CSS, trimmed to a browsable, self-contained reference.
4. **Read `context/provenance.md` before touching `assets/`** — it explains which source screenshots were kept (genuine Branchline UI) and which were deliberately excluded (GitKraken competitive reference containing real personal/company data — see that file for the full reasoning).
5. For anything beyond visual tokens — actual git behavior, IPC channel shapes, backend function names — read `git-backend.cjs`/`electron-main.cjs`/`preload.cjs` directly; they're preserved unmodified and are the real implementation, not a mock.
