# AI Trend Tracker

A public dashboard that shows where attention in AI is moving, week by week.
It reads four free public sources and needs no API keys.

| Signal | Source | What is measured |
| --- | --- | --- |
| Research | arXiv | Weekly share of AI papers mentioning each topic |
| Discussion | Hacker News | Weekly stories with each topic in the title, and the week's top AI stories |
| Code | GitHub | New AI repositories ranked by stars gained per day |
| Models | Hugging Face | Trending models, new uploads from major labs, and most-upvoted papers |

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

The first run backfills 12 weeks of history and takes about 15 minutes,
because arXiv allows one request every three seconds. Later runs only
re-count the two newest weeks. `npm run collect -- --fast` skips the backfill.

The collector writes to `data/`:

- `history.json`: weekly counts per topic. It grows over time.
- `latest.json`: the current ranked lists, plus whether each source succeeded.
- `snapshots/YYYY-MM-DD.json`: a dated copy of the lists, kept as a record.

If a source is down, the previous data for it is kept and the site marks it
as stale in the "Source status" list.

## How it fits together

```
scripts/collect.ts   fetches from the four sources → data/*.json
src/lib/topics.ts    the topics and their search phrases (edit to add a topic)
src/lib/trends.ts    turns weekly counts into "rising / steady / cooling"
src/app/page.tsx     the dashboard, built as a static page from data/*.json
tokens.css           every colour, font and size the design uses
```

There is no database. The site is a static page rebuilt whenever the data
files change. `.github/workflows/collect.yml` refreshes the data daily once
the project is on GitHub.

## How a trend is decided

For each topic, the average of the latest four weeks is compared with the four
weeks before. A topic is "rising" or "cooling" when its share of AI papers
moved by 10% or more. Topics are keyword lists, so counts are indicators
rather than exact measurements. The page's "How this is measured" section
explains the limits to readers.
