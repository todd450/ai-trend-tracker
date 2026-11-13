/**
 * The AI products the tracker follows. Each product has two measures:
 * `hn` phrases are matched against Hacker News story titles, as exact phrases;
 * `wiki` lists the titles of its English Wikipedia article, whose views are summed.
 *
 * Wikipedia articles are renamed often (five on this list moved in 2026), and views
 * are recorded under the title of the day. So `wiki` keeps every title the article has
 * carried in the past year, newest first. When an article is renamed, its views
 * collapse, the collector turns the figure away and the source shows as stale: add
 * the new title here. A product with no article of its own has an empty list.
 *
 * A name that is also an ordinary word ("Runway") is searched in a narrower form.
 * To follow a new product, add an entry here and run `npm run collect`; a year of
 * history for it is backfilled automatically.
 */
export type Product = {
  id: string;
  name: string;
  kind: "assistant" | "coding" | "media";
  blurb: string;
  hn: string[];
  wiki: string[];
};

export const PRODUCT_KINDS: Record<Product["kind"], string> = {
  assistant: "assistant",
  coding: "coding tool",
  media: "image, video and voice",
};

export const PRODUCTS: Product[] = [
  { id: "chatgpt", name: "ChatGPT", kind: "assistant", blurb: "OpenAI’s assistant", hn: ["ChatGPT"], wiki: ["ChatGPT"] },
  { id: "claude", name: "Claude", kind: "assistant", blurb: "Anthropic’s assistant and models", hn: ["Claude"], wiki: ["Claude (AI)", "Claude (language model)"] },
  { id: "gemini", name: "Gemini", kind: "assistant", blurb: "Google’s assistant and models", hn: ["Gemini"], wiki: ["Google Gemini", "Gemini (chatbot)"] },
  { id: "copilot", name: "Copilot", kind: "assistant", blurb: "Microsoft’s assistants, GitHub Copilot included", hn: ["Copilot"], wiki: ["Microsoft Copilot", "GitHub Copilot"] },
  { id: "grok", name: "Grok", kind: "assistant", blurb: "xAI’s assistant", hn: ["Grok"], wiki: ["Grok (chatbot)"] },
  { id: "deepseek", name: "DeepSeek", kind: "assistant", blurb: "DeepSeek’s assistant and models", hn: ["DeepSeek"], wiki: ["DeepSeek (AI)", "DeepSeek (chatbot)"] },
  { id: "perplexity", name: "Perplexity", kind: "assistant", blurb: "Answer engine that searches the web", hn: ["Perplexity"], wiki: ["Perplexity AI"] },
  { id: "meta-ai", name: "Meta AI", kind: "assistant", blurb: "Meta’s assistant", hn: ["Meta AI"], wiki: ["Meta AI"] },
  { id: "notebooklm", name: "NotebookLM", kind: "assistant", blurb: "Google’s research notebook", hn: ["NotebookLM"], wiki: ["Gemini Notebook", "NotebookLM"] },
  { id: "claude-code", name: "Claude Code", kind: "coding", blurb: "Anthropic’s coding agent", hn: ["Claude Code"], wiki: [] },
  { id: "codex", name: "Codex", kind: "coding", blurb: "OpenAI’s coding agent", hn: ["Codex"], wiki: ["OpenAI Codex", "Codex (AI agent)"] },
  { id: "cursor", name: "Cursor", kind: "coding", blurb: "Code editor built around an AI agent", hn: ["Cursor"], wiki: ["Cursor (company)", "Cursor (code editor)"] },
  { id: "antigravity", name: "Antigravity", kind: "coding", blurb: "Google’s agent-first code editor", hn: ["Antigravity"], wiki: ["Google Antigravity"] },
  { id: "devin", name: "Devin", kind: "coding", blurb: "Cognition’s software-engineering agent", hn: ["Devin"], wiki: ["Devin AI"] },
  { id: "replit", name: "Replit", kind: "coding", blurb: "Browser workspace that builds apps from a prompt", hn: ["Replit"], wiki: ["Replit"] },
  { id: "ollama", name: "Ollama", kind: "coding", blurb: "Runs open models on your own computer", hn: ["Ollama"], wiki: ["Ollama"] },
  { id: "openclaw", name: "OpenClaw", kind: "coding", blurb: "Open-source personal agent", hn: ["OpenClaw"], wiki: ["OpenClaw"] },
  { id: "midjourney", name: "Midjourney", kind: "media", blurb: "Image generator", hn: ["Midjourney"], wiki: ["Midjourney"] },
  { id: "stable-diffusion", name: "Stable Diffusion", kind: "media", blurb: "Stability AI’s open image models", hn: ["Stable Diffusion"], wiki: ["Stable Diffusion"] },
  { id: "sora", name: "Sora", kind: "media", blurb: "OpenAI’s video generator", hn: ["Sora"], wiki: ["Sora (text-to-video model)"] },
  { id: "veo", name: "Veo", kind: "media", blurb: "Google’s video generator", hn: ["Veo"], wiki: ["Veo (text-to-video model)"] },
  { id: "runway", name: "Runway", kind: "media", blurb: "Video generation and editing", hn: ["Runway AI", "RunwayML", "Runway Gen"], wiki: ["Runway (company)"] },
  { id: "suno", name: "Suno", kind: "media", blurb: "Music generator", hn: ["Suno"], wiki: ["Suno", "Suno AI"] },
  { id: "elevenlabs", name: "ElevenLabs", kind: "media", blurb: "Voice generation", hn: ["ElevenLabs"], wiki: ["ElevenLabs"] },
];
