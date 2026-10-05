// Thin proxy to any OpenAI-compatible /chat/completions endpoint.
// Browser-supplied settings win; otherwise falls back to server env (LLM_BASE_URL, LLM_API_KEY, LLM_MODEL)
// so a facilitator can configure one key for the whole room.

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY),
    model: process.env.LLM_MODEL ?? null,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const baseUrl: string = (body.baseUrl || process.env.LLM_BASE_URL || "").replace(/\/+$/, "");
  const apiKey: string = body.apiKey || process.env.LLM_API_KEY || "";
  const model: string = body.model || process.env.LLM_MODEL || "";
  if (!baseUrl || !model) {
    return Response.json({ error: "No base URL / model configured. Open Settings." }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    model,
    messages: body.messages,
    temperature: body.temperature ?? 0.3,
    // floor the budget: reasoning models (e.g. gpt-oss) spend tokens thinking before the visible answer
    max_tokens: Math.max(body.max_tokens ?? 600, 1024),
  };
  if (body.tools?.length) {
    payload.tools = body.tools;
    payload.tool_choice = "auto";
  }

  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
    const latencyMs = Date.now() - started;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return Response.json({ error: data?.error?.message ?? `Provider returned HTTP ${res.status}`, latencyMs }, { status: 502 });
    }
    const msg = data.choices?.[0]?.message ?? {};
    return Response.json({
      content: msg.content ?? "",
      toolCalls: (msg.tool_calls ?? []).map((t: { id: string; function: { name: string; arguments: string } }) => ({
        id: t.id,
        name: t.function.name,
        arguments: t.function.arguments,
      })),
      usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
      model: data.model ?? model,
      latencyMs,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e), latencyMs: Date.now() - started }, { status: 502 });
  }
}
