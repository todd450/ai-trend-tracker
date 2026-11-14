# Issue #78: the 5-minute version of an event page (the smaller bet)

The founder said go on the smaller bet: ranked moments first, a surprise line only when it is real,
the stage table folded one click down, the status tracker moved to the foot, and the calendar card
changed to match. No reader tracking. D1 to D5 are settled as the brief recommended. The appetite is
**2 days**. If it runs long, the event page ships and the card stays as it is.

## Who and what they have to trust

The reader comes to `/conferences/aie-code-2026` from a shared link or from a card on
`/conferences`. They want to know, in five minutes, what was said that is worth hearing, and to jump
to that point in the recording. They have to trust three things:

1. **That the paraphrase is what the speaker said.** This is earned by the caveat sitting directly
   above the moments, by the day label on every timestamp, and by the day-two moments saying plainly
   that the recording was not played.
2. **That the surprise is real, not made up to fill the slot.** This is earned by saying where the
   line came from ("the editor's note" or "from the numbers"), by giving the figure, by linking to the
   table row it rests on, and by leaving the slot out when there is no surprise.
3. **That the order means something.** This is earned by one short line saying the editor ranked
   the moments, and by numbering them.

## Storyboard

| # | Frame | Where | What the person sees or does | Trust question |
|---|---|---|---|---|
| 1 | **The editor ranks and writes** | Outside the page: `data/conferences.json` | After reading the talks, the editor puts the `points` in order of worth and may write one `recap.surprise` sentence. Most events get no surprise line. | Will a missing surprise look like a gap? (No: the slot is left out.) |
| 2 | **The link arrives** | Outside the product: a message, a post, or the calendar | Someone shares the event page, or the reader scans `/conferences`. The card there now shows the surprise line, or the first-ranked moment when there is no surprise, instead of "AI agents took 65%…". | Is this worth a click? |
| 3 | **Landing** | Event page, top | A short header: name, "Held · read in part, 13 Nov · 10–12 Nov 2026 · San Francisco, USA · Industry", the dek, and the links. No tracker or year strip here. | Is this the right event, and how complete is it? |
| 4 | **The surprise, if there is one** | Event page | One sentence, its source, and a link down to the table row. For aie-code-2026: *"Safety was barely named, 1% of topic mentions, though much of both days was about checking what agents do."* aie-nyc-2026 has none, so the slot is left out. | Is this real or invented? |
| 5 | **The ranked moments ★ key moment** | Event page | The caveat, then the top five numbered moments: speaker and company, the paraphrase, a topic tag, and the timestamp link ("6:15:40, day 1"). The other 12 come under "All 17 moments". | Is the paraphrase faithful? Where do I go to hear it? |
| 6 | **The jump** | Outside the product: YouTube in a new tab | The recording opens at 6:15:40 and the reader hears Brian Kennedy say it. | Did the link land on the moment? (Day-two streams can be re-cut, so the label says which day and stream.) |
| 7 | **Back for more, or for the numbers** | Event page | The reader returns to the tab and opens moment 2, or "All 17 moments", or "How the stage compares with the numbers (14 topics)", a native `<details>` with the Stage table unchanged. Each row shows "3 moments ↑" linking back up to that topic's moments. | Can I check the claim behind the surprise? |
| 8 | **The foot** | Event page | "What was said" (summary and coverage, still saying "in part"), then recordings and programme, then "Where this event stands" (tracker and year strip), then previous and next. | Is anything still to come for this event? |

**The key moment is frames 5 to 6:** the reader sees moment 1 and acts on its timestamp. That is
the whole bet. If it doesn't work, nothing else on the page matters.

## Stars for the key moment

- **1 star:** the moments list moved above the table, in the order the editor wrote them, with the
  table left open below.
- **3 stars:** the brief's reorder. A plain numbered top 5, a surprise sentence when there is one,
  the table folded, the tracker at the foot, and the card changed.
- **5 stars:** moment 1 is set as the page's lead, because it is the thing worth hearing. The surprise
  says where it came from and points to its evidence. Every timestamp says which day it is on and
  whether that day was watched or only read. The card on `/conferences` gives a reader something to
  hear before they even open the page.
- **7 stars:** each moment also carries its topic's reading against the numbers ("Safety · quiet
  here, steady in research"), so the five moments *are* the 5-minute version of the table, and most
  readers never need to open it.
- **9 stars:** the five moments play one after another on the page as a five-minute listen, each
  trimmed to the sentence that matters. This is ruled out: it needs embedded players (scripts from
  the web and reader tracking by YouTube) and clip lengths nobody has measured.
- **11 stars:** a weekly "five minutes from this week's stages" across every watched event, in your
  inbox or your assistant. That is a different product and not this bet.

The appetite of 2 days holds **3 to 5 stars**. Seven stars is offered as the stretch, priced honestly.

## Shared content for every option (use exactly this)

Use real content only, from `data/conferences.json`. The site ships in English only.
`<html lang="en">`.

- **Page:** AI Engineer Code Summit (`aie-code-2026`). Status: `Held · read in part, 13 Nov`. Dates:
  10–12 Nov 2026, San Francisco, USA, Industry. Run by AI Engineer. Dek: "Three days for engineers who
  build with coding agents: a workshop day, then two days of talks from the labs and the companies
  using them." It is the 5th of 22 events on the calendar. The previous event is GitHub Universe 2026
  and the next is Microsoft Ignite 2026.
- **Surprise (editor's line, illustrative):** "Safety was barely named, 1% of topic mentions (17 of
  1,687), though much of both days was about checking what agents do." It links to `#stage-safety`.
- **Ranking (illustrative; the editor decides the real one).** Top five, in this order. Copy the
  `said` text in full from the data, and don't shorten it:
  1. Brian Kennedy, ZoomInfo · safety · 6:15:40, day 1 (the judge model right 65% of the time)
  2. Lauren Tan, SpaceXSI · coding · 1:14:55, day 1 (11,000 pull requests, about half a percent reverted)
  3. Philipp Schmid, Google DeepMind · tools · 2:29:55, day 1 (one command-line tool, almost twice as cheap)
  4. Simon Willison, independent · safety · 8:42:30, day 1 (the model that broke out of its test environment)
  5. Zach Bruggeman, Ramp · coding · 7:50:50, day 1 (75% of Ramp's code)

  Then "All 17 moments": the other 12, in data order. Moments 13 to 17 are day 2 (stream
  `y9JtCCZP2MQ`). Show at least two day-two moments in full (for example Armin Ronacher, 0:46:45,
  day 2, and Lance Martin, 3:51:11, day 2, which is the longest at 277 characters) so the
  read-not-watched label is visible. The rest can be listed by speaker and timestamp only.
- **Caveat above the moments:** "Paraphrased from the day-one captions and, for day two, from the
  organiser's summaries; the day-two recording was not played. Each links to its moment so you can
  check it."
- **Topic names** (the tracker's own): AI agents, AI coding tools, Tool use & MCP, Memory & context,
  Safety, Retrieval (RAG), Efficient models.
- **Stage table summary:** "How the stage compares with the numbers (14 topics)". Closed in the
  screenshot. Inside, two or three real rows are enough (AI agents 65.0% "Loud here, flat in the
  numbers"; AI coding tools 11.7% "Loud here, flat in the numbers"; Tool use & MCP 10.7%, with the reading label the live page prints for it, from `READING_LABEL` in
  `src/lib/conferences.ts`; don't make up a label). Each row ends with "N moments ↑".
- **Card strip** (bottom of each page, labelled "On /conferences"): two cards side by side on
  desktop and stacked on a phone. aie-code-2026 shows its surprise line. aie-nyc-2026 has no surprise,
  so it shows its first moment (John Feminella, Two Sigma, 0:29:38, day 1, the five controls). This
  shows both states.
- **Tokens:** copy `tokens.css` verbatim into the page's `<style>` (light and dark). Use only those
  names. The fonts fall back to the token stacks (Newsreader and Geist aren't loaded; that's fine).
  Mirror the existing classes in `src/app/globals.css` where they exist: `.ehead`, `.band`,
  `.band__head`, `.covered--partial`, `.stage__row`, `.stage__reading--*`, `.steps`, `.year`, `.ev`
  and `.ev__finding`.
- **Widths:** it has to work at 390px and at 1440px (`--page-max: 76rem`). Timestamps never wrap
  mid-label. The longest paraphrase (277 characters) has to sit comfortably at 390px.
- **No-gos on every page:** no scripts, no embeds, no tracking, no new address, no rule-made
  surprise and no filler. Timestamp links are plain `<a target="_blank" rel="noopener">` to the
  YouTube URL from the data.

## Option A: Straight reorder (3 stars)

**At the key moment:** the reader sees a plain numbered list of the five ranked moments, just under
a one-sentence surprise. It is the existing quote style moved up and numbered, with the timestamp at
the end of each line.

**What sets it apart:** this is the least design. It reuses the existing `.stage__points` look (a
hairline rule on the left, `--text-sm`, ink-2) for every moment. All five are the same size, so
nothing is singled out. The surprise is a plain paragraph in `--text-lg` with "See the table ↓" after
it, and no label saying where it came from. The timestamp is a text link at the end of the line:
`6:15:40, day 1 ↗`. Day-two moments carry the same label, and only the caveat says they were read.
"All 17 moments" is an open list, not folded. The card swaps the `.ev__finding` sentence for the
surprise or the first moment, in the same type, and the bars stay.

**Cost:** about 1 day. There are no new components, only reordering and one `<details>`.

## Option B: The lead moment (5 stars, recommended)

**At the key moment:** moment 1 is set as the page's lead, with the paraphrase in the display serif
at `--text-xl`, the speaker under it, and a clear timestamp link ("Hear it at 6:15:40 · day 1 ·
YouTube ↗"). Moments 2 to 5 follow as a tight numbered list. Above them, the surprise sits in a ruled
box that names its source ("The editor's note") and gives the figure.

**What sets it apart:** this is the only option with a hierarchy inside the moments: one lead and
four followers. It is also the only one that labels provenance per moment. Each timestamp reads
"day 1 · from captions", or "day 2 · read from the organiser's summary, not played", in `--text-xs`
muted. (Building it needs the day's source from the coverage, so a builder would add an optional
per-video `read` flag. Name that as a small data addition.) The surprise box has a heavy top rule
(`--rule-heavy`), a small caps label "The editor's note" (or "From the numbers" when the rule supplies
it), and "The safety row in the table ↓". "All 17 moments" is a second native `<details>`, grouped
under "Day 1, watched from captions" and "Day 2, read, not watched". The card leads with the surprise
or moment 1 in the serif and puts the timestamp link right on the card, so a reader can hear it
without opening the page. The three bars drop off the card.

**Proposed new component:** the lead-moment block (`.moment--lead`). It is a proposal in its own
right, not a side effect.

**Cost:** about 2 days, which fills the appetite. If it runs long, the card change is the part to
drop, as the brief allows.

## Option C: Moments that carry their numbers (7 stars)

**At the key moment:** every one of the five moments carries its topic's reading against the
numbers in a small line under it, for example "Safety · 1% of the stage · research steady ·
discussion steady". Take the real movements from the live page or `get_conferences`; don't guess them. The reader gets the stage-against-numbers story through the quotes and rarely
needs to open the table.

**What sets it apart:** this is the only option that merges the moments with the table's evidence.
Each moment's topic tag becomes a compact reading strip: a short version of the `.stage__bar` for the
stage share, plus the research and discussion movement in words with the `--data-rising` and
`--data-cooling` colours (words always, never colour alone). There is no surprise box. When there is
a surprise, it is the opening line of the moments section, as the section's dek ("Safety was barely
named… The two safety moments below are ranked 1 and 4."). It ties the surprise to specific moments.
The moments are equal-weight cards in a two-column grid on desktop and one column on a phone. The
stage table stays folded but is labelled "The full table, all 14 topics". The card shows the surprise
or moment 1 with its reading strip.

**Proposed new component:** the moment reading strip (`.moment__reading`). It reuses
`stageAgainstTrends` output and doesn't change it.

**Cost:** about 3 days, which is over the appetite. It needs the readings joined onto each point and
tests on the strip. To fit 2 days, drop the card change and the two-column grid.

## Recommendation

**B.** It is the only option that makes moment 1 feel like the reason to come to the page, and it
earns trust where the brief says it is weakest: every timestamp says whether that day was heard or
only read, and the surprise says who wrote it. It fits the 2-day appetite with a clear thing to drop.
A is cheaper but looks like the old page reordered. C is the richer idea but runs a day over and
crowds each quote with numbers.
