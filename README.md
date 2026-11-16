# Mi Granja Events and Leisure Inc.

Static copy of [migranjaevents.com](https://www.migranjaevents.com) for a GitHub Pages preview. This is a development preview: every page sends `noindex, nofollow`, and `robots.txt` disallows the whole site.

Published URL (after merge to `main`): https://monsibits.github.io/site-migranja-events/

## Folder structure

```
index.html                          Home (/)
home/index.html                     Redirects /home to /
about/index.html                    About Us
contact/index.html                  Contact form
portfolio-1/index.html              Venues (nav label; path kept)
expo-inquiry-post-submit/index.html Thank-you page
404.html                            Unknown URLs
robots.txt                          Disallow: /
sitemap.xml
.nojekyll                           Serve files as-is (no Jekyll)
assets/css/styles.css
assets/js/main.js                   Menu and photo carousel
assets/img/                         Logo, favicon, photos (WebP)
assets/video/                       Venue films (re-encoded from Squarespace HLS)
```

Internal links and assets use the `/site-migranja-events/` prefix so they resolve on GitHub Pages project sites. There is no `CNAME` file.

## How to edit text

Page copy lives in the HTML file for that page. Change the words in the `<main>` element and keep the heading text the same unless the live site changes. Shared chrome (logo, nav, footer, email, address) is repeated at the top and bottom of each page, so update every page if those change.

- Email: `sales@migranjaevents.com`
- Address: Balagbag, Mahabang Kahoy Lejos, Indang, Cavite, Region 4-A (CALABARZON), 4122
- Nav: Home, Venues (`/portfolio-1/`), About Us, Contact Us, Inquire (also `/contact/`)

Colours and type are in `assets/css/styles.css` (`--accent`, `--font-display`, `--font-body`).

## How to publish

GitHub Pages is already set to deploy from the `main` branch root (legacy Pages, not a workflow). Merge this branch into `main`. The site is then served at https://monsibits.github.io/site-migranja-events/. Do not add a `CNAME` or change DNS from this repository.

To preview locally, serve the repository so that path exists:

```bash
cd /path/to/parent
ln -s /path/to/this/repo site-migranja-events
python3 -m http.server 8080
```

Open http://127.0.0.1:8080/site-migranja-events/

## TODO

- The Squarespace theme names the body font `miller-display`, but the public site has an empty Typekit id, so that font file is not available. Body text uses a Georgia serif stack. Headings use Helvetica Neue / Arial, as on the live site.
- Olive `#7f8164` is shifted to `#72745a` so white text on olive, and olive text on white, meet WCAG AA.
- The live site uses three YouTube films as section backgrounds: `https://youtu.be/PrC6FE3ekL4` (home hero), `https://youtu.be/ukEPzZM41xw` (testimonial), and `https://youtu.be/wKI9Yr7GWUU` (About). Those pages link to the films. Full-bleed embeds are not used, because YouTube’s player draws a sign-in wall over the photo when autoplay is blocked. The live sections also set playback speed to 0.5, which a standard embed cannot set. The photos Squarespace uses as the video fallback are the visible backgrounds.
- The two Venues page films were downloaded from Squarespace HLS (AES-128) and saved as `assets/video/venue-film-1.mp4` (about 69 seconds) and `venue-film-2.mp4` (about 107 seconds), scaled to 1280px wide. Originals were 1914×1080 and 1920×1080.
- “Submit Another Inquiry” still points at `/expo-inquiry`, which is a 404 on the live site and here. The custom `404.html` answers it.
- The contact form on the live site splits Name into First Name and Last Name. This form uses one required Name field, plus Email, Subject, and Message, as specified for the Web3Forms replacement.
