# PWA Icons

The real brand icons are now in place. All three slots below resolve to the Bantu Niaga square mark (the bag-shop-chart icon, no wordmark) and are referenced from `public/manifest.json`:

| File | Size | Purpose |
|------|------|---------|
| `icon-192.png` | 192 × 192 (source) | Standard PWA icon |
| `icon-512.png` | 512 × 512 (source) | Full-size PWA icon |
| `icon-maskable.png` | 512 × 512 (source) | Android maskable icon (safe zone: center 80%) |

The favicon / Apple touch icon source lives one level up at `public/icon.png` and is wired through `app/layout.tsx` → `metadata.icons`. The horizontal lockup used in the app shell headers lives at `public/brand/logo.png`.

To swap in pre-sized exports later, replace the files in place — no code changes required.
