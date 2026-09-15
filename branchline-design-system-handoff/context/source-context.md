# Source Project Context

This design-system workspace was created from an existing OpenDesign project. Treat the copied project files as the primary source evidence for the generated design system.

## Source project

- Source project id: 81ad568f-2eb6-4053-a244-2f360f5e60e2
- Source project name: Web Prototype
- New design-system project id: 4ccedd78-503c-4b07-8a50-cbe70c786732
- New design-system id: user:web-prototype-design-system
- Source skill id: (none)
- Source design system id: (none)

## Source metadata

```json
{
  "kind": "prototype",
  "nameSource": "prompt",
  "scenarioBinding": {
    "schemaVersion": 1,
    "provenance": "legacy_unknown",
    "pluginId": "example-web-prototype",
    "snapshotId": "ea87c264-bcd2-4e3c-9b5a-50f4dd9a189a",
    "boundAt": 1789086505161
  }
}
```

## Copied files

- CLAUDE.md
- image-18.png
- branchline.html
- image-17.png
- image-16.png
- image-15.png
- image-14.png
- image-13.png
- README.md
- git-backend.cjs
- electron-main.cjs
- image-12.png
- image-11.png
- image-10.png
- image-9.png
- image-8.png
- image-7.png
- image-6.png
- preload.cjs
- image-5.png
- image-4.png
- image-3.png
- image-2.png
- image-1.png
- github-backend.cjs
- image.png
- brand-spec.md
- git-client-spec.md
- package-lock.json
- package.json
- check-prototype.cjs

## Skipped files

- (none)

## Generation contract

- Read this file before editing design-system outputs.
- Read the copied files directly from the project workspace; they are source evidence, not generated design-system output.
- Preserve high-signal assets, source examples, UI surfaces, copy, tokens, typography, and interaction patterns from the copied project.
- Generate a reusable OpenDesign design-system package in this same project: DESIGN.md, README.md, SKILL.md, colors_and_type.css, context/provenance, focused preview cards, preserved assets/build/fonts when available, and ui_kits/app/.
- Before final response, run `"$OD_NODE_BIN" "$OD_BIN" tools connectors design-system-package-audit --path . --fail-on-warnings` and fix every actionable issue.
