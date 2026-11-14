/**
 * Lets a test in `npm test`, or the collector, import the site's own modules in plain Node. They are written for
 * Next's bundler, which resolves `@/` to src/, finds a file without its `.ts` extension and reads
 * JSON without an import attribute; these hooks do the same three things and nothing else.
 *
 * Import this file first, then load the site's modules with `await import(...)`, since a static
 * import would be resolved before the hooks are in place.
 */
import { existsSync, readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";

type Resolved = { url: string };
type Loaded = { format?: string; source?: string | Uint8Array; shortCircuit?: boolean };
type Hooks = {
  resolve(specifier: string, context: { parentURL?: string }, nextResolve: (s: string, c: object) => Resolved): Resolved;
  load(url: string, context: object, nextLoad: (u: string, c: object) => Loaded): Loaded;
};
// In Node since 22.15; the project's @types/node predates it.
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: Hooks) => void };

const SRC = new URL("../../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
    const local = target.startsWith(".") || target.startsWith("file:");
    if (local && context.parentURL && !/\.[a-z]+$/i.test(target)) {
      const base = new URL(target, context.parentURL).href;
      const found = [".ts", "/index.ts"].map((ext) => base + ext).find((url) => existsSync(fileURLToPath(url)));
      if (found) target = found;
    }
    return nextResolve(target, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".json")) {
      return { format: "module", source: `export default ${readFileSync(fileURLToPath(url), "utf8")};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

/** Imports a module under src/ by its path there, such as "lib/trends". */
export const fromSrc = <T = Record<string, unknown>>(path: string): Promise<T> => import(new URL(`${path}.ts`, SRC).href);
