# science4ai.org

Source for [science4ai.org](https://science4ai.org/): a working guide to what makes
experimental data something an AI model can learn from.

It is a static site. There is no build step and nothing to install.

## Layout

```
index.html            the whole guide (all copy lives here)
404.html              not-found page
assets/css/site.css   styles
assets/js/site.js     the interactive plate, the checklist, navigation, motion
assets/fonts/         IBM Plex Serif, Sans and Mono (SIL Open Font License, see OFL.txt)
assets/img/           favicon, social preview image, affiliation logos
CNAME                 custom domain for GitHub Pages
.nojekyll             tells GitHub Pages to serve the files as they are
robots.txt, sitemap.xml
```

## Preview locally

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Opening `index.html` straight from disk also works.

## Editing

- **Copy.** Edit `index.html`. Each section is marked with a comment. Every factual claim
  carries a numbered reference; if you add a claim, add its source to the list under
  `<section id="references">` and link to it with `<sup><a href="#ref-N">N</a></sup>`.
- **The plate in the hero** is illustrative data generated in `assets/js/site.js`
  (`buildWells`). The wells named in `HITS`, `FIXED` and `FAILS` are fixed by hand; the
  rest come from a seeded generator, so the plate is the same on every visit.
- **Checklist.** The sixteen items are plain HTML in `index.html` under
  `<section id="checklist">`. Marks are kept in the visitor's own browser.
- **Affiliation logos.** The row under the hero (`affil-list` in `index.html`) shows
  institution names as text. To show a logo instead, put the official file in
  `assets/img/logos/` and replace the name inside its link:

  ```html
  <li><a href="https://example.edu/"><img src="assets/img/logos/example.svg" alt="Example University" width="160" height="32"></a></li>
  ```

  The row sits on a dark background, so use each institution's own light or reversed
  logo file, unaltered, and check its brand guidelines first.
- **Styles and scripts.** After changing `assets/css/site.css` or `assets/js/site.js`,
  raise the `?v=` number on their two links in `index.html`. Returning visitors then get
  the new files at once instead of a cached copy.
- **Look.** Colors, type sizes and spacing are the variables at the top of
  `assets/css/site.css`. Dark and light sections share the same components: a section is
  dark with `class="section band-dark"` and light with `band-light` or `band-wash`.

## Hosting

Served by GitHub Pages from the `main` branch of this repository, at the custom domain in
`CNAME`.

DNS for `science4ai.org` (set at the registrar):

| Type  | Name | Value                |
|-------|------|----------------------|
| A     | @    | 185.199.108.153      |
| A     | @    | 185.199.109.153      |
| A     | @    | 185.199.110.153      |
| A     | @    | 185.199.111.153      |
| CNAME | www  | michaelyeah7.github.io |

In the repository's **Settings → Pages**, the custom domain is `science4ai.org` and
**Enforce HTTPS** is on.

## Credits

Typeface: IBM Plex, © IBM Corp., SIL Open Font License 1.1.
Colors in the figures: the viridis colormap from matplotlib (van der Walt and Smith).
