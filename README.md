# Mi Granja Events and Leisure Inc.

Static website for [www.migranjaevents.com](https://www.migranjaevents.com/), served from GitHub Pages with a custom domain. The DNS and domain are managed in Cloudflare.

## Folder structure

```
index.html                          Home (/)
home/index.html                     Redirects /home to /
about/index.html                    About Us
contact/index.html                  Contact form
portfolio-1/index.html              Venues (nav label; path kept)
blog/index.html                     Blog listing
blog/<slug>/index.html              One article per folder
expo-inquiry-post-submit/index.html Thank-you page after the contact form
404.html                            Unknown URLs
CNAME                               www.migranjaevents.com
robots.txt
sitemap.xml
.nojekyll                           Serve files as-is (no Jekyll)
assets/css/styles.css               Colours, type, layout
assets/fonts/                       Self-hosted heading and body fonts (SIL OFL)
assets/js/main.js                   Menu and photo carousel
assets/img/                         Logo, favicon, photos (WebP)
assets/video/                       Venue films
```

Internal links and assets use root paths (`/about/`, `/assets/...`) so they resolve on the custom domain.

## How to edit text

Page copy lives in the HTML file for that page. Change the words in the `<main>` element. Shared chrome (logo, nav, footer, email, address) is repeated at the top and bottom of each page, so update every page if those change.

- Email: `sales@migranjaevents.com`
- Address: Balagbag, Mahabang Kahoy Lejos, Indang, Cavite, Region 4-A (CALABARZON), 4122
- Nav: Home, Venues (`/portfolio-1/`), About Us, Blog (`/blog/`), Contact Us, Inquire (also `/contact/`)

Colours and type are in `assets/css/styles.css`. All colours are CSS custom properties in the `:root` block (`--color-primary`, `--color-accent`, `--color-bg`, and the rest). Font files and their licenses are in `assets/fonts/`.

## How to add a blog article

1. Copy an existing article folder, for example `blog/wedding-planning-checklist/`, to a new kebab-case slug: `blog/your-new-slug/`.
2. Edit `blog/your-new-slug/index.html`: title, description, canonical and Open Graph URLs, the visible heading and body, the date, and the Article JSON-LD (`headline`, `description`, `datePublished`, `dateModified`, `mainEntityOfPage`, `image`).
3. Add a card to the list in `blog/index.html`.
4. Add a `<url>` entry in `sitemap.xml`.

Keep the header and footer the same as the other pages. Do not invent prices, guest counts, reviews, or package details.

## How to publish

GitHub Pages deploys from the `main` branch root. After a change is reviewed, merge it into `main`. The live site is https://www.migranjaevents.com/. Keep the `CNAME` file.

To preview locally, serve the repository root:

```bash
python3 -m http.server 8080
```

Open http://127.0.0.1:8080/

## Notes

- Colours and type are set in `:root`. The official palette is Light Orange `#FFF0D7` (`--color-bg`), White (`--color-bg-raised`), Black `#000000` (`--color-text`, `--color-ink`) for body text, the footer, and dark bands, Brown `#A4381B` (`--color-primary`) for buttons and links, and Gray Brown `#817B30` (`--color-accent`) for decorative lines only. Brown-on-cream, black-on-cream, and white-on-brown or black meet WCAG AA. Gray Brown does not meet AA as small text on cream, so it stays decorative. Headings use self-hosted Bodoni Moda, a free stand-in for the commercial TAN Mon Cheri and Apollo faces in the brand guide. Body text uses official DM Sans, also self-hosted, with `font-display: swap`.
- The home and About pages link to the YouTube films used as section backgrounds on the former site: `https://youtu.be/PrC6FE3ekL4` (home hero), `https://youtu.be/ukEPzZM41xw` (testimonial), and `https://youtu.be/wKI9Yr7GWUU` (About). Full-bleed embeds are not used, because YouTube’s player draws a sign-in wall over the photo when autoplay is blocked. The photos used as the video fallback are the visible backgrounds.
- The two Venues page films are `assets/video/venue-film-1.mp4` and `venue-film-2.mp4`.
- “Submit Another Inquiry” still points at `/expo-inquiry`, which is a 404. The custom `404.html` answers it.
- The contact form uses one required Name field, plus Email, Subject, and Message, and submits through Web3Forms to `sales@migranjaevents.com`.
- Browsers: recent Chrome, Firefox, Safari, and Edge, plus the last two iOS and Android versions. Layout uses Grid, Flexbox, `clamp()`, and `aspect-ratio`.
