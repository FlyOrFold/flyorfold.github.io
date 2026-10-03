# flyorfold.github.io

The Fly or Fold website: a paragliding weekend planner that shows how the chance of a flyable day
at each site changes run by run as the weekend gets closer.

Plain HTML, CSS and JavaScript. No build step and no dependencies. GitHub Pages serves the repo as is.

## Pages

| Page | What it shows |
|---|---|
| `index.html` | Landing page: this weekend's outlook per site from the latest run, how it works, latest news |
| `forecast.html` | Timeline for one site and weekend (`?site=<id>&weekend=YYYY-MM-DD`), the 14-day outlook, and the site's limits |
| `sites.html` | Every row of the site list, with limits, sources and whether it is forecast |
| `news.html` | All news items |
| `brand.html` | Logo, color tokens, type and voice rules |

## Where the data comes from

The pages fetch from the public [FlyOrFold/forecast-log](https://github.com/FlyOrFold/forecast-log) repo
through `raw.githubusercontent.com`, so there is nothing to deploy when new data lands:

- `sites.csv`: site names, coordinates, limits and notes.
- `data/forecasts/YYYY-MM.csv`: the daily log, one file per month of the issued date. The schema is
  in that repo's README. The pages load the current month and the one or two before it.

Raw files are cached for about 5 minutes, so a new run can take a few minutes to show up.

### Sample data

Add `?sample` to any URL (for example `forecast.html?sample`) to use the made-up data in `sample/`
instead. Every page then shows a **Sample data** badge. To refresh it so "this weekend" has data:

```bash
node sample/generate.mjs
```

## Running locally

Pages use ES modules and `fetch`, so open them through a local server, not as files:

```bash
python3 -m http.server 8000
```

Then go to <http://localhost:8000/>.

## Posting news

Add an object to the top of `news.json` and commit:

```json
{ "date": "2026-10-10", "text": "Added Hyner View.", "link": { "href": "sites.html#hyner-view", "label": "See the site" } }
```

`link` is optional. Keep items to a sentence or two. Text is shown as plain text (no Markdown or HTML).

## Brand

Colors live as CSS custom properties at the top of `assets/css/site.css`, with separate dark-mode
values. `brand.html` documents them. The logo source is `assets/img/logo.svg`; the PNG icons were
rendered from it:

```bash
rsvg-convert -w 512 -h 512 assets/img/logo.svg -o assets/img/icon-512.png
```

## Content rules

See `CLAUDE.md`. In short: this is a planning aid, never a go signal; site limits show their source
and are marked unverified until confirmed; no personal contact details; credit Open-Meteo.
