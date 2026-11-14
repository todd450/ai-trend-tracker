# Issue #76: a "This week" block at the top of the reading list

Storyboard and option specs for the founder's decision "Smaller bet" (14 Nov). Settled already
and not reopened here: items chosen by fixed rules with the editor's pin and hide as overrides; a
rolling past-seven-days window rebuilt daily; no "new since your last visit" marker; the eight lists
stay on `/reading` below the block, with their anchors; MCP and the Atom feed unchanged.

Appetite: **3 days, one pull request.** No-gos: no language model, no outside service, no new
dependency, no tracking of readers, no change to the lists' contents or the trend figures, no
change to the Today page.

## Who

**The weekly reader**: follows AI for work, opens the site once a week (often on a phone),
wants to be done in about ten minutes knowing what happened and which trend it feeds. **The
founder** is the same reader and the only one whose reading is logged. Not for someone hunting a
particular paper or repo: the lists below serve them, unchanged.

## The journey, frame by frame

1. **Outside the product. Monday, before a meeting.** "What happened in AI this week?" There is
   no email or notification (the site stores nothing about readers), so the reader comes from a
   bookmark, from Today's "The week's top stories" link, or from a shared `/reading#news` link.
   *Trust:* a shared link must still land on its list, not on the new block.
2. **Arrives on `/reading`.** Masthead, page tabs (Reading list current), "The reading list" and its
   dek. Today, the next thing is 114 links over about 7.5 phone screens in eight source lists.
   *Trust:* is this current? The mast says "Updated 14 November 2026".
3. **KEY MOMENT. The first one to two phone screens: the "This week" block.** The reader takes
   in about seven items under one stated window ("the past seven days, to 14 November"), each tied
   to a trend and how that trend is moving, launches first. In under a minute they decide either
   "I'm caught up" or "I want more on X". *Trust:* that it covers the week's big things (and is
   honest about what it leaves out: "Anthropic IPO", 996 points, has no trend tag); that the line
   under an item is about its **trend**, read from the tracker's own figures by a rule, not a
   claim about the item; that a pinned note is the editor speaking.
4. **Follows one out.** A headline opens the source in a new tab (as every link on the page does);
   a trend tag opens the trend's row on the topics page or the front page.
5. **Goes deeper, or not.** A row of jump links under the block (In the news, Papers, From the
   analysts, Lab announcements, Launches, Repositories, Models trending, New from the labs) takes
   them to the unchanged lists.
6. **Outside the product. In the meeting.** "Google shipped Gemini 4 Hydrogen; Claude talk is
   steady despite Fable 5.2." The founder logs minutes taken and anything missing in a `research`
   issue (the check-back's evidence).

The options below differ only at frame 3 (and how frame 5 is attached to it). Frames 1, 2, 4 and
6 are the same in all of them.

## Stars, for the key moment

- **1 star:** a sentence above the lists: "The week's lists, by source" and the eight jump links.
  Gets you around the page; tells you nothing about the week.
- **3 stars:** the top seven tagged headlines in a flat list with their tags.
- **5 stars:** about seven items, grouped by the trend they feed, launches first, each trend's
  movement stated by rule, one window, honest about what rules missed, and the whole block in two
  phone screens. You leave knowing what happened and which way it pushes.
- **7 stars:** a real "why it matters" sentence for every item, a frozen weekly issue you can cite,
  and the items you have already seen quietly folded away.
- **9 to 11 stars:** a colleague who has read everything this week, knows what you care about, and
  briefs you in three sentences before the meeting, on whatever you happen to be holding.

The appetite and the no-gos (no model, nothing stored about readers, no frozen issues) cap this at
**4 to 6 stars**. The three options sit at 4, 5 and 6.

## Real content for every mockup (14 Nov data, window 7 to 14 November)

Use these exact strings. Trend lines follow the rule's sentence form (`trendLine` in
`src/lib/sentences.ts`); the weekly figures were read by hand from `data/history.json` and are
close to what the rule prints, not computed by it. Points are Hacker News points.

The week's chosen items (lab launches first, then rising, then steady; at most two per trend;
seven in all):

| Trend (tag) | Call | Trend line | Items |
|---|---|---|---|
| Claude | steady | "Claude on Hacker News over three months: steady, with 77 stories a week in the last 4 weeks against 76 in the 4 weeks before." | **Claude Fable 5.2 and Mythos 5.2** (news.ycombinator.com, 1,000 points, 9 Nov; frontier-lab launch). Same story: "Fable 5.2 and Jagged AGI" (One Useful Thing). / **Goodbye Claude, hello Pi** (829 points, 8 Nov) |
| Gemini | steady | "Gemini on Hacker News over three months: steady, with 22 stories a week in the last 4 weeks against 19 in the 4 weeks before." | **Introducing Gemini 4 Hydrogen** (Google DeepMind, 12 Nov; frontier-lab launch). Same story: "Gemini 4 Carbon is now available" (Google DeepMind, 10 Nov). / **Google Gemini routes personal Drive files and emails to human annotators** (737 points, 9 Nov) |
| AI agents | steady | "AI agents on Hacker News over three months: steady, with 191 stories a week in the last 4 weeks against 187 in the 4 weeks before." | **My AI agents found an unmapped Maya site?** (1,035 points, 11 Nov) / **United Airlines bans AI agents from booking flights on behalf of travelers** (677 points, 11 Nov) |
| Claude Code | rising | "Claude Code on Hacker News over three months: rising, with 60 stories a week in the last 4 weeks against 54 in the 4 weeks before." | **Goldman Sachs is pulling Claude Code from its bankers and traders** (905 points, 8 Nov) |

Order the groups, in every option: Claude (the lab launch with the most discussion), Gemini (the
other lab launch), then Claude Code (rising), then AI agents (steady). Option A and C number or
list items in that same order.

Editor's pin note: `data/editorial.json` has no pins today, so this one is a sample, there only to
show what a pin looks like. Put it on "Introducing Gemini 4 Hydrogen": "Editor's note: read it
beside Gemini 4 Carbon, released two days earlier." Mark it as the editor's, distinct from the
rule's line.

What rules missed (for the honesty line): **Anthropic IPO** (996 points, 12 Nov, In the news) and
**Nvidia allegedly engineered scarcity by funding AI startups to buy its GPUs** (747 points). Both
have no trend tag, so the rules leave them out.

Below the block, show the page as it is: the jump-link row, then the start of "In the news" (its
band head, dek and first three rows: My AI agents found an unmapped Maya site? 1,035 / Claude Fable
5.2 and Mythos 5.2 1,000 / Anthropic IPO 996) beside "Papers getting attention" on desktop (the
`.pair` layout). That is enough to show the block sits on the existing page.

## Rules for every page

- One self-contained HTML file, inline CSS, no web fonts or scripts from the web. Copy the
  **light** values from `tokens.css` into `:root` as they are (colours, type scale, spacing,
  radius, rule widths); font stacks fall back to "Iowan Old Style", "Palatino Linotype", serif for
  display and "Helvetica Neue", sans-serif for body. Add the dark values under
  `prefers-color-scheme: dark` too if it costs nothing.
- Build from the site's existing pieces in `src/app/globals.css`: `.mast` and `.tabs` (the
  masthead with "Updated 14 November 2026" and the five page tabs, Reading list current),
  `.chapter__head`, `.band__head`, `.ledger` rows, `.tag` (the 24px-tall trend label),
  `.top-story` and its `__kicker`, `__meta`, `__why`, `__note`. Read `src/components/ReadingList.tsx`
  and `src/components/Today.tsx` for markup. Anything not built from these is a **new component**
  and is named in the option's spec below; don't add others.
- Phone 390px and desktop 1440px (`--page-max` 76rem). Long headlines wrap; nothing truncates
  with an ellipsis in the block. Tap targets at least 24px.
- English only (the site ships in English). No lorem ipsum, no invented headlines.
- The block's own heading is "This week" (an `h2`, under the page's `h1`), followed by the
  window: "The past seven days, to 14 November. Chosen by rule from the lists below: stories that
  name a trend the site tracks, launches first." Each option may set that line differently but
  keeps its words.
- The jump links row: "All the lists:" then the eight names linking to `#news`, `#papers`,
  `#analysis`, `#announcements`, `#launches`, `#code`, `#models`, `#labs`. Plain links, wrapping
  on a phone, not a horizontal scroller.
- **Success test from the brief:** on the phone screenshot, page top to the end of the block
  (including the jump links) fits in **two phone screens (about 1,690px at 390 wide)**. Say in the
  commit message whether it does.

---

## Option A: The week in seven lines (4 stars)

**What it does.** The block is a numbered list of seven headlines, one row each, launches first,
in the site's ledger style, each with its source, points and its trend tag. The trend's line sits
in small muted type under the row, so the reader scans seven headlines first and reads the "why"
only if they want it.

**Layout.**
- A `.ledger`-style ordered list numbered 1 to 7 (the ledger's own counter). Each row: headline
  link, then in `ledger__data` the source ("Hacker News", "Google DeepMind") and points if any,
  then a `ledger__also` line holding the `.tag` and the trend line in `--text-sm`, `--color-muted`.
- Repeat the trend line on every item (Claude's line appears twice, on items 1 and 2). That is the
  honest cost of a flat list, and the founder should see it.
- Merged posts: "Same story: Fable 5.2 and Jagged AGI (One Useful Thing)" in the `ledger__also`
  line, as Today does.
- Lab launches get a small `ledger__pick`-style label: "Lab launch".
- The pin note shows as Today shows a pinned row's note, prefixed "Editor's note:".
- Honesty: one muted line under the list: "Big stories with no trend tag are left out; they are in
  the lists below."
- Then the jump-links row, then the lists.

**What sets it apart.** No grouping and no new component: it is Today's list pattern moved to
`/reading`. Fastest to read for headlines, weakest on "you know why" since the trend line repeats
and reads as boilerplate.

**New component:** none.

**Cost:** about 2 days (selection function with tests, plus one ledger in the existing style).
Leaves a day of the 3-day appetite spare.

## Option B: Grouped by trend (5 stars, recommended)

**What it does.** The block is four short groups, one per trend, each headed by the trend's tag
and its call (rising, steady), with the trend line said **once** under the heading and up to two
headlines beneath it. The reader sees which way each trend is moving and what this week fed it,
so the "why" is about the trend, which is what the rule can honestly say.

**Layout.**
- Each group: a heading row with the trend name as the existing `.tag` link (slightly larger is
  fine but keep the tag's border and radius), then the call as a word in the data colours
  (`--data-rising-ink` for rising, `--data-steady` for steady; never colour alone, the word is
  always printed). Under it the trend line in `--text-sm`, `--color-ink-2`, prefixed "Why it
  matters:" in bold as on Today's top story.
- Then one or two headlines as links in the body size, each with a muted meta line (source,
  points, day). A lab launch carries the small "Lab launch" label in `--color-accent`, styled like
  `.top-story__kicker`. Merged posts as "Same story: …" in the meta line.
- The pin note sits under its headline as "Editor's note: …", in `--color-ink-2`, visually
  distinct from the rule's line (e.g. a hairline left rule in `--color-rule-strong`), so the two
  voices never blur.
- Desktop: the four groups in a two-column grid (two rows of two), hairline rules between, like
  `.pair`. Phone: one column, groups separated by hairlines.
- Honesty, under the groups: "Left out because they name no tracked trend: Anthropic IPO (996
  points) and one more. They are in the lists below." Linking "Anthropic IPO" to `#news`.
- Then the jump-links row, then the lists.

**What sets it apart.** The only option organised by trend rather than by item. Says each trend
line once, so the block is shorter and the "why" reads as a finding, not a repeated caption. The
"left out" line names the biggest miss, so the reader can trust the block's edges.

**New component:** the trend group (heading tag + call + line + up to two headlines). Proposed as
a new component for this page only; not shared with Today.

**Cost:** about 3 days (selection and grouping with tests, the group component, the "left out"
line). Fits the appetite with no slack; if it runs over, drop cross-source merging first, as the
brief says.

## Option C: One lead and six short rows (6 stars)

**What it does.** The week's biggest launch is set large at the top of the block, exactly in the
style of Today's top story (kicker, headline, meta, tags, "Why it matters" line, same-story list),
and the other six items follow as short single-line rows with their tags. The reader gets one
clear "this is the story of the week" and a quick scan of the rest.

**Layout.**
- Lead: Claude Fable 5.2 and Mythos 5.2, using `.top-story` styling copied into the page
  (kicker: "The week's lab launch: Anthropic, discussed on Hacker News", headline at
  `--text-2xl`, meta line, `Claude` tag, "Why it matters:" Claude's line, then "Same story: Fable
  5.2 and Jagged AGI (One Useful Thing)").
- Then six compact rows, in this order: Goodbye Claude, hello Pi; Introducing Gemini 4 Hydrogen
  (with its "Lab launch" label and the pin note); Google Gemini routes personal Drive files…;
  Goldman Sachs is pulling Claude Code…; My AI agents found an unmapped Maya site?; United
  Airlines bans AI agents… (full headlines from the table above). Set them as a tight
  list: headline, then on the same line on desktop (next line on phone) the tag and points. **No
  trend line on these rows**: the tag links to the trend for anyone who wants it. That is what
  keeps it within two phone screens.
- Desktop: lead on the left (about 60%), the six rows in a column on the right, so the block is
  one screen high; phone: lead then rows.
- Honesty under the rows, as in B, naming Anthropic IPO.
- Then the jump-links row, then the lists.

**What sets it apart.** The only option with a hierarchy: one story of the week, the rest
secondary, so it reads most like an edition. It drops the trend line from six of seven items,
trading "you know why" for speed, and it leans on the lead-choosing rule (lab launch first, else
the highest-points tagged story) being right every week.

**New component:** none in the site's sense; it copies `.top-story` (the brief says copy, don't
share with Today) and uses a compact row variant of the ledger. Call the compact row out as a
small new variant.

**Cost:** about 3 days, the lead rule is extra logic with its own tests and a weekly risk of an
odd lead; no slack in the appetite.

---

## Recommendation: B

B is the one that delivers the north star's "and you know why" honestly with what rules can say:
the line is about a trend, so it is said once per trend, not pasted under every headline (A) or
dropped from most of them (C). It is also the shortest on a phone of the options that keep the
line, and its "left out" line is what lets a reader trust a block chosen by rules that only tag
about four in ten items.
