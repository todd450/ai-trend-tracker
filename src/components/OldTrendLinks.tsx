"use client";

import { useEffect } from "react";

/**
 * The three-month trends were the landing page before the day's news was, so links already out
 * in the world name its rows and sections as `/#product-…` or `/#indicators`. A server never sees
 * the part of an address after `#`, so the landing page forwards them itself: a fragment that
 * names nothing here is followed on the trends page, where it still lands.
 */
export function OldTrendLinks({ to }: { to: string }) {
  useEffect(() => {
    // Used as it is, never decoded: decoding would throw on a malformed link (`/#%`).
    const { hash } = window.location;
    if (hash.length > 1 && !document.getElementById(hash.slice(1))) window.location.replace(to + hash);
  }, [to]);
  return null;
}
