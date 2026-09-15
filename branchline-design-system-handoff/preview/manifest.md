# Preview manifest

| Card | Demonstrates | Backed by |
|---|---|---|
| `colors-primary.html` | Six oklch color tokens, derived soft surfaces, contrast notes | `colors_and_type.css`, `brand-spec.md` |
| `typography-specimens.html` | Marketing type scale vs. applied app-shell type scale, mono usage rule | `colors_and_type.css`, `branchline.html` `:root` |
| `spacing-tokens.html` | 8-point marketing spacing scale + app-shell layout constants to scale | `tokens.css`, `branchline.html` `.shell`/`.work-split` |
| `radius-shadow.html` | Three radius steps, the two reserved shadows (menu/dialog only) | `tokens.css`, `branchline.html` `#context-menu`/`dialog` rules |
| `components-buttons.html` | Button variants, appbar toolbar buttons, interaction states | `branchline.html` `.btn*`/`.toolbar-btn` |
| `components-forms-tables.html` | Fields, search input, tags/pills, dense data table | `branchline.html` `.field`/`.ds-table`/`.pill`/`.tag` |
| `brand-assets.html` | Wordmark + 8 genuine Branchline demo-mode screenshots, with excluded-assets note | `assets/`, `context/provenance.md` |
| `applied-ui.html` | Live iframe of the full applied interface kit | `ui_kits/app/index.html` |

All cards `@import`/`<link>` `../colors_and_type.css` and `../tokens.css` directly — no token is restated by value inside a preview card.
