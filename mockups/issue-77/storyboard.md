# Issue 77: track record of past calls, and steady rows folded

Founder's decision (issue comment): **go on the smaller bet** only. The track record is worked out at
build time by replaying stored counts (D1a). A call holds if the share 13 weeks later is further in the
called direction (D2b). Steady rows are folded with a native `<details>`, no script (D3a). No stored
titles (D4a), no "since your last visit" (D5a), feed and MCP server unchanged (D6a). Appetite: two to
three days. If it runs long, ship the line for the three-month view alone.

**Who:** someone who opens the Trends page about once a week, often on a phone, and wants to leave with
one true thing about where AI is moving and a reason to believe it.

**The page these mockups change:** the home page, the Trends page (`src/components/Dashboard.tsx`), on
its default three-month view. Only two places change: the lede (headline, chart, "the week in
numbers") and the themes and products sections. Everything else stays as it is and can be cut short in
the mockup with a plain "rest of the page as today" rule.

## Storyboard

1. **Outside the product, Monday morning.** The reader sees a post quoting the site ("AI papers on voice
   and speech fell 40%") or just opens the bookmark on their phone on the train. *Trust needed:* that
   this is the same page and the same number. *Earned by:* the headline says exactly what was quoted.
2. **The page opens on the three-month view.** Headline: "Voice & speech fell to 0.9% of AI papers,
   from 1.5%. On Hacker News, data centers, chips & energy rose to 2.9% of AI stories, from 1.8%."
3. **KEY MOMENT: "Should I believe this?"** Right by the headline, before the chart, the page says how
   often calls like these have held. Today's headline makes a *cooling* call on a research topic, and
   that kind of call has held only 9 times in 33 over the past year. The page has to say that plainly,
   beside its own headline, without hiding it or dressing it up. *Trust needed:* that the page is
   honest about itself, that the figure is not cherry-picked, that "held" means something fixed.
   *Earned by:* the losing numbers shown as plainly as the winning ones; the test in one sentence of
   plain words; "a replay with today's rules" said up front, not only in the method.
4. **"How do they check?"** One tap from the record goes to a new paragraph at the top of "How this is
   measured" (`#method`): what a call is, counted once on the week it first appears, held if the share
   13 weeks later is further in the called direction, replayed with today's rules and counts, so it is
   not what the page said at the time.
5. **Scrolling to the themes.** The one rising theme (Data centers, chips & energy) is open. The other
   six sit behind one fold: "6 steady themes". The page is short, and what moved is what you see.
   *Trust needed:* that nothing is hidden. *Earned by:* the fold says how many rows and why ("steady:
   no move clear of the usual swing"), and opens in place.
6. **Products, grouped as today.** In each group, products with a called move (blue or amber bar on
   either measure) stay open; the rest are behind "5 steady or too few to call" for that group.
7. **Arriving from the Today page.** A tag link such as `/#product-grok` lands on Grok's row even
   though it is folded: the fold is open and the row is highlighted (`:target`). Show this state in the
   mockup for one group (Assistants), with the `<details>` drawn `open` and Grok's row marked as the
   target, as a second copy beneath the closed one or as a labelled state; your choice.
8. **Switching to 1 year.** The record has nothing to stand on yet. The same place says: "Not enough
   history yet to check calls on the 1-year view: each needs a year to make and 13 weeks to check."
9. **Outside the product, later.** The reader repeats it to a colleague: "their research calls hold
   about half the time, and the falls hardly ever." That sentence is why the test must be on the page in
   words: the figure gets quoted.

## The key moment at different stars

- **1 star.** One sentence at the bottom of the method section. True, and nobody reads it.
- **3 stars.** One sentence under the headline, for the view being read, with a link to the test.
- **5 stars.** A small scorecard next to the headline: the record for the kinds of call the headline
  makes, the losing numbers as plain as the winners, the test in words, and a straight "not enough
  history" on the long views.
- **7 stars.** The scorecard plus the receipts: every past call listed with the week it was made, the
  share then and the share 13 weeks later, so a doubter can check any one of them.
- **9 stars.** Each called row on the page carries its own series' record, and the headline's
  confidence is set by it.
- **11 stars.** The page keeps a public, never-rewritten ledger of what it said each week, grades
  itself in front of you, and changes its own call rule when the record says it is wrong.

The appetite (two to three days, no new stored data, no call-rule change) allows 3 to 5 stars. 7 stars
is offered as option C so the founder can see what the receipts would look like, priced honestly over
the appetite. 9 and up need a ledger (D1b), the reasons piece or a rule change, all ruled out.

## Shared by all three options

**Real figures (from the brief, three-month view, replay of the past year, test D2b):**

| Kind of call | Calls | Kept moving the called way 13 weeks later |
| --- | --- | --- |
| Research topics, rising | 49 | 26 |
| Research topics, cooling | 33 | 9 |
| Themes, rising or cooling | 12 | 6 |
| Sub-themes, rising | 41 | 4 |
| Sub-themes, cooling | 33 | 9 |

Use only these numbers. Do not invent figures for the 1-week, 1-month or 6-month views; the mockup
shows the three-month view. Where an option shows the 1-year state, use the sentence in frame 8.

**The test, in words (use this wording or very close to it):** "A call is counted once, in the week it
first appears. It held if, 13 weeks later, the share had moved further the way it was called. This is a
replay of the past year with today's rules and today's counts, not a record of what the page said at
the time."

**The fold (identical in all three; the options differ in the track record only):**

- Themes: the "Rising 1" group shows Data centers, chips & energy, +66%, 2.9% of AI stories, 28/wk,
  with its rank, blurb ("The physical build-out behind the models") and bar as today. Below it, one
  native `<details>` whose `<summary>` reads "6 steady themes" with a small muted line "no move clear
  of the usual swing". Inside, the existing "Steady 6" group, rows as today: Jobs & labor +4% 2.9%
  28/wk; Productivity & business adoption +8% 2.9% 28/wk; Public trust & backlash +9% 2.8% 27/wk;
  Investment & the bubble question +19% (grey, within its usual swing) 2.7% 26/wk; Regulation & law
  −34% (grey) 1.8% 18/wk; Education −29% (grey) 1.2% 12/wk. There is no cooling theme today.
- Products, Assistants group (9): open rows Claude (interest +19%, 7,130/day; discussion +1%, 77/wk),
  ChatGPT (interest +62%, 94.2K/day; discussion −19% grey, 29/wk), Gemini (interest +22%, 3,449/day;
  discussion +19% grey, 22/wk), DeepSeek (interest +54%, 577/day; discussion +50% grey, 18/wk). Folded
  behind "5 steady or too few to call": Grok, Copilot, Perplexity, Meta AI, NotebookLM. Show only this
  group in full; the other four groups can be a single line each with their fold summary (for example
  "Coding tools and agents 8").
- The `<summary>` uses the existing `.table-view summary` look (accent colour, `--text-sm`, weight 500,
  taller touch target on coarse pointers). Not a new component.
- Phone (390 wide): the fold summary must be one line or wrap cleanly; rows as the existing phone
  layout of `.mom__row`.

**Design language.** Inline the values of the repo's `tokens.css` (Newsprint: paper
`oklch(98.6% 0.006 85)`, ink, rules, ink-blue accent, `--data-rising` blue and `--data-cooling` amber,
Newsreader display serif falling back to Iowan Old Style / Palatino, Geist body falling back to Helvetica
Neue, 4pt spacing scale, 1px and 3px rules, 2px radius). Re-create the existing classes the page uses
(`.mast`, `.bar` time-span switch with "3 months" selected, `.lede`, `.lede__head`, `.lede__meta`,
`.brief`, `.band`, `.mom__group`, `.mom__row`, `.table-view`). Blue and amber mean rise and fall, never
good and bad: a low hold rate is not drawn in red or `--color-fail`. Only English ships, so English only.
No web fonts or scripts from the web; the system fallbacks are fine.

**Lede content as it is today (keep it):** masthead "AI Trend Tracker", "Updated 14 November 2026";
the meta line "Latest week: 2–8 November 2026 · 3,535 AI papers reached arXiv that week · Showing 3
months: charts cover 12 weeks, and each change is the last 4 weeks compared with the 4 weeks before.";
the lead chart can be a simple stand-in box of the right height labelled with its two series; the five
brief cards: Research −40% "Voice & speech fell as a share of AI papers."; Hacker News +66% "Data
centers, chips & energy rose as a share of AI stories on Hacker News."; Economy 7.3% "of US job
postings ask for AI skills, up from 3.7% a year earlier."; Releases 8 "frontier model versions in the
last 90 days, against 8 in the 90 days before."; Policy 31 "US federal documents mentioned AI in Oct
2026, against 13 a year earlier."

**Method.** Each option shows the new first paragraph of "How this is measured", headed **Track
record**, with the test in words. It can be shown open, below a "rest of the page as today" rule.

## Option A: The line (3 stars)

**What it does at the key moment.** Directly under the headline, inside `.lede__dek` beside the meta
line, one sentence in ink (not muted) at `--text-sm`: "How calls like these have held: over the past
year, this view called 33 research-topic falls and 9 kept falling; it called 12 theme moves and 6 kept
going. How we check →" The link goes to `#method`.

**What sets it apart.** Words only, no figures set large, no new block, no bar. It reads as part of the
headline's small print, matched to the two kinds of call the headline makes today (a cooling topic, a
rising theme). On phone it is two to three lines under the headline. The 1-year state is the same
sentence slot with the frame 8 wording. It is the quietest and the cheapest; the risk is that it is
read past.

**Cost.** About 2 days: the replay module and its tests (the bulk, same in every option), one sentence
picked by the headline's call kinds, the fold, the method paragraph.

## Option B: The scorecard (5 stars, recommended)

**What it does at the key moment.** A small block titled "Track record" sits right after the headline
and meta line, before the chart (on desktop it takes the right-hand column beside the headline, where
`.lede__dek` sits today; on phone it follows the headline). It has three rows, one per kind of call the
three-month view makes on this page, each built like a `.brief` line: the figure large in the display
serif ("26 of 49"), a label ("Research topics, rising"), and a thin proportion bar, 26 parts filled of
49, filled in `--data-rising` for rising rows and `--data-cooling` for falling rows, the unfilled part
in `--color-rule`. Rows: Research topics, rising 26 of 49 "kept rising"; Research topics, cooling 9 of
33 "kept falling"; Themes 6 of 12 "kept going". The row matching the headline's own call (Research
topics, cooling) is marked "today's headline" in a small muted tag. Under the rows, the test in words
(shared wording) at `--text-xs`, and "How we check →" to `#method`.

**What sets it apart.** It is the only option that shows the record for several kinds of call at once,
so the reader sees that rises hold about half the time and falls rarely, without opening anything. The
figures are counts ("9 of 33"), never percentages, so they cannot be read as more precise than they
are. The 1-year state replaces the three rows with the frame 8 sentence in the same box, so the block
does not jump away between views. The bar is a new small mark, drawn from the existing `.brief` line
and the data colours; name it in the page as "proposed: record bar".

**Cost.** About 3 days, the top of the appetite: the replay module and tests, three series instead of
one, the block for desktop and phone, the fold, the method paragraph. If it runs long, ship it for the
three-month view only, as the brief allows.

## Option C: The receipts (7 stars, over the appetite)

**What it does at the key moment.** Under the headline, the same one sentence as option A, then a
native `<details>` styled as `.table-view`: "See all 33 research-topic falls this view called, and what
happened next". Open (show it open in the mockup), it is a table, one row per past call: topic, week
called, share then, share 13 weeks later, and "kept falling" or "did not" as words plus a small
amber or grey mark. Sorted newest first, with the summary line repeated at the foot ("9 of 33 kept
falling").

**What sets it apart.** The receipts: a doubter can check any single call against the topic's own page.
It answers "is this cherry-picked?" with the whole list rather than a total. The replay already
computes these rows, so the data is free; the cost is the table, its phone layout (a stacked card per
call at 390 wide, not a sideways scroll) and the care in wording each row. **Placeholder content:**
the brief does not list the individual calls, so the mockup uses the 14 real research topic names on
the site (at least Voice & speech) with weeks from the past year and shares marked as illustrative in
the table caption ("illustrative rows; the build fills them from the replay"); the totals 9 of 33 are
real. Do not present invented rows as real.

**Cost.** About 4 to 5 days: everything in A, plus the per-call table, its phone layout and tests for
the row wording. Over the two-to-three-day appetite; would need the founder to widen it or to cut the
fold from this bet.

## Recommendation

**B, the scorecard.** It is the only option where the reader, at the moment they ask "should I believe
this?", sees at a glance that this page's rising calls hold about half the time and its falls rarely,
with the test in plain words beside it. That is the honest answer the founder needs to read off the
page to pick the next brief, and it fits the appetite. A is cheaper but reads like small print; C earns
the most trust but costs about twice the appetite and its rows are not in the brief yet.

## For the reviewer after the build

Check the journey, not only the match: on a 390-wide phone, is the record visible on the first screen
with the headline? Does the 1-year view say "not enough history" in the same place? Does a
`/#product-<id>` link to a folded row land on the row? Is a low figure drawn without alarm colours?
