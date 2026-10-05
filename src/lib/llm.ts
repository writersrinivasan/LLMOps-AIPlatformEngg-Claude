// Client-side LLM call helper: LIVE → /api/llm proxy, otherwise caller supplies a simulator.
import type { LlmSettings } from "./store";
import { estimateTokens, sleep } from "./sim";

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatResult {
  content: string;
  toolCalls: { id: string; name: string; arguments: string }[];
  usage: { input: number; output: number };
  latencyMs: number;
  model: string;
  live: boolean;
  error?: string;
}

export async function liveChat(
  settings: LlmSettings,
  req: { messages: ChatMsg[]; tools?: ToolDef[]; temperature?: number; max_tokens?: number; model?: string },
): Promise<ChatResult> {
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: settings.apiKey || settings.model ? settings.baseUrl : undefined,
      apiKey: settings.apiKey || undefined,
      model: req.model || settings.model || undefined,
      messages: req.messages,
      tools: req.tools,
      temperature: req.temperature,
      max_tokens: req.max_tokens,
    }),
  });
  const d = await res.json();
  if (!res.ok || d.error) {
    return { content: "", toolCalls: [], usage: { input: 0, output: 0 }, latencyMs: d.latencyMs ?? 0, model: req.model || settings.model, live: true, error: d.error ?? "Request failed" };
  }
  return { ...d, live: true };
}

/** Wrap a synchronous simulator result as a ChatResult with realistic latency. */
export async function simChat(content: string, promptText: string, opts?: { latencyMs?: number; model?: string }): Promise<ChatResult> {
  const latencyMs = opts?.latencyMs ?? 350 + Math.random() * 500;
  await sleep(Math.min(latencyMs, 900));
  return {
    content,
    toolCalls: [],
    usage: { input: estimateTokens(promptText), output: estimateTokens(content) },
    latencyMs: Math.round(latencyMs),
    model: opts?.model ?? "simulator",
    live: false,
  };
}
