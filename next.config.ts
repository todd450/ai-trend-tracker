import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The six-month view was first published as /long-term.
  redirects: async () => [{ source: "/long-term", destination: "/six-months", permanent: true }],
};

export default nextConfig;
