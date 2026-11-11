/**
 * The developer toolkits whose downloads stand in for how much AI is being built with.
 * Each toolkit is the set of packages a developer installs to use it:
 * `pypi` names are Python packages, `npm` names are JavaScript packages.
 * A toolkit that was renamed lists both names, so a move between them is not read as a fall.
 *
 * To follow a new toolkit, add an entry here and run `npm run collect`.
 * npm gives a year of history at once; PyPI gives about six months.
 */
export type Toolkit = {
  id: string;
  name: string;
  /** "lab" is a model maker's own toolkit; "tool" is a library for building on any model. */
  kind: "lab" | "tool";
  blurb: string;
  pypi: string[];
  npm: string[];
};

export const TOOLKITS: Toolkit[] = [
  { id: "openai", name: "OpenAI", kind: "lab", blurb: "OpenAI’s official toolkits for GPT models", pypi: ["openai"], npm: ["openai"] },
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "lab",
    blurb: "Anthropic’s official toolkits for Claude models",
    pypi: ["anthropic"],
    npm: ["@anthropic-ai/sdk"],
  },
  {
    id: "google",
    name: "Google Gemini",
    kind: "lab",
    blurb: "Google’s official toolkits for Gemini models, current and previous names",
    pypi: ["google-genai", "google-generativeai"],
    npm: ["@google/genai", "@google/generative-ai"],
  },
  {
    id: "mistral",
    name: "Mistral",
    kind: "lab",
    blurb: "Mistral’s official toolkits",
    pypi: ["mistralai"],
    npm: ["@mistralai/mistralai"],
  },
  { id: "cohere", name: "Cohere", kind: "lab", blurb: "Cohere’s official toolkits", pypi: ["cohere"], npm: ["cohere-ai"] },
  {
    id: "mcp",
    name: "Model Context Protocol",
    kind: "tool",
    blurb: "The standard for connecting models to tools and data",
    pypi: ["mcp"],
    npm: ["@modelcontextprotocol/sdk"],
  },
  {
    id: "transformers",
    name: "Hugging Face Transformers",
    kind: "tool",
    blurb: "The main library for running open models",
    pypi: ["transformers"],
    npm: ["@huggingface/transformers"],
  },
  { id: "vercel-ai", name: "Vercel AI SDK", kind: "tool", blurb: "A library for adding AI to web apps", pypi: [], npm: ["ai"] },
  {
    id: "langchain",
    name: "LangChain",
    kind: "tool",
    blurb: "A framework for chaining model calls into applications",
    pypi: ["langchain"],
    npm: ["langchain"],
  },
  {
    id: "llamaindex",
    name: "LlamaIndex",
    kind: "tool",
    blurb: "A framework for connecting models to documents",
    pypi: ["llama-index"],
    npm: ["llamaindex"],
  },
];

/** The key a package's monthly downloads are stored under in data/indicators.json. */
export const packageKey = (registry: "pypi" | "npm", name: string) => `${registry}:${name}`;

export const packageKeys = (t: Toolkit) => [
  ...t.pypi.map((name) => packageKey("pypi", name)),
  ...t.npm.map((name) => packageKey("npm", name)),
];
