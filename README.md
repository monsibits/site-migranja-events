# Mi Granja Events and Leisure Inc.

Static website for [www.migranjaevents.com](https://www.migranjaevents.com/). The live domain is served by GitHub Pages. This repository is the source.

## Folder structure

- `_src/partials/` — shared head, header, and footer
- `_src/pages/` — one template per page
- `scripts/build.py` — writes HTML into the site root
- `assets/css/` — `styles.css` imports tokens, base, layout, and components
- `assets/js/main.js` — menu, motion, form intent, and gallery lightbox (all progressive)
- `assets/img/`, `assets/fonts/`, `assets/video/`

## Edit and publish

1. Change copy in the matching file under `_src/pages/`. Shared chrome lives in `_src/partials/`.
2. Brand colours and type are in `assets/css/tokens.css`.
3. Run `python3 scripts/build.py` from the repository root.
4. Commit the templates and the built HTML together.

To preview locally:

```bash
python3 -m http.server 8080
```

Open http://127.0.0.1:8080/

## Notes

- The site is mostly white, with a very light cream `#FFF8EC` on alternating sections. Brown `#A4381B` is reserved for primary buttons, links, and small accents. Body text is a deep warm near-charcoal `#2E2420` (not black) that meets WCAG AA on white and cream. The footer is light. Gray Brown `#817B30` is not used.
- Headings use self-hosted Lora (weight 600), a readable serif stand-in for the commercial TAN Mon Cheri and Apollo faces in the brand guide. Body text uses official DM Sans at 18px / 1.65, also self-hosted, with `font-display: swap`.
- The contact form uses Web3Forms (`sales@migranjaevents.com`) and can request an ocular visit, a quote, or a general inquiry, with an optional preferred date. The redirect is `/expo-inquiry-post-submit/`.
- `/home/` redirects to `/`. `/portfolio-1/` redirects to `/venues/`.
- Browsers: recent Chrome, Firefox, Safari, and Edge, plus the last two iOS and Android versions. Layout uses Grid, Flexbox, `clamp()`, and `aspect-ratio`.
