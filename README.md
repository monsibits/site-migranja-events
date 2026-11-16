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

- The palette follows a 60/30/10 split: Light Orange `#FFF0D7` for grounds, White for raised surfaces, and Brown `#A4381B` for buttons, links, and accents. Text and the footer use a deep warm brown `#3B1F14` (not black) that meets WCAG AAA on cream and white. Gray Brown `#817B30` is decorative only.
- Headings use self-hosted Bodoni Moda, a free stand-in for the commercial TAN Mon Cheri and Apollo faces in the brand guide. Body text uses official DM Sans, also self-hosted, with `font-display: swap`.
- The contact form uses Web3Forms (`sales@migranjaevents.com`) and can request an ocular visit, a quote, or a general inquiry, with an optional preferred date. The redirect is `/expo-inquiry-post-submit/`.
- `/home/` redirects to `/`. `/portfolio-1/` redirects to `/venues/`.
- Films used as references on the former site remain as YouTube links, not full-bleed embeds, because the YouTube player can draw a sign-in wall over the photo when autoplay is blocked: `https://youtu.be/PrC6FE3ekL4`, `https://youtu.be/ukEPzZM41xw`, and `https://youtu.be/wKI9Yr7GWUU`.
- Browsers: recent Chrome, Firefox, Safari, and Edge, plus the last two iOS and Android versions. Layout uses Grid, Flexbox, `clamp()`, and `aspect-ratio`.
