# flyorfold.github.io

The Fly or Fold website: a paragliding forecast planner that shows how the chance of a flyable day
at each site changes run by run as the day gets closer.

A GitHub Pages Jekyll site (the `github-pages` gem: Jekyll 3 plus GitHub's allowed plugins
`jekyll-feed`, `jekyll-seo-tag` and `jekyll-sitemap`). GitHub builds it on every push to `main`.
Layouts and shared markup are in `_layouts/` and `_includes/`; the forecast charts are plain JavaScript
modules in `assets/js/` that run in the browser.

## Pages

| Page | What it shows |
|---|---|
| `index.html` | Landing page: a card per site (the ones ticked on the Sites page, else the 6 nearest, else 6 by name) with distance, a today tile and a two-week strip (3 days back, 10 ahead) of each day's newest forecast, how it works, latest news |
| `forecast.html` | Timeline for one site and day, optionally compared with a second day (`?site=<id>&day=YYYY-MM-DD&compare=YYYY-MM-DD`), the two-week strip, and the site's limits |
| `sites.html` | Every row of the site list, by name, with limits, sources and whether it is forecast; tick sites to show on the home page; set a starting point (your location, a map pick or typed coordinates) for distances |
| `news.html` | All news items (posts), with an RSS feed at `/news/feed.xml` |
| `brand.html` | Logo, color tokens, type and voice rules |

## Where the data comes from

The pages fetch from the public [FlyOrFold/forecast-log](https://github.com/FlyOrFold/forecast-log) repo
through `raw.githubusercontent.com`, so there is nothing to deploy when new data lands:

- `sites.csv`: site names, coordinates, limits and notes.
- `data/forecasts/YYYY-MM.csv`: the daily log, one file per month of the issued date. The schema is
  in that repo's README. The pages load the current month and the one or two before it.

Raw files are cached for about 5 minutes, so a new run can take a few minutes to show up.

### Sample data

Add `?sample` to any URL (for example `forecast.html?sample`) to see the pages with made-up data:
the site list in `sample/sites.csv` and forecasts generated in the browser by `assets/js/sample.js`,
relative to today, so every day on the pages has runs. Past runs never change from day to day, like
the real log. Every page shows a **Sample data** badge while it's on.

### Caching

GitHub Pages caches every file for 10 minutes. So that a deploy never mixes new HTML with old
scripts, the layout adds `?v=<commit>` to the stylesheet and page scripts, and an import map
(`_includes/import-map.html`) gives every module in `assets/js/` the same version. New modules are
picked up automatically.

## Running locally

Needs Ruby 3.x and Bundler. Once:

```bash
bundle config set --local path vendor/bundle
```

```bash
bundle install
```

Then serve with live reload at <http://localhost:4000/>:

```bash
LANG=en_US.UTF-8 bundle exec jekyll serve --livereload
```

(`LANG` avoids a Sass encoding error in the older Jekyll that GitHub Pages pins.)

## Tests

The pure logic (CSV parsing, dates, day history, trend words, line breaks in the chart,
distances, typed coordinates) has tests that use Node's built-in runner, with no packages to install:

```bash
node --test tests/
```

A pre-push hook in `.githooks/` runs them before every push and stops the push if any fail.
Turn it on once per clone:

```bash
git config core.hooksPath .githooks
```

## Posting news

News items are Jekyll posts. Add a file named `_posts/YYYY-MM-DD-short-slug.md`:

```markdown
---
title: Added Hyner View
topic: site
---
Hyner View (PA) is now in the forecast log. See the [site page](/sites.html#hyner-view).
```

Keep it to a sentence or two. Markdown works. `topic` is optional: one of `site`, `scoring`, `data`
or `website` (defined in `_data/topics.yml`); the news page can filter by it. The home page shows the latest three, `news.html`
shows all of them, and each gets its own page and a feed entry.

## Brand

Colors live as CSS custom properties at the top of `assets/css/site.css`, with separate dark-mode
values. `brand.html` documents them. The logo source is `assets/img/logo.svg` (tile `#245a96`);
`favicon.svg` is a copy of it, and the PNG icons were rendered from it:

```bash
rsvg-convert -w 512 -h 512 assets/img/logo.svg -o assets/img/icon-512.png
```

`apple-touch-icon.png` uses square corners (iOS rounds them itself):

```bash
sed 's/rx="14" //' assets/img/logo.svg | rsvg-convert -w 180 -h 180 -o apple-touch-icon.png
```

For print in a single ink (poker chips, stamps, stickers), use `assets/img/logo-mono-white.svg` or
`logo-mono-navy.svg`. The Brand page explains when to use which.

## Content rules

See `CLAUDE.md`. In short: this is a planning aid, never a go signal; site limits show their source
and are marked unverified until confirmed; no personal contact details; credit Open-Meteo.

## License

Code is under the [MIT License](LICENSE). The flyorfold name, logo and icons
(`assets/img/logo*.svg`, `assets/img/icon-*.png`, `favicon.svg`, `favicon-32.png` and
`apple-touch-icon.png`) are not licensed under it. All rights reserved; please don't use them for a
fork in a way that suggests it is this project. Forecast data shown on the site comes from
[FlyOrFold/forecast-log](https://github.com/FlyOrFold/forecast-log) and is licensed there.
