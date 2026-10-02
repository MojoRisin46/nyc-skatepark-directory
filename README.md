# NYC Skatepark Directory

A minimal directory of New York City skateparks built on the existing
website template (same layout, type and colour system).

## Files

    index.html      homepage: the directory (search, filter, sort, map)
    detail.html     THE reusable skatepark detail template (one file, all parks)
    app.js          homepage logic
    skatepark.js    detail-page logic
    shared.js       data loading, slugs, URL building, SEO, map, shared chrome
    styles.css      original styles + a small additive block at the end
    legal.html      legal notice (copied from the English template)
    privacy.html    privacy policy (copied from the English template)
    data/skateparks.json   served copy of the source dataset (not edited)

`data/skateparks.json` is a byte-for-byte copy of the provided
`../3_csv_to_json.json` (same MD5). It exists only so the browser can fetch
the data over HTTP. The original JSON was never modified.

## Routing

Each skatepark has one URL:

    detail.html?park=<slug>     e.g. detail.html?park=martinez-playground-skatepark

`detail.html` is the single reusable template that renders every skatepark.
The slug is the only variable: the template reads it from the `park` query
parameter, finds the matching record and binds the page to it. No
per-skatepark HTML files exist.

This is a static GitHub Pages site, so there is no server rewrite for
pretty `/skateparks/<slug>` URLs — the query-parameter form is the
canonical one. (`skatepark.js` still parses `/skateparks/<slug>` if an old
bookmarked URL is opened directly, but nothing generates those links.)

The site is hosted under a repository subpath
(`https://<user>.github.io/<repo>/`), so all asset, page and data
references are relative to the page (`styles.css`, `shared.js`,
`data/skateparks.json`, `index.html`, `detail.html?park=...`) rather than
root-absolute, which would break under the subpath.

### Serving it locally

No rewrite rules are needed — any static file server works:

    python3 -m http.server 8081

then open http://localhost:8081/ and, for a detail page,
http://localhost:8081/detail.html?park=<slug>.

## What is shown

Only fields that exist for a skatepark are rendered, and no field is invented.
Records vary a lot (the richest has ~59 populated fields, the leanest ~14), so
a park with little recorded simply shows fewer sections. Sections that would be
empty are omitted entirely.

Some source prose is copied verbatim into several fields (`vibe`, `local_scene`,
`safety_notes`, ...). The detail page de-duplicates those paragraphs so the same
text is never printed twice.

## SEO

Per-skatepark, derived from the record itself:

- `<title>` — "Name, Borough — NYC Skateparks"
- `<meta name="description">` — a sentence from the record, or one composed
  from the skatepark's own type/surface/borough/terrain values
- `<link rel="canonical">` and `og:url` — absolute
  `<site-base>detail.html?park=<slug>` (the site base is derived from the
  current URL, so it is correct under a GitHub Pages project subpath)
- `<h1>` — the skatepark name; breadcrumb with `BreadcrumbList` JSON-LD
- `SportsActivityLocation` JSON-LD (name, address, coordinates, hours,
  free access) — optional properties are omitted when the field is absent

A slug that matches no record returns the template with a not-found panel and
`robots: noindex`.

## Notes

- The OpenStreetMap map (Leaflet, plain OSM tiles) follows the English
  template's implementation: homepage markers track the current filters,
  each detail page shows its own skatepark and hides the section when the
  record has no coordinates.
- `legal.html` and `privacy.html` are copied from the English template with
  only the chrome (brand, paths, footer links) adapted; the legal wording is
  unchanged, placeholders included.
- No images or other extra features were added. No external data was used.
- `escapeHtml`/`escapeAttribute` from the template are used for all output.