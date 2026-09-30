# GRID Brand — as applied in this app

Source: **Brand Guide - GRID as of Jan 28** (PDF, 63 pages). Live preview: `/brand`. Tokens: `app/globals.css`.

## Logo (Guide 3.3–3.10)
- Horizontal logo is the default. Files in `public/brand/` were extracted from the guide's Logo Variations page:
  - `grid-logo-light.png` — gold mark + Nile Blue wordmark, for white surfaces.
  - `grid-logo-dark.png` — gold mark + white wordmark, for Midnight/Nile surfaces (header).
  - `grid-mark.png` — mark only (favicon `app/icon.png`).
- Don't recolor, stretch, rotate or add effects. Replace with vector originals (SVG) when available.

## Colors
| Role | Name | HEX | Pantone | Token |
|---|---|---|---|---|
| Primary | Nile Blue | #1C335E | P 108-16 C | `nile` |
| Primary | Muesli | #BE8562 | P 36-10 C | `muesli` |
| Primary | White | #FFFFFF | P 179-1 C | `surface` |
| Primary | Midnight | #0E192F | 296 C | `midnight` |
| Secondary | Deep Code | #141545 | P 103-16 C | `deep-code` |
| Secondary | Burly Wood | #E2B985 | 7508 C | `burly` |
| Secondary | Iron | #D2D2D2 | P 179-3 C | `iron` |
| Secondary | Black | #000000 | 426 C | — |

Derived for accessibility (not in the guide): `muesli-text` #8C5A3A (Muesli text on white), `nile-soft` #E9EDF5, `muesli-soft` #F7EFE9.
Muesli on white is ~3:1 → accents/large text only (judgment, WCAG 2.2 AA).

## Typography (Guide 4.x)
- Cantata One — headings (`font-display`). Poppins — body/UI (`font-sans`), 400/500/600. Judson (secondary) not used in the app.
- Self-hosted via `@fontsource` (no Google Fonts request).

## Voice (Guide 2.4)
Professional, approachable, empowering, inclusive. Plain status words: "In queue", "Sent · converting", "Learning", "Learned", "Failed".

## UI rules
- One solid Nile Blue button per section; secondary = Nile outline.
- Header: Midnight bar + Burly→Muesli gradient rule (echoes the wave mark).
- Visible 2 px Nile focus ring; every icon button labelled.
