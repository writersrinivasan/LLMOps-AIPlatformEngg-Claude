// Runs the HR RAG app for one question: shared by prompt registry, eval gates and eval pipeline labs.
import { liveChat } from "./llm";
import { DEFAULT_CHUNKS, estimateTokens, retrieve, simulateHrAnswer, sleep } from "./sim";
import type { LlmSettings } from "./store";
import { scoreCase, Scores, TestCase } from "./eval";

export interface AppRun {
  answer: string;
  contexts: { title: string; text: string; docId: string }[];
  latencyMs: number;
  tokens: number;
  live: boolean;
  error?: string;
}

export async function runHrApp(question: string, systemPrompt: string, opts: { live: boolean; settings: LlmSettings; temperature?: number; seed?: number; topK?: number }): Promise<AppRun> {
  const { hits } = retrieve(question, DEFAULT_CHUNKS, { topK: opts.topK ?? 3, userAccess: "all", accessFilter: true, rerank: true });
  const contexts = hits.map((h) => ({ title: h.chunk.title, text: h.chunk.text, docId: h.chunk.docId }));
  const ctxText = contexts.map((c, i) => `[${i + 1}] ${c.title}: ${c.text}`).join("\n");
  if (opts.live) {
    const r = await liveChat(opts.settings, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Context:\n${ctxText}\n\nQuestion: ${question}` },
      ],
      temperature: opts.temperature ?? 0.2,
      max_tokens: 300,
    });
    return { answer: r.error ? `ERROR: ${r.error}` : r.content, contexts, latencyMs: r.latencyMs, tokens: r.usage.input + r.usage.output, live: true, error: r.error };
  }
  const sim = simulateHrAnswer({ question, systemPrompt, contexts, temperature: opts.temperature, seed: opts.seed });
  const latencyMs = 400 + Math.round(Math.random() * 700);
  await sleep(120 + Math.random() * 200);
  return { answer: sim.text, contexts, latencyMs, tokens: estimateTokens(systemPrompt + ctxText + question) + estimateTokens(sim.text), live: false };
}

export async function runCase(tc: TestCase, systemPrompt: string, opts: { live: boolean; settings: LlmSettings; seed?: number }): Promise<{ run: AppRun; scores: Scores }> {
  const run = await runHrApp(tc.query, systemPrompt, opts);
  const scores = scoreCase(tc, run.answer, run.contexts.map((c) => c.text).join(" "));
  return { run, scores };
}
