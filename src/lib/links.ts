/**
 * Spread onto every link that leaves the site, so it opens in a new tab and the reader keeps
 * their place here. Links within the site (section anchors, the other views) stay in the same tab.
 */
export const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

/** "example.org" for a link to https://www.example.org/post, or nothing when the address cannot be read. */
export function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
