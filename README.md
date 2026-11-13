# AI Trend Tracker

A public dashboard that shows where attention in AI is moving, week by week.
It measures free public sources and adds a reading list from newsletter
and lab news feeds. One section, model share, needs a free OpenRouter account
key; everything else needs no keys.

| Signal | Source | What is measured |
| --- | --- | --- |
| Research | arXiv | Weekly share of AI papers mentioning each topic |
| Discussion | Hacker News | Weekly stories with each topic in the title, and the week's top AI stories |
| Today | Lab news, the newsletters and Hacker News | Everything published in the 24 hours before the data was collected, biggest first by Hacker News points |
| Products | Hacker News and Wikipedia page views | For 24 products: weekly stories naming the product, and weekly views of its Wikipedia article |
| Launches | Hacker News | The past week's "Show HN" and "Launch HN" posts with an AI term in the title, ranked by points |
| Code | GitHub | New AI repositories ranked by stars gained per day |
| Models | Hugging Face | Trending models, new uploads from major labs, and most-upvoted papers |
| Analysis | Eight newsletters and institutions (RSS) | Newest AI pieces, at most two per source, past 30 days |
| Labs | News feeds of OpenAI, Google DeepMind, Microsoft, Mistral AI and ElevenLabs; posts from Anthropic, Meta, xAI, DeepSeek, Runway, Suno and Stability AI via Hacker News | Newest announcements, including closed-model releases |
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

### Checks before a count is stored

A source can answer successfully with a wrong number: arXiv's search sometimes
returns zero results. Before a weekly count replaces what is stored, the
collector checks it against the eight weeks before (`scripts/sanity.ts`):

- A total (all AI papers, all AI stories) is rejected at zero, below 0.4× its
  usual level, or above 3×.
- A topic or theme count is rejected at zero once its usual level is 20 or
  more, below 0.15× once it is 40 or more, or above 6×. Smaller counts are
  not judged, because they really do swing that much.
- A recount of a week already stored is rejected if it falls by half.
- A topic with more papers than all AI papers that week is rejected.

A rejected count leaves the stored figure as it was, and the source shows as
failing on the site with the reason. If any count for the newest week is
missing, that week is held back and the site stays on the week before; the
next run tries again. The limits sit well outside every real move in the first
year of history, and `npm test` replays that history through them.

If a rejected figure turns out to be real, run
`npm run collect -- --fast --accept` once to store it without the checks.

The reading-list feeds are set in `ANALYST_SOURCES` and `LAB_SOURCES` in
`scripts/collect.ts`. Anthropic has no feed, and its terms may not allow a script
to read its pages, so its posts are found through Hacker News: stories from the
past 30 days that link to an article on anthropic.com. A post nobody submitted
there is missed, and the headline is the one on the most-upvoted submission.
Six more labs are read the same way (`viaHackerNews`), so nothing is requested
from their sites either: xAI, DeepSeek and Runway have no feed and terms that
bar scripted reading of pages, and Meta's, Suno's and Stability AI's terms bar
automated access with no exception for the feeds they publish. Microsoft's,
Mistral AI's and ElevenLabs' feeds are read directly: their terms were read in
November 2026 and do not bar it. The lab list keeps 18 posts: up to three from
a frontier lab and two from a specialist one (ElevenLabs, Runway, Suno,
Stability AI).

Read a publisher's terms before adding a feed. NBER and PIIE were removed because
theirs bar any automatic access to their sites, with no exception for feeds.

"Today's AI news", at the top of the page, is built in `src/lib/today.ts` from
the lab and newsletter lists plus the past day's Hacker News stories (20 points
or more, at most twelve). The site is rebuilt once a day, so "today" means the
24 hours before the last collection, and the section says which those are.
The list is ranked by Hacker News points. A lab or newsletter post takes the
points of the story that links to it or shares its headline; posts with no
such story come last, newest first.

"Product launches" is built by `hnLaunches` in `scripts/collect.ts` from the
same Hacker News search: posts tagged "Show HN", and stories titled "Launch HN"
(Y Combinator companies), from the past seven days with 10 points or more. A
post is kept when its title matches `LAUNCH_MENTIONS_AI`; widen that pattern if
AI launches are being missed. The list leans to developer tools, and a product
nobody posted there does not appear.

### The editor's step

Points say what one community upvoted, so a ranked list is finished by rules
before it is shown (`src/lib/editorial.ts`):

1. Links under `hide` in `data/editorial.json` are left out of every ranked
   list on the page. Each needs a `reason`, which the page prints.
2. In "Today's AI news", posts about one event are gathered under the
   highest-ranked of them and stay on the page beneath it. Two headlines are one
   event when one holds the other, or when they share three or more words in a
   row that include a version number.
3. Posts under `pin` are held at the top of "Today's AI news" through their
   `until` day. A pin with no `until` still to come is ignored, so a forgotten
   pin cannot sit on a page that rebuilds itself daily.

The first story of the day is set as a headline above the list, not as a row,
when it is pinned or when its points already match the middle of the week's
ten most upvoted stories (`isBigStory`). On an ordinary day every story is a row.

An optional `line` is one sentence in the editor's own words, shown under the
page headline through its `until` day:
`"line": { "text": "…", "until": "2026-11-20" }`.

`data/editorial.json` is kept by hand; the collector never writes to it:

```json
{
  "pin": [
    { "url": "https://example.org/post", "title": "Headline as shown", "from": "Example Lab",
      "until": "2026-11-20", "note": "Optional line shown under the headline." }
  ],
  "hide": [{ "url": "https://example.org/spam", "reason": "Why it is left out." }]
}
```

Neither list changes the trend figures.

If a source is down, the previous data for it is kept and the site marks it
as stale in the "Source status" list.

## How it fits together

```
scripts/collect.ts   fetches from the sources and feeds → data/*.json
scripts/sanity.ts    decides whether a weekly count is believable before it is stored
src/lib/topics.ts    the topics and their search phrases (edit to add a topic)
src/lib/themes.ts    the themes, their sub-themes and searches (edit to add a sub-theme)
src/lib/toolkits.ts  the developer toolkits and their packages (edit to add a toolkit)
src/lib/products.ts  the product watchlist: searches and Wikipedia titles (edit to add a product)
src/lib/trends.ts    turns weekly counts into "rising / steady / cooling"
src/components/LeadChart.tsx  the chart under the headline: the movers it names, with the two periods compared
src/lib/noise.ts     decides whether a change is bigger than a series' usual wobble
src/lib/editorial.ts gathers posts about one event and applies the pins and hides
data/editorial.json  the editor's pins and hides, kept by hand
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
files change. GitHub allows its hosted runners only for work on the repository's
own project, so the workflow should stay a short daily job that produces this
site's data and nothing else. `.github/workflows/collect.yml` refreshes the data daily once
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
moved by 10% or more and the move stands clear of the topic's own noise. The windows are set in `HORIZONS` in `src/lib/trends.ts`. Topics are keyword lists, so counts are indicators
rather than exact measurements.

The noise test is in `src/lib/noise.ts`. A topic with twenty papers a week
swings by more than 10% on its own, so a fixed threshold alone calls noise a
trend. The test estimates each series' week-to-week noise from the median
difference between neighbouring weeks, over every week on record, and works out
how large a difference between the two windows that noise alone would produce.
A move counts only if it is at least twice that (`NOISE_MULTIPLE`). It applies
to topics, discussion counts, themes and sub-themes; a move that fails keeps
its figure, with a grey bar under "steady", and is never named in the
headline. With fewer than nine weeks of history only the fixed threshold
applies. The monthly and two-weekly indicators are not tested this way.

Discussion is measured on Hacker News alone, so the headline and the labels
name it: "On Hacker News, data centers, chips & energy rose to 2.9% of AI
stories, from 1.8%." The headline always gives both figures, so it says what
the chart under it shows. Its readers are mostly
technologists; the figures show that community's conversation, not public
opinion.

Each theme is the set of distinct stories matched by any of its sub-themes'
searches, so adding a search to a sub-theme also changes its theme's count.
A story can sit in more than one sub-theme. A sub-theme averaging fewer than
3 stories a week in either half of the comparison is shown as "too few to call".
Adding a sub-theme makes the next `npm run collect` backfill its 52 weeks
from Hacker News (a few minutes). The page's "How this is measured" section
explains the limits to readers.

## How product momentum is measured

The "Product momentum" section follows the products listed in
`src/lib/products.ts`. Each has two weekly figures, stored under `products` in
`history.json`, and both follow the view chosen in the masthead:

- **Discussion** is Hacker News stories with the product's name in the title.
  A product averaging fewer than 3 stories a week in either half of the
  comparison is shown as "too few to call".
- **Public interest** is views of the product's English Wikipedia article, from
  Wikimedia's page-view API (`user` agent, so crawlers are left out). The data
  is CC0. One request per article title returns the whole year.

Wikimedia allows a script that sends no contact address ten requests a minute,
so the collector sends one every seven seconds and waits when told to
(`WIKI_PAUSE` in `scripts/collect.ts`). Its policy asks for a contact address or
URL in the `User-Agent`; adding one to `USER_AGENT` raises the limit to 200 a
minute.

Wikipedia articles are renamed often, and views are recorded under the title of
the day. Each product therefore lists every title its article has carried in the
past year. When an article is renamed its views collapse; `scripts/sanity.ts`
turns the figure away (below 0.15× the usual level), "Wikipedia page views"
shows as stale in the source list with the product named, and the fix is to add
the new title to the product's `wiki` list. Views are never rejected for being
too high, because a launch really can lift them fifty-fold.

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

1. Save the captions as text. Open the video on YouTube, choose "Show transcript" under
   the description, and copy the text into a file; or ask the organiser for a transcript.
   Do not fetch captions with a download tool such as `yt-dlp`: YouTube's terms allow
   neither automated access nor downloading without permission.
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
collector reads OpenRouter's documented
[Data API](https://openrouter.ai/docs/cookbook/administration/data-api), which lists each day's 50
most-used models; `scripts/marketShare.ts` sums them by maker and week. A maker's total therefore
leaves out any of its models below the daily 50.

The API needs an account key, though the request costs nothing. Create a key at openrouter.ai, then
set `OPENROUTER_API_KEY` when running `npm run collect`, and add it as a repository secret of the
same name for the daily workflow. Without it the section keeps its last data and the source shows as
failed. OpenRouter's terms do not allow reading the address its rankings page loads, so do not
switch back to that.
