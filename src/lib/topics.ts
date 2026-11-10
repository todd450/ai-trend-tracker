/**
 * The topics the tracker follows. Each topic is a set of search phrases:
 * `arxiv` phrases are matched against paper titles and abstracts,
 * `hn` phrases against Hacker News story titles.
 *
 * To follow a new topic, add an entry here and run `npm run collect`.
 * History for it is backfilled automatically.
 */
export type Topic = {
  id: string;
  name: string;
  blurb: string;
  arxiv: string[];
  hn: string[];
};

export const TOPICS: Topic[] = [
  {
    id: "agents",
    name: "AI agents",
    blurb: "Systems that plan and take actions on their own",
    arxiv: ["LLM agent", "AI agent", "agentic", "autonomous agent"],
    hn: ["AI agent", "AI agents", "agentic"],
  },
  {
    id: "coding",
    name: "AI coding tools",
    blurb: "Code generation and software-engineering agents",
    arxiv: ["code generation", "coding agent", "software engineering agent", "program synthesis"],
    hn: ["coding agent", "coding agents", "vibe coding", "Claude Code", "Codex"],
  },
  {
    id: "reasoning",
    name: "Reasoning models",
    blurb: "Models that think step by step before answering",
    arxiv: ["chain-of-thought", "reasoning model", "test-time compute", "extended thinking"],
    hn: ["reasoning model", "reasoning models", "chain of thought"],
  },
  {
    id: "rag",
    name: "Retrieval (RAG)",
    blurb: "Grounding model answers in retrieved documents",
    arxiv: ["retrieval-augmented", "RAG"],
    hn: ["RAG", "retrieval augmented"],
  },
  {
    id: "tools",
    name: "Tool use & MCP",
    blurb: "Connecting models to external tools and data",
    arxiv: ["Model Context Protocol", "tool calling", "function calling", "tool use"],
    hn: ["MCP", "Model Context Protocol", "tool calling"],
  },
  {
    id: "memory",
    name: "Memory & context",
    blurb: "Long-term memory and context management for models",
    arxiv: ["long-term memory", "agent memory", "context engineering", "memory-augmented"],
    hn: ["context engineering", "agent memory", "context window"],
  },
  {
    id: "multimodal",
    name: "Multimodal models",
    blurb: "Models that combine text, images, audio and video",
    arxiv: ["vision-language model", "multimodal large language model", "multimodal LLM"],
    hn: ["multimodal", "vision language model"],
  },
  {
    id: "generative-media",
    name: "Image & video generation",
    blurb: "Diffusion and other generative media models",
    arxiv: ["diffusion model", "video generation", "text-to-image", "image generation"],
    hn: ["image generation", "video generation", "diffusion model", "text-to-video"],
  },
  {
    id: "voice",
    name: "Voice & speech",
    blurb: "Speech recognition, synthesis and voice assistants",
    arxiv: ["text-to-speech", "speech recognition", "spoken dialogue", "speech synthesis"],
    hn: ["text-to-speech", "voice AI", "speech-to-text", "voice agent"],
  },
  {
    id: "robotics",
    name: "Robotics & embodied AI",
    blurb: "AI that perceives and acts in the physical world",
    arxiv: ["embodied", "vision-language-action", "robot learning", "humanoid"],
    hn: ["humanoid", "robotics", "robot"],
  },
  {
    id: "world-models",
    name: "World models",
    blurb: "Models that learn to simulate environments",
    arxiv: ["world model"],
    hn: ["world model", "world models"],
  },
  {
    id: "efficient",
    name: "Small & local models",
    blurb: "Running capable models on modest hardware",
    arxiv: ["quantization", "knowledge distillation", "small language model", "on-device"],
    hn: ["local LLM", "local model", "quantization", "llama.cpp", "Ollama"],
  },
  {
    id: "safety",
    name: "AI safety & alignment",
    blurb: "Making models reliable, interpretable and hard to misuse",
    arxiv: ["AI safety", "jailbreak", "red teaming", "mechanistic interpretability"],
    hn: ["AI safety", "AI alignment", "jailbreak", "interpretability"],
  },
  {
    id: "science",
    name: "AI for science",
    blurb: "Using AI to speed up scientific discovery",
    arxiv: ["scientific discovery", "AI scientist", "AI for science"],
    hn: ["AI scientist", "AlphaFold", "scientific discovery"],
  },
];
