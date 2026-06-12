# PWA Icons

The real brand icons are now in place. All three slots below resolve to the Bantu Niaga square mark (the bag-shop-chart icon, no wordmark) and are referenced from `public/manifest.json`:

| File | Size | Purpose |
|------|------|---------|
| `icon-192.png` | 192 × 192 (source) | Standard PWA icon |
| `icon-512.png` | 512 × 512 (source) | Full-size PWA icon |
| `icon-maskable.png` | 512 × 512 (source) | Android maskable icon (safe zone: center 80%) |

The favicon / Apple touch icon source lives one level up at `public/icon.png` and is wired through `app/layout.tsx` → `metadata.icons`.

The app shells (desktop sidebar, mobile header, sign-in page) render the icon-only mark + the wordmark "Bantu Niaga" as Tailwind text — no image of the full lockup is loaded in chrome. This avoids halo artefacts when the source is a flattened JPEG without alpha. The horizontal lockup files at `public/brand/` (`logo.png` flood-filled, `logo-original.jpg` raw) are kept for future use in marketing surfaces (public landing, transactional emails, etc.) but are not referenced by any current page.

To swap in pre-sized exports later, replace the files in place — no code changes required.
