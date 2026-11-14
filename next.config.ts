import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The six-month view was first published as /long-term, and the day's news at /today before
  // it became the landing page.
  redirects: async () => [
    { source: "/long-term", destination: "/six-months", permanent: true },
    { source: "/today", destination: "/", permanent: true },
  ],
};

export default nextConfig;
