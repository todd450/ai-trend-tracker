/**
 * The non-technical themes the tracker follows: what AI is doing to work,
 * companies and society. Each theme is split into sub-themes, and each
 * sub-theme is a list of Hacker News title searches.
 * A story counts when its title contains every word of a search, so
 * "AI layoffs" matches "Layoffs blamed on AI". A search wrapped in double
 * quotes must appear as that exact phrase. Every search includes the
 * word AI, which makes each theme a subset of all AI stories.
 *
 * A theme's count is the distinct stories matching any of its sub-themes'
 * searches, so a sub-theme can never be larger than its theme. A story can
 * count toward more than one sub-theme.
 *
 * To follow a new theme or sub-theme, add an entry here and run
 * `npm run collect`. History for it is backfilled automatically.
 */
export type Subtheme = {
  id: string;
  name: string;
  hn: string[];
};

export type Theme = {
  id: string;
  name: string;
  blurb: string;
  parts: Subtheme[];
  /** Every search of every sub-theme, without repeats. */
  hn: string[];
};

const theme = (id: string, name: string, blurb: string, parts: Subtheme[]): Theme => ({
  id,
  name,
  blurb,
  parts,
  hn: [...new Set(parts.flatMap((p) => p.hn))],
});

/**
 * Searches whose words must appear in a title as written. Hacker News search also matches a word's
 * plural, which suits most searches but not these: "AI water" matched "muddying the waters" and a
 * fast-food order of "18,000 waters". Editing this list changes past counts too, so recount the
 * theme afterwards: `npm run collect -- --recount <theme id>`.
 */
export const HN_AS_WRITTEN = new Set(["AI water"]);

/** The extra Hacker News search settings for one of a theme's searches. */
export const hnWordRules = (search: string): Record<string, string> => (HN_AS_WRITTEN.has(search) ? { ignorePlurals: "false" } : {});

/** The key a sub-theme's weekly counts are stored under in history.json. */
export const subthemeKey = (themeId: string, partId: string) => `${themeId}.${partId}`;

export const THEMES: Theme[] = [
  theme("jobs", "Jobs & labor", "Hiring, layoffs and what AI does to work", [
    { id: "layoffs", name: "Layoffs & job losses", hn: ["AI layoffs", "AI unemployment", "AI fired", "AI cuts jobs"] },
    { id: "replacement", name: "Replacing people", hn: ["AI replace", "AI replacing", "AI replaced", "AI replaces", "AI automation"] },
    { id: "hiring", name: "Hiring & the job market", hn: ["AI hiring", "AI jobs", "AI employment", "AI recruiting", "AI graduates"] },
    { id: "workers", name: "Workers & unions", hn: ["AI workers", "AI labor", "AI workforce", "AI union", "AI strike"] },
  ]),
  theme("business", "Productivity & business adoption", "Measured gains and how companies put AI to use", [
    { id: "productivity", name: "Measured productivity", hn: ["AI productivity", "AI ROI", "AI efficiency"] },
    { id: "economy", name: "The wider economy", hn: ["AI economy", "AI economic", "AI GDP"] },
    { id: "adoption", name: "Company adoption", hn: ["AI adoption", "enterprise AI", "AI enterprises", "AI business", "AI workplace"] },
    { id: "ceos", name: "What executives say", hn: ["AI CEO", "AI CEOs", "AI executives"] },
  ]),
  theme("investment", "Investment & the bubble question", "Spending, revenue and valuations", [
    { id: "bubble", name: "Bubble talk", hn: ["AI bubble", "AI hype", "AI crash"] },
    { id: "spending", name: "Capital spending", hn: ["AI spending", "AI capex", "AI investment", "AI billion"] },
    { id: "funding", name: "Funding & valuations", hn: ["AI funding", "AI valuation", "AI IPO", "AI raises"] },
    { id: "revenue", name: "Revenue & profits", hn: ["AI revenue", "AI profit", "AI profits", "AI losses"] },
  ]),
  theme("infrastructure", "Data centers, chips & energy", "The physical build-out behind the models", [
    { id: "datacenters", name: "Data centers", hn: ["AI data center", "AI data centers", "AI datacenter", "AI datacenters"] },
    { id: "chips", name: "Chips & supply", hn: ["AI chips", "AI chip", "AI GPU", "AI GPUs", "AI semiconductor"] },
    { id: "energy", name: "Energy & the grid", hn: ["AI energy", "AI electricity", "AI nuclear", "AI grid"] },
    { id: "environment", name: "Water & environment", hn: ["AI water", "AI emissions", "AI climate", "AI carbon"] },
  ]),
  // "Act", "bill" and "order" have everyday meanings, so those are matched as exact phrases.
  theme("regulation", "Regulation & law", "Rules, bills, courts and copyright", [
    { id: "rules", name: "Rules & legislation", hn: ["AI regulation", '"AI Act"', '"AI bill"', "AI legislation", "AI law", "AI policy", "AI ban"] },
    { id: "government", name: "Lawmakers & government", hn: ["AI lawmakers", "AI Congress", "AI Senate", 'AI "executive order"', "AI EU"] },
    { id: "copyright", name: "Copyright & training data", hn: ["AI copyright", "AI licensing", 'AI "fair use"'] },
    { id: "courts", name: "Lawsuits & courts", hn: ["AI lawsuit", "AI court", "AI sued", "AI sues", "AI judge"] },
  ]),
  theme("education", "Education", "Students, teachers and schools", [
    { id: "cheating", name: "Cheating & integrity", hn: ["AI cheating", "AI plagiarism", "AI essays", "AI detector"] },
    { id: "schools", name: "Schools & teachers", hn: ["AI schools", "AI school", "AI teachers", "AI classroom"] },
    { id: "universities", name: "Universities & students", hn: ["AI university", "AI universities", "AI college", "AI students"] },
    { id: "learning", name: "Teaching & tutoring", hn: ["AI education", "AI tutor", "AI tutoring"] },
  ]),
  theme("trust", "Public trust & backlash", "Opinion, low-quality output and pushback", [
    { id: "slop", name: "Slop & spam", hn: ["AI slop", "AI spam"] },
    { id: "misinformation", name: "Misinformation & deepfakes", hn: ["AI misinformation", "AI disinformation", "AI deepfake", "AI deepfakes", "AI fake"] },
    { id: "opinion", name: "Public opinion", hn: ["AI survey", "AI poll", "AI trust"] },
    { id: "backlash", name: "Backlash & protest", hn: ["AI backlash", "AI boycott", "AI protest", "anti AI"] },
  ]),
];
