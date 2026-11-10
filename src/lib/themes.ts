/**
 * The non-technical themes the tracker follows: what AI is doing to work,
 * companies and society. Each theme is a list of Hacker News title searches.
 * A story counts when its title contains every word of a search, so
 * "AI layoffs" matches "Layoffs blamed on AI". A search wrapped in double
 * quotes must appear as that exact phrase. Every search includes the
 * word AI, which makes each theme a subset of all AI stories.
 *
 * To follow a new theme, add an entry here and run `npm run collect`.
 * History for it is backfilled automatically.
 */
export type Theme = {
  id: string;
  name: string;
  blurb: string;
  hn: string[];
};

export const THEMES: Theme[] = [
  {
    id: "jobs",
    name: "Jobs & labor",
    blurb: "Hiring, layoffs and what AI does to work",
    hn: ["AI jobs", "AI layoffs", "AI hiring", "AI workers", "AI labor", "AI workforce", "AI employment", "AI unemployment"],
  },
  {
    id: "business",
    name: "Productivity & business adoption",
    blurb: "Measured gains and how companies put AI to use",
    hn: ["AI productivity", "AI economy", "AI economic", "AI GDP", "AI adoption", "enterprise AI", "AI enterprises", "AI ROI", "AI workplace", "AI business"],
  },
  {
    id: "investment",
    name: "Investment & the bubble question",
    blurb: "Spending, revenue and valuations",
    hn: ["AI bubble", "AI spending", "AI capex", "AI funding", "AI valuation", "AI investment", "AI revenue", "AI IPO"],
  },
  {
    id: "infrastructure",
    name: "Data centers, chips & energy",
    blurb: "The physical build-out behind the models",
    hn: ["AI data center", "AI datacenter", "AI chips", "AI energy", "AI electricity", "AI water"],
  },
  {
    id: "regulation",
    name: "Regulation & law",
    blurb: "Rules, bills, courts and copyright",
    // "Act" and "bill" have everyday meanings, so those two are matched as exact phrases.
    hn: ["AI regulation", '"AI Act"', '"AI bill"', "AI legislation", "AI lawmakers", "AI Congress", "AI Senate", "AI law", "AI policy", "AI copyright", "AI lawsuit", "AI court", "AI ban"],
  },
  {
    id: "education",
    name: "Education",
    blurb: "Students, teachers and schools",
    hn: ["AI students", "AI schools", "AI education", "AI teachers", "AI cheating", "AI university"],
  },
  {
    id: "trust",
    name: "Public trust & backlash",
    blurb: "Opinion, low-quality output and pushback",
    hn: ["AI slop", "AI trust", "AI backlash", "AI misinformation", "AI deepfake", "AI survey", "AI poll"],
  },
];
