# CLAUDE.md

Static GitHub Pages site for the flyorfold paragliding weekend planner. Drafted from a planning
conversation, so anything marked **TODO** needs the repo owner's input. Read the existing repo
structure before changing anything, and follow whatever conventions it already uses.

## What this project is

A tool to help an intermediate (USHPA P3) paraglider pilot in central Ohio decide whether a weekend
flying trip is worth the drive. Pilots here fly two or three times a year and drive up to six hours,
so a wrong call costs gas and a hotel night.

This repo holds only the front end. The backend is the public repo
[FlyOrFold/forecast-log](https://github.com/FlyOrFold/forecast-log) (sibling checkout `../forecast-log`):

- A GitHub Actions job runs daily at 10:30 UTC, pulls the GFS ensemble (`gfs_seamless`, 31 members)
  from Open-Meteo, scores every member against each site's criteria, and commits CSV rows.
- Sites and their criteria live in its `sites.csv` (hand-edited) and `sites.yaml` (generated).
- There is no alert email, no per-model breakdown, and no "marginal" class. Do not build UI for them
  unless the backend adds them.

An earlier plan (Cloud Run, Firestore `forecast_runs`, Saturday-afternoon/Sunday-morning windows and a
"both windows" probability) was replaced by forecast-log. Ignore any reference to it.

## Forecast timeline (built: `forecast.html`)

For one site and one weekend, show how the chance of a flyable Saturday and of a flyable Sunday
changed run by run as the weekend got closer. The point is to show whether a forecast is firming up
or flipping, so the pilot can decide when to commit to a trip.

- X axis: issued date of each run. Y axis: 0 to 100%. One line for Saturday, one for Sunday.
- Lines break across a missing run or a `criteria_version` change (probabilities are not comparable).
- A dashed 70% reference line. There are no alerts to mark.
- Selectors for site and weekend, defaulting to the weekend containing today or the next one.
- The chance that **both** days are flyable is not in the data (it needs per-member results), so
  never compute it from the two daily numbers. The page says so.
- Mobile first, light and dark themes.
- Later: overlay what actually happened, once forecast-log writes `data/outcomes/`.

## Data contract

Fetched at runtime from `https://raw.githubusercontent.com/FlyOrFold/forecast-log/main/` (see
`assets/js/data.js`). Its README is the source of truth for the schema.

`data/forecasts/YYYY-MM.csv`, one file per month of the issued date:

```
issued_date,site,target_date,p_flyable,n_members,criteria_version
2026-10-03,lake-erie-cleveland,2026-10-04,0.62,31,1
```

- `issued_date`: UTC date of the run. `target_date`: site-local date. Lead = target − issued (0–13).
- `p_flyable`: share of members with at least `min_hours` consecutive qualifying hours inside the
  site's flying window (wind direction, speed range, gust limit, rain limit). One model, no weighting.
- Unique key `(issued_date, site, target_date)`. New columns are only ever appended.

`sites.csv` columns: `id,name,lat,lon,timezone,dir_ranges,speed_min,speed_max,gust_max,rain_mm_max,
fly_start,fly_end,min_hours,skip,notes`. A row is forecast only when all criteria columns are filled
and `skip` is not `yes`. Source, verification and access details are currently free text in `notes`;
there are no dedicated columns for them yet.

`?sample` on any page switches to the made-up data in `sample/` (regenerate with
`node sample/generate.mjs`) and shows a "Sample data" badge. Never fall back to sample data silently.

The site never needs credentials: everything it reads is public. Never put service account keys or
any write-capable credential in this repo.

## Rules for content on the site

- **Planning aid, not a go signal.** Any page showing probabilities must say that forecasts are for
  a model grid cell (about 25 km), not the launch, and that the pilot makes the go/no-go call after
  checking live conditions. Do not use "safe to fly" or "go/no-go" wording on the chart itself.
- **Site rules need provenance.** Every wind limit shown should carry its source and whether it is
  verified. Show unverified rules as unverified. Never invent a limit to fill a blank.
- **Show access requirements** where known (club membership, in-person waiver, officer escort).
  Several sites need contact with a club before a first visit.
- **Wind direction is where the wind blows from**, in degrees (N is 0, E 90, S 180, W 270). A window
  can cross north (Lake Erie is 340 to 20 degrees). Never compare with "between min and max".
- **Documented facts only about schools and operators** (ratings, certifications, sanction status,
  with sources). No reviews or opinions about named businesses.
- **No personal data.** Do not publish personal contact details for club officers or the site owner,
  or the owner's home location. Assume anything published from this repo is public.
- **Data attribution and terms.** Forecasts come from Open-Meteo, whose free tier is non-commercial
  only. Add a credit line and check their current attribution requirements.

## Stack and workflow

- **GitHub Pages Jekyll** (`github-pages` gem, Jekyll 3.10). Only use plugins GitHub Pages allows;
  currently `jekyll-feed`, `jekyll-seo-tag`, `jekyll-sitemap`. No GitHub Actions build, no theme
  (`theme: null`); the site has its own layouts and CSS.
- `_layouts/default.html` wraps every page; `_includes/` holds head, header, footer and the news item.
  Nav entries are in `_data/nav.yml`. Pages list their JS modules in front matter (`scripts:`).
- Use `relative_url` for internal links in templates. Pages stay at `*.html` URLs; only posts use the
  `/news/:year/:month/:day/:title/` permalink.
- News = `_posts/YYYY-MM-DD-slug.md`, short Markdown, `title` in front matter.
- Forecast data is fetched client-side by plain ES modules in `assets/js/` (no bundler).
  `boot.js` is the only module with startup side effects (theme, sample badge); the layout loads it
  on every page. Keep the others importable in Node: no top-level `document`/`location` access.
  Shared pieces: `svg.js` (SVG element helper), `day-tile.js` (Saturday/Sunday tiles and sparkline),
  `signedPts()` in `data.js` for "+3 pts" / "−3 pts" (true minus).
- Tests: `node --test tests/` (Node's built-in runner, no packages). Add a test when changing
  parsing, dates, trend words, chart segmentation or distances.
- Local dev: `LANG=en_US.UTF-8 bundle exec jekyll serve --livereload` (also in `.claude/launch.json`).
  Gems install to `vendor/bundle` (git-ignored, excluded from the build).
- Deploy: GitHub Pages builds from `main`, repo root.
- Colours are CSS custom properties at the top of `assets/css/site.css`, each written once as
  `light-dark(light, dark)`. Never add a `prefers-color-scheme` block or a `[data-theme]` copy of a
  rule; add or change a token instead. For a non-colour that differs by theme, key off
  `:root[data-scheme="dark"]` (the theme in use, kept current by `common.js`).
- `site.css` is ordered tokens, base, layout, sky scene, components, then one section per page.
  Some later rules deliberately override earlier ones at equal specificity (comments mark them),
  so put new rules in the section they belong to rather than at the end of the file.
- Sky band sizes (`--band-top`, `--ridge-h`, `--ridge-clear`, `--panel-overlap`, `--glider-w`) live
  together at the top of the sky scene section, with phone values in one media query. Change them
  there; never hard-code a ridge height, hero padding or panel overlap elsewhere.
- Logo: `assets/img/logo.svg` (tile `--logo-blue` #245a96, white-edged canopy). `favicon.svg` is a copy,
  and the PNG icons are rendered from it (commands in the README); regenerate all of them together.
  Print uses the one-colour marks `logo-mono-white.svg` / `logo-mono-navy.svg`.
- Brand tokens are documented on the Brand page. `brand.html` is a live style
  guide: swatch values are read from the CSS at runtime, and `_data/brand.yml` only names and
  explains each token. Add new tokens there so they show up. Chart series colors (Sky, Canopy) were validated for color-blind separation in both
  themes; re-validate if they change.
- The Sites map uses Leaflet 1.9.4 from cdnjs with SRI hashes, and OpenStreetMap tiles (credit
  line required). It is the only third-party script; keep the integrity hashes if you upgrade it.
- A viewer can set a starting point for distances (`assets/js/location.js`). It lives only in
  that browser's localStorage, rounded to 0.1°, and must never go into a URL, a request, or the repo.
