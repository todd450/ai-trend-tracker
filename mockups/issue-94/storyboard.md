# Issue #94: the stories and papers behind a rising move

Storyboard and option specs for the mockups. Read the brief on issue #94 first. Founder's decisions:
the smaller 3-day bet, D1 to D5 all (a). Each rising move named in the headline and the briefing
gets a short list, "What was counted". Falling moves get no list. Nothing changes in the call
rules, the track record, the reading list, the MCP server or the feed.

## Who and when

**The weekly reader.** Opens Trends about once a week, usually on a phone, often on a Monday. Reads
one sentence, e.g. "On Hacker News, data centers, chips & energy rose to 2.9% of AI stories, from
1.8%", and wants to know what that was about without leaving the page.

**The founder as editor.** Checks that a call is real and not a keyword accident. Over the next
three weeks he logs "explains it" or "doesn't" for each list.

## Storyboard

1. **Outside the product.** Monday morning. The reader hears in passing that "data centers are the AI
   story right now", or just keeps the weekly habit. They open the bookmarked Trends page on a phone.
   *Trust needed:* none yet. The page has to be quick and the same as last week.
2. **The claim.** On the 3-month view the headline reads, in display type: "Voice & speech fell to
   0.9% of AI papers, from 1.5%. On Hacker News, data centers, chips & energy rose to 2.9% of AI
   stories, from 1.8%." The track record beside it says themes held 6 of 12 times.
   *Trust needed:* that the number is right. *Earned today by:* the chart, the noise rule, the track record.
3. **The question.** "Rose because of what?" Today the page stops here. The figure is a percentage of a
   community's titles; nothing on the page is a story the reader could recognise.
4. **KEY MOMENT: the evidence is under the claim.** Without a tap, the reader sees three stories
   that were counted: "Banks are now trying to offload the AI data center debt they just
   underwrote" (386 points), "Intel D270 GPU AI Accelerator" (308), and a third. They recognise one,
   and the 2.9% becomes something that happened in the world.
   *Trust needed:*
   - that these items were really counted: they show the window (12 Oct to 8 Nov) and the count
     ("3 of 112 matching stories");
   - that they were not cherry-picked: the rule is printed ("most points first");
   - that the site is not claiming a reason: the label is "What was counted", never "Why".
5. **Out into the world.** The reader taps a title (opens the source) or the comment count (opens the
   Hacker News thread), reads, and comes back. *Trust needed:* that links go where they say. The
   source's domain is shown before the tap, as on the reading list.
6. **The fall, without a list.** The voice & speech fall shows its figures and nothing else, with
   one quiet line saying why. The reader should not take the empty space for a fault. *Trust needed:*
   that the absence is a rule, not a gap.
7. **A research rise (another view).** On the 1-month view, "Small & local models rose to 5.7% of AI
   papers, from 4.6%." The list is headed as examples ("3 of 398 papers counted") because three
   papers out of hundreds are not a reason. A paper upvoted on Hugging Face goes first and says so.
   *Trust needed:* that the page claims no more than it knows.
8. **Afterwards, outside the product.** The reader quotes the figure to a colleague with one story
   as the example. The founder, in his weekly check, opens the same list and logs "explains it" or
   "doesn't" in a `research` issue. The item he would flag on today's data is the self-replication
   story (frame 4's third item, see the content sheet). It matched "AI ... datacenter" but is about
   safety, not infrastructure.

The key moment is frame 4. Everything in the options is about what sits directly under the claim,
and how frames 6 and 7 read beside it.

## Stars for the key moment

- **1 star:** a "Search these on Hacker News" link under the headline that opens an Algolia search.
  It costs nothing, but it takes the reader off the page with no rule and no count.
- **3 stars:** a compact text line under the headline: "Most-discussed: Banks are now trying to
  offload… · Intel D270 GPU… · 112 stories counted."
- **5 stars:** three ledger rows under the rising move, each with source, date and points, plus the
  window, the count and the rule. Under a fall, one line saying why there is no list. Under a
  research rise, examples with the "of N papers" count.
- **7 stars:** the stories sit on the chart itself. Each item is marked at the week it landed inside
  the "latest 4 weeks" band, so the reader can see which stories coincide with the line going up.
  Each item shows the phrase it matched, so a keyword accident can be spotted at a glance.
- **9 stars:** splits the rise by sub-theme (data centers vs chips vs energy, whose counts are
  already stored) and shows which part did the lifting, with stories for that part.
- **11 stars:** on Monday the three moves arrive by email with their stories. Each topic has its own
  feed and archive of what was counted, week after week. Readers can follow one move over months.

**Appetite:** 3 days, one pull request. That allows 4 to 6 stars on the page. 7 stars is a stretch
(about 4 days, or 3 if papers move to a second pull request). 9 and above are later bets after the
check-back.

## Shared rules for every option

- **Page shown:** the 3-month view as it is today (headline, track record, the two-chart lead,
  sources line, the five-cell briefing strip, the "moved" line). Copy the live structure and wording;
  the reference is https://ai-trend-tracker-pearl.vercel.app/three-months at 1440 and 390 width.
  Change only what the option adds. Below the page, add one clearly labelled second state for frame 7:
  the 1-month view's lead for "Small & local models". Mark it as a mockup annotation (a thin rule
  and a small muted caption "Second state: the 1-month view, research rise"), not as product.
- **Tokens:** copy the `:root` block of `tokens.css`, including its dark-mode block, into the page's
  `<style>`. Use only those names. The fonts fall back to the stacks in `--font-display` and
  `--font-body` (no web fonts). Rising is `--data-rising`/`--data-rising-ink`. Cooling is
  `--data-cooling`/`--data-cooling-ink`. Links are `--color-accent`.
- **Components:** build list rows from the existing ledger row (`Ledger.tsx`: title, `ledger__note`
  host under it, figures in `ledger__data` columns, `ledger__extra` date), as the reading list uses
  for Hacker News stories and papers. The chart is the existing `LeadChart` panel; the strip is the
  existing `.brief` list. Anything new is named in the option below as a proposal.
- **Wording:** the list heading is "What was counted" for stories and "Examples of the papers
  counted" for research. Never "Why", "Because" or "Reason". No sentence written by a person or a
  model about the move.
- **Phone (390) and desktop (1440)**, both in the screenshots. English only; the site ships English
  only. Titles at their real length; never truncate a title with an ellipsis in a list row.
- **Falls get no list.** Every option shows voice & speech with no items.
- **No scripts, no web assets.** One self-contained HTML page. Links can point at the real URLs below.

## Content sheet (real items, from the windows' own searches)

**3-month view, data centers, chips & energy, Hacker News.** Window: weeks of 12 Oct to 2 Nov
(12 Oct to 8 Nov 2026). 112 matching stories of 3,805 AI stories (2.9%); the 4 weeks before: 72 of
4,054 (1.8%). Top three by points:

| # | Title | Source | Date | Points | Comments | Story / discussion |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Banks are now trying to offload the AI data center debt they just underwrote | startupfortune.com | 14 Oct | 386 | 277 | news.ycombinator.com/item?id=50092664 |
| 2 | Intel D270 GPU AI Accelerator – Up to 480 GB LPDDR5X | intel.com | 12 Oct | 308 | 179 | news.ycombinator.com/item?id=50063365 |
| 3 | AI models may be capable of self-replicating without access to a datacenter | anthropic.com | 12 Oct | 118 | 116 | news.ycombinator.com/item?id=50061603 |

Item 3 is a real keyword accident (it is about safety). Keep it: it is what the founder's check is for.
Where an option shows the matched phrase, the phrases are: 1 "AI data center", 2 "AI GPU", 3 "AI datacenter".
Next items, if an option needs more: "AI stocks slide as Texas governor result raises data center
risks" (cnbc.com, 4 Nov, 56 points, 79 comments); "American Voters Overwhelmingly Reject AI Data
Centers" (404media.co, 5 Nov, 61 points, 2 comments).

**3-month view, voice & speech, arXiv, cooling.** 0.9% of AI papers, was 1.5%, −40%. No list.

**1-month view, small & local models, arXiv, rising.** Window: 26 Oct to 8 Nov 2026. 398 papers of
7,024 AI papers (5.7%); the 2 weeks before: 358 of 7,738 (4.6%); +22%. Examples, Hugging Face
upvoted first:

| # | Title | Link | Date | Note |
| --- | --- | --- | --- | --- |
| 1 | Order-Only On-Policy Distillation | arxiv.org/abs/2611.02112 | 3 Nov | 35 upvotes on Hugging Face |
| 2 | Extreme Compression of Per-Layer Embeddings via Cross-Layer Latent Vector Quantization | arxiv.org/abs/2610.31309 | 27 Oct | 12 upvotes on Hugging Face |
| 3 | Language model capabilities fail in a shared, predictable order under compression and perturbation | arxiv.org/abs/2611.11695 | 8 Nov | arXiv search |

Matched phrases: 1 "knowledge distillation", 2 "quantization", 3 "quantization".

**Briefing strip, 3-month view (as live):** Research −40% "Voice & speech fell as a share of AI
papers." · Hacker News +66% "Data centers, chips & energy rose as a share of AI stories on Hacker
News." · Economy 7.3% · Releases 8 · Policy 31.

## The options

Each designer builds one. They differ in **where the evidence sits** and **how much it says about
itself**. Keep to your own option's difference; don't borrow the others'.

### A. Footnote under the headline (4 stars), "the receipt"

- **Key moment:** directly under the headline's dek (the "Latest week…" meta line), in the left
  column beside the track record, a block headed "What was counted". It holds one line of rule:
  "Data centers, chips & energy · the 3 most-discussed of 112 matching Hacker News stories,
  12 Oct – 8 Nov". Under it are three compact ledger rows: title linked, then host · date · points.
  Comments link to the thread.
- **Fall:** nothing under the headline for voice & speech; the block simply names only the rising
  move. No explanatory line.
- **Briefing strip:** the Hacker News cell gains a small "3 stories ↑" link back to the block. The
  Research cell is unchanged.
- **Research state (1-month):** the same block under that view's headline, headed "Examples of the
  papers counted", with "3 of 398 papers, 26 Oct – 8 Nov" and "Hugging Face ▲35" in the figure column.
- **What sets it apart:** the evidence is read in the same glance as the claim, above the charts,
  and nothing else on the page moves. It is the smallest change and the most text-like. The cost is
  that on a phone it pushes the track record and charts further down.
- **Cost:** about 2.5 days (collector 1, selection module and tests 1, page half a day). It fits
  the appetite with room to spare.

### B. Under each chart (5 to 6 stars), "evidence where the figure is", RECOMMENDED

- **Key moment:** each lead-chart panel gets a foot under its axis line, inside the panel's own
  column, so the evidence sits under the figure it explains. For the rising data centers panel:
  - a thin rule in `--data-rising`;
  - the heading "What was counted";
  - the rule line "The 3 most-discussed of 112 matching stories in the latest 4 weeks";
  - three ledger rows, each with the title (linked), host, date, and points and comments in the
    figure columns (comments link to the thread).
- **Fall:** the voice & speech panel's foot is one muted line in the same position: "No list under
  a fall: a fall means fewer papers, so no papers stand for it." The two columns stay level, and
  the absence reads as a rule.
- **Phone:** the panels stack, so each chart is followed by its own evidence (chart, list, next
  chart, its line).
- **Briefing strip:** the Hacker News cell's label links down to the list (the cells already link
  to their row). Add "3 stories counted" under its text in `--color-muted`.
- **Research state (1-month):** the panel foot is headed "Examples of the papers counted", with
  "3 of 398 papers in the latest 2 weeks · Hugging Face upvoted first". The rows show
  "▲35 on Hugging Face" for the first two, and "arXiv" for the third.
- **What sets it apart:** the list belongs to the chart, not the headline. The reader's eye goes
  claim, then line, then stories, and the fall gets an explicit "no list" line. That line does the
  trust work for frame 6, which A leaves silent.
- **New component (proposal):** a `LeadChart` panel foot (`leadchart__evidence`). It is a ledger
  inside the panel, set to three rows at all widths with no show-more.
- **Cost:** about 3 days (collector 1, module and tests 1, page 1). It fills the appetite. If it
  runs long, ship the Hacker News list first, as the brief allows.

### C. Stories on the line (7 stars), "see them land"

- **Key moment:** builds on B's panel foot and adds marks to the chart. Inside the "latest 4 weeks"
  band of the rising chart, each item gets a small square marker in `--data-rising` at the week it
  landed, lettered A, B, C. Letters, not the circled numbers the release marks already use. The rows
  under the chart carry the same letters.
- **Matched phrase:** each row shows the phrase that matched, in `--font-mono`, muted, e.g.
  `matched "AI datacenter"`. The founder can spot item C's keyword accident without opening it.
- **Fall:** the same no-list line as B.
- **Phone:** markers stay on the chart. The letters are at least 24px touch targets that jump to
  their row.
- **Research state (1-month):** papers marked on the line too, lettered, with the matched phrase.
- **What sets it apart:** it is the only option that ties each item to a point in time on the chart,
  and the only one that shows why each item was counted (its phrase). That makes the lists checkable
  as well as readable.
- **New components (proposals):** the `LeadChart` evidence foot (as B), story markers on the chart
  (`leadchart__item`), and a matched-phrase field the collector must store per item.
- **Cost:** about 4 days, over the 3-day appetite. Within appetite only if papers ship in a second
  pull request.

## Recommendation

**B.** It puts the stories exactly where the reader's question forms, under the line that went up,
and it says plainly why a fall has none. It fits the 3 days. A is cheaper but leaves the fall silent
and crowds the phone's first screen. C is the better tool for the founder's check, but it is over
appetite. Its matched-phrase field can be added to B later if the check-back finds keyword accidents.
