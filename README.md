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
| Adoption | US Census Bureau business survey | Share of US businesses saying they use AI, every two weeks |
| Usage | npm and PyPI Stats | Monthly downloads of ten developer toolkits, as a share of all ten |
| Model share | OpenRouter rankings | Weekly tokens by model maker on one marketplace, as a share of the total |

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
- `indicators.json`: the monthly hiring and policy figures, the model release log,
  monthly toolkit downloads and the two-weekly business survey answers.
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
src/components/Conferences.tsx  the conference tracker, at /conferences
scripts/conference.ts  counts topic mentions in a conference's programme or transcript
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

## How business adoption is measured

The "Business adoption" section uses the Census Bureau's Business Trends and
Outlook Survey, which asks US businesses every two weeks whether they used AI
in the last two weeks and whether they expect to in the next six months. The
survey's API only gives the national figure inside a 10 MB download per
period, so the collector reads the Bureau's national spreadsheet
(`National.xlsx`, about 100 KB) with a small built-in reader, and finds the
two questions by their wording.

The trend compares the average of the latest six surveys with the six before,
in all five views. The series starts in November 2025, when the Bureau
broadened the question's wording; earlier answers were lower and are not
joined on. If the Bureau rewords the question so that it no longer begins
"In the last two weeks, did this business use", the source will show as stale
and `businessAdoption` in `scripts/collect.ts` needs the new wording.

## How conferences are tracked

The page at `/conferences` is a calendar of major AI events, kept by hand in
`data/conferences.json` with dates from each organiser's site. An event moves from
upcoming to held on its own, because the page compares its dates with the day the data
was last collected.

Once an event is over and its recordings have captions, it is watched and read against
the trends:

1. Save the captions as text, for example with
   `yt-dlp --write-auto-subs --sub-langs en --skip-download <video url>`.
   Transcripts are not kept in the repository.
2. Run `npm run conference -- <conference id> <transcript.txt>`. This counts how often
   each topic in `src/lib/topics.ts` was mentioned and stores the counts under `stage`.
3. Add a `recap` to the event in `data/conferences.json`: the date watched, how much
   was covered (with `"partial": true` while some talks are still unread, which keeps the
   page from calling the event watched), a summary, and `points` (what was said about a topic, by whom, with a
   link to that moment in the video). Only write what the talks said.

Before captions exist, `npm run conference -- <id> --programme <file>` counts the
published titles and abstracts instead, and the page labels the figures as the
programme, not the talks. The page sets each topic's share of mentions beside its
three-month research and discussion trend and labels where they agree or part; the rule
is in `stageAgainstTrends` in `src/lib/conferences.ts`.

## How model share is measured

OpenRouter is a marketplace where developers reach many AI models through one account. Its
[rankings page](https://openrouter.ai/rankings) publishes how many tokens (units of text read and
written) each model maker's models handled each week. The dashboard turns that into each maker's
share of the week's total and compares recent weeks with the weeks before, over the time range
chosen at the top of the page.

Read it as one marketplace, not the whole market:

- Companies that buy from a lab directly, and everyone using a chat app, are not counted.
- Free and low-priced models draw heavy automated use, which lifts their makers.
- Each maker counts tokens its own way, so shares are approximate.
- Each week names only its nine largest makers. A maker's line starts from when it last entered the
  nine, and its change is shown only if it stayed there for the whole comparison.

The data is OpenRouter's, used under CC BY 4.0 with the credit shown beside the figures. The
collector reads the same address the rankings page itself loads, which needs no account but is not
a documented service and could change; if it does, the dashboard keeps the last good data and marks
the source as failed. OpenRouter also offers a documented data service that needs a free account
key, which would be the sturdier choice. `modelMarketShare` in `scripts/collect.ts` is the place to
switch.
