"use client";
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useApp } from "@/lib/store";
import { liveChat } from "@/lib/llm";
import { Btn, Callout, Card, Input, Toggle } from "@/components/ui";

const PRESETS = [
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  { name: "Together", baseUrl: "https://api.together.xyz/v1", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  { name: "Ollama (local)", baseUrl: "http://localhost:11434/v1", model: "llama3.1" },
  { name: "LiteLLM proxy", baseUrl: "http://localhost:4000/v1", model: "gpt-4o-mini" },
];

export default function SettingsPage() {
  const { settings, setSettings, serverConfigured, isLive } = useApp();
  const [status, setStatus] = useState<{ state: "idle" | "busy" | "ok" | "err"; msg?: string }>({ state: "idle" });
  const set = (k: keyof typeof settings, v: string | boolean) => setSettings({ ...settings, [k]: v });

  const test = async () => {
    setStatus({ state: "busy" });
    const r = await liveChat(settings, { messages: [{ role: "user", content: "Reply with exactly: pong" }], max_tokens: 10, temperature: 0 });
    setStatus(r.error ? { state: "err", msg: r.error } : { state: "ok", msg: `${r.model} replied "${r.content.trim()}" in ${r.latencyMs} ms (${r.usage.input}+${r.usage.output} tokens)` });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-8 py-8">
      <div>
        <h1 className="text-2xl font-bold">LLM settings</h1>
        <p className="text-sm text-slate-600">Every lab runs on a built-in simulator. Turn on LIVE mode to send the gateway, RAG, evaluation, judge and agent labs to a real OpenAI-compatible endpoint.</p>
      </div>

      <Card>
        <Toggle label="LIVE mode" hint={isLive ? "Labs will make real calls" : "Off: everything uses the simulator"} checked={settings.live} onChange={(v) => set("live", v)} />
      </Card>

      <Card title="OpenAI-compatible endpoint">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Btn key={p.name} size="sm" variant="secondary" onClick={() => setSettings({ ...settings, baseUrl: p.baseUrl, model: p.model })}>{p.name}</Btn>
          ))}
        </div>
        <div className="space-y-3">
          <Field label="Base URL" hint="Must expose POST {base}/chat/completions"><Input value={settings.baseUrl} onChange={(v) => set("baseUrl", v)} /></Field>
          <Field label="API key" hint="Stored only in this browser's localStorage and sent to the local Next.js proxy."><Input type="password" value={settings.apiKey} onChange={(v) => set("apiKey", v)} placeholder="sk-..." /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Default model" hint="Must support tool calling for the agent labs"><Input value={settings.model} onChange={(v) => set("model", v)} placeholder="gpt-4o-mini" /></Field>
            <Field label="Judge model (optional)" hint="Used in LLM-as-a-judge. Defaults to the main model."><Input value={settings.judgeModel} onChange={(v) => set("judgeModel", v)} /></Field>
          </div>
          <div className="flex items-center gap-3">
            <Btn onClick={test} disabled={status.state === "busy"}>{status.state === "busy" ? <Loader2 size={14} className="animate-spin" /> : null}Test connection</Btn>
            {status.state === "ok" && <span className="flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 size={15} />{status.msg}</span>}
            {status.state === "err" && <span className="flex items-center gap-1 text-sm text-rose-700"><XCircle size={15} />{status.msg}</span>}
          </div>
        </div>
      </Card>

      <Callout tone={serverConfigured ? "ok" : "info"} title={serverConfigured ? "Server key detected" : "Facilitator tip: one key for the whole room"}>
        {serverConfigured ? (
          <>The server has <code>LLM_BASE_URL</code> / <code>LLM_API_KEY</code> set. Participants only need to switch LIVE mode on and can leave the fields above empty.</>
        ) : (
          <>Set <code>LLM_BASE_URL</code>, <code>LLM_API_KEY</code> and <code>LLM_MODEL</code> in <code>.env.local</code> on the machine that hosts the app. Participants then just toggle LIVE mode and never see the key.</>
        )}
      </Callout>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}
