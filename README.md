# AI Trend Tracker

A public dashboard that shows where attention in AI is moving, week by week.
It measures free public sources, adds a reading list from newsletter
and lab news feeds, and needs no API keys.

| Signal | Source | What is measured |
| --- | --- | --- |
| Research | arXiv | Weekly share of AI papers mentioning each topic |
| Discussion | Hacker News | Weekly stories with each topic in the title, and the week's top AI stories |
| Code | GitHub | New AI repositories ranked by stars gained per day |
| Models | Hugging Face | Trending models, new uploads from major labs, and most-upvoted papers |
| Analysis | Ten newsletters and institutions (RSS) | Newest AI pieces, at most two per source, past 30 days |
| Labs | Anthropic, OpenAI, Google DeepMind news | Newest announcements, including closed-model releases |
| Themes | Hacker News search | Stories on seven economy and society themes, each split into four sub-themes, as a share of all AI stories, weekly |
| Hiring | Indeed Hiring Lab | Share of US job postings asking for AI skills, monthly |
| Policy | Federal Register | Documents mentioning "artificial intelligence", monthly |
| Releases | Lab news pages | First announcement of each new GPT, Gemini and Claude version |
| Usage | npm and PyPI Stats | Monthly downloads of ten developer toolkits, as a share of all ten |

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Refresh the data

```bash
npm run collect
```

The first run backfills 52 weeks of history and takes about 45 minutes,
because arXiv allows one request every three seconds. Later runs only
re-count the two newest weeks. `npm run collect -- --fast` skips the backfill.

The collector writes to `data/`:

- `history.json`: weekly counts per topic, theme and sub-theme. It grows over time.
- `latest.json`: the current ranked lists, plus whether each source succeeded.
- `indicators.json`: the monthly hiring and policy figures, the model release log and
  monthly toolkit downloads.
- `snapshots/YYYY-MM-DD.json`: a dated copy of the lists, kept as a record.

The reading-list feeds are set in `ANALYST_SOURCES` and `LAB_SOURCES` in
`scripts/collect.ts`. Anthropic has no feed, so its newest articles are found
through its sitemap and read one page at a time.

If a source is down, the previous data for it is kept and the site marks it
as stale in the "Source status" list.

## How it fits together

```
scripts/collect.ts   fetches from the sources and feeds → data/*.json
src/lib/topics.ts    the topics and their search phrases (edit to add a topic)
src/lib/themes.ts    the themes, their sub-themes and searches (edit to add a sub-theme)
src/lib/toolkits.ts  the developer toolkits and their packages (edit to add a toolkit)
src/lib/trends.ts    turns weekly counts into "rising / steady / cooling"
src/components/Dashboard.tsx   the dashboard, built as static pages from data/*.json
src/app/one-week/    the 1-week view, at /one-week
src/app/one-month/   the 1-month view, at /one-month
src/app/page.tsx     the 3-month view, at /
src/app/six-months/  the 6-month view, at /six-months
src/app/one-year/    the 1-year view, at /one-year
tokens.css           every colour, font and size the design uses
```

There is no database. The site is a static page rebuilt whenever the data
files change. `.github/workflows/collect.yml` refreshes the data daily once
the project is on GitHub.

## How a trend is decided

The page has five views, switched from the masthead:

| View | Compares | Needs |
| --- | --- | --- |
| 1 week (`/one-week`) | the latest week with the week before | 2 weeks |
| 1 month (`/one-month`) | the latest 2 weeks with the 2 before | 4 weeks |
| 3 months (`/`) | the latest 4 weeks with the 4 before | 8 weeks |
| 6 months (`/six-months`) | the latest 13 weeks with the 13 before | 26 weeks |
| 1 year (`/one-year`) | the latest 26 weeks with the 26 before | 52 weeks |

The 1-week and 1-month views react fastest and are the noisiest.

In every view a topic is "rising" or "cooling" when its share of AI papers
moved by 10% or more. The windows are set in `HORIZONS` in `src/lib/trends.ts`. Topics are keyword lists, so counts are indicators
rather than exact measurements.

Each theme is the set of distinct stories matched by any of its sub-themes'
searches, so adding a search to a sub-theme also changes its theme's count.
A story can sit in more than one sub-theme. A sub-theme averaging fewer than
3 stories a week in either half of the comparison is shown as "too few to call".
Adding a sub-theme makes the next `npm run collect` backfill its 52 weeks
from Hacker News (a few minutes). The page's "How this is measured" section
explains the limits to readers.

## How developer usage is measured

The "Developer usage" section counts downloads of the Python (PyPI) and
JavaScript (npm) packages listed in `src/lib/toolkits.ts`, per complete month.
A toolkit's share is worked out inside each registry and the two are averaged,
with 0% where it has no package, so the shares add up to 100%. The registries
are kept apart because they count differently: PyPI's figures fell by about a
third for every tracked package in September 2026, which would otherwise have
made Python-heavy toolkits look like they were cooling.

A toolkit is "rising" or "cooling" when its average share over the latest
three months moved by 10% or more against the three before. This comparison
is the same in all five views. PyPI Stats keeps about 180 days, so the first
run has six months; the collector keeps every month it has seen (up to 25),
so the record grows from there. Downloads include build servers and packages
pulled in by other packages, so they show direction, not a number of users.
