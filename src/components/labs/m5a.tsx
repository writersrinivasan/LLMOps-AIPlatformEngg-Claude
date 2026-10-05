"use client";
import { useEffect, useRef, useState } from "react";
import { Bug, Eye, Loader2, Play, ThumbsDown, ThumbsUp, Zap } from "lucide-react";
import { useApp } from "@/lib/store";
import { AgentRun, DEFAULT_POLICY, runAgent, SAMPLE_TASKS, Span } from "@/lib/agent";
import { fmtUsd, MODELS, overlap } from "@/lib/sim";
import { Btn, Callout, Card, cx, Input, Pill, Select, Stat, Toggle } from "@/components/ui";
import { TraceWaterfall } from "@/components/shared/TraceWaterfall";
import { useApproval } from "@/components/shared/Approval";

// ============ 5.1 Agent trace explorer ============
interface History { task: string; run: AgentRun; feedback?: "up" | "down"; evalScore: number }

export function TraceExplorer() {
  const { isLive, settings } = useApp();
  const [task, setTask] = useState(SAMPLE_TASKS[0]);
  const [model, setModel] = useState("balanced-m");
  const [buggy, setBuggy] = useState(false);
  const [maxSteps, setMaxSteps] = useState(20);
  const [spans, setSpans] = useState<Span[]>([]);
  const [busy, setBusy] = useState(false);
  const [hl, setHl] = useState<"slowest" | "costliest" | null>(null);
  const [hist, setHist] = useState<History[]>([]);
  const [apm, setApm] = useState(false);
  const approval = useApproval();

  const go = async () => {
    setBusy(true); setSpans([]); setHl(null);
    const run = await runAgent({ task, live: isLive, settings, policy: { ...DEFAULT_POLICY, model, buggyLoop: buggy, maxSteps }, onSpan: setSpans, onApproval: approval.request });
    const toolOut = run.spans.filter((s) => s.kind !== "llm" && s.kind !== "agent").map((s) => s.output).join(" ");
    const evalScore = toolOut ? Math.min(1, overlap(run.answer, toolOut) * 1.4) : 0.5;
    setHist((h) => [{ task, run, evalScore }, ...h].slice(0, 8));
    setBusy(false);
  };

  const last = hist[0];
  const llm = spans.filter((s) => s.kind === "llm");
  const tools = spans.filter((s) => s.kind === "tool" || s.kind === "retrieval");
  const total = spans[0]?.end ?? 0;
  const cost = spans.reduce((a, s) => a + (s.cost ?? 0), 0);
  const tokens = spans.reduce((a, s) => a + (s.tokensIn ?? 0) + (s.tokensOut ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card title="Run the HR agent">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <Input value={task} onChange={setTask} />
            <div className="flex flex-wrap gap-1">{SAMPLE_TASKS.map((t) => <button type="button" key={t} onClick={() => setTask(t)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200">{t}</button>)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-36"><Select label="Model" value={model} onChange={setModel} options={MODELS.map((m) => m.id)} /></div>
            <Toggle label={<span className="flex items-center gap-1"><Bug size={13} />Buggy planner</span>} hint="re-plans in a loop" checked={buggy} onChange={setBuggy} />
            <div className="w-28"><Select label="Max steps" value={String(maxSteps)} onChange={(v) => setMaxSteps(+v)} options={["3", "6", "10", "20"]} /></div>
            <Btn onClick={go} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : isLive ? <Zap size={14} /> : <Play size={14} />}Run agent{isLive && " (LIVE)"}</Btn>
          </div>
        </div>
      </Card>
      {approval.banner}

      {spans.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <Stat label="End-to-end" value={`${(total / 1000).toFixed(1)}s`} />
          <Stat label="LLM calls" value={llm.length} tone={llm.length > 6 ? "red" : "slate"} />
          <Stat label="Tool calls" value={tools.length} />
          <Stat label="Tokens" value={tokens.toLocaleString()} />
          <Stat label="Cost" value={fmtUsd(cost)} tone={cost > 0.02 ? "red" : "slate"} />
          <Stat label="Eval score" value={last && !busy ? last.evalScore.toFixed(2) : "…"} sub="groundedness vs tool outputs" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Btn size="sm" variant={hl === "slowest" ? "primary" : "secondary"} onClick={() => setHl("slowest")}>Find the slowest span</Btn>
        <Btn size="sm" variant={hl === "costliest" ? "primary" : "secondary"} onClick={() => setHl("costliest")}>Find the most expensive span</Btn>
        <Btn size="sm" variant={apm ? "primary" : "ghost"} onClick={() => setApm(!apm)}><Eye size={13} />What would traditional APM show?</Btn>
      </div>
      {apm && spans.length > 0 && (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs">
          <div className="mb-1 text-slate-500">Traditional APM view</div>
          <div className="flex items-center gap-2"><span>POST /api/chat</span><span className="h-3 flex-1 rounded bg-slate-400" /><span>{(total / 1000).toFixed(1)}s</span><Pill color="green">200 OK</Pill></div>
          <div className="mt-1 text-[11px] text-slate-500">CPU 12% · Memory 340MB · Errors 0. Everything looks &quot;green&quot;, even if the agent looped 14 times or leaked data.</div>
        </div>
      )}
      <TraceWaterfall spans={spans} highlight={hl} />

      {last && !busy && (
        <Card title="Final response + user feedback">
          <div className="text-sm">{last.run.answer}</div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            Was this helpful?
            <button type="button" onClick={() => setHist((h) => [{ ...h[0], feedback: "up" }, ...h.slice(1)])} className={cx("rounded p-1", last.feedback === "up" ? "bg-emerald-100 text-emerald-700" : "hover:bg-slate-100")}><ThumbsUp size={14} /></button>
            <button type="button" onClick={() => setHist((h) => [{ ...h[0], feedback: "down" }, ...h.slice(1)])} className={cx("rounded p-1", last.feedback === "down" ? "bg-rose-100 text-rose-700" : "hover:bg-slate-100")}><ThumbsDown size={14} /></button>
            {last.feedback === "down" && <span className="text-rose-600">Attached to the trace and queued as a new golden-dataset candidate</span>}
          </div>
        </Card>
      )}

      {hist.length > 1 && (
        <Card title="Trace history" pad={false}>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-3 py-1.5">Task</th><th>LLM calls</th><th>Latency</th><th>Tokens</th><th>Cost</th><th>Eval</th><th>Feedback</th></tr></thead>
            <tbody>{hist.map((h, i) => <tr key={i} className="border-t border-slate-100"><td className="max-w-xs truncate px-3 py-1.5">{h.task}</td><td>{h.run.steps}</td><td>{((h.run.spans[0]?.end ?? 0) / 1000).toFixed(1)}s</td><td>{h.run.totalTokens.toLocaleString()}</td><td>{fmtUsd(h.run.totalCost)}</td><td>{h.evalScore.toFixed(2)}</td><td>{h.feedback === "up" ? "👍" : h.feedback === "down" ? "👎" : "—"}</td></tr>)}</tbody>
          </table>
        </Card>
      )}
      {buggy && <Callout tone="warn" title="Planner bug enabled">Run the first sample task with the bug on, then with Max steps = 6. Compare LLM calls and cost in the history. That is exactly what an agent-loop cap protects you from.</Callout>}
    </div>
  );
}

// ============ 5.2 Metrics dashboard ============
type IncidentId = "provider" | "retrieval" | "prompt" | "loop" | "tool" | "surge";
const INCIDENTS: { id: IncidentId; name: string; cause: string }[] = [
  { id: "provider", name: "Model provider degradation", cause: "Provider latency/timeouts: TTFT and latency spike, timeouts rise. Fallback routing helps." },
  { id: "retrieval", name: "Vector index failure", cause: "Retrieval failures spike, groundedness and task completion fall." },
  { id: "prompt", name: "Silent prompt regression", cause: "Groundedness/faithfulness drop while every infra metric stays green. Only quality evals catch it." },
  { id: "loop", name: "Agent loop bug", cause: "Tokens/request and cost/request explode, latency rises." },
  { id: "tool", name: "Tool API outage", cause: "Tool failures spike, task completion falls, errors rise." },
  { id: "surge", name: "Traffic surge from one app", cause: "Throughput and total cost jump; cost/app dominated by one app." },
];
const METRIC_GROUPS: { group: string; items: { id: string; name: string; unit: string; fmt: (v: number) => string; bad: "up" | "down" }[] }[] = [
  { group: "Traditional infra", items: [{ id: "cpu", name: "CPU", unit: "%", fmt: (v) => `${v.toFixed(0)}%`, bad: "up" }, { id: "mem", name: "Memory", unit: "GB", fmt: (v) => `${v.toFixed(1)}GB`, bad: "up" }, { id: "http5xx", name: "HTTP 5xx", unit: "%", fmt: (v) => `${v.toFixed(1)}%`, bad: "up" }] },
  { group: "Quality", items: [{ id: "faith", name: "Faithfulness", unit: "", fmt: (v) => v.toFixed(2), bad: "down" }, { id: "rel", name: "Relevance", unit: "", fmt: (v) => v.toFixed(2), bad: "down" }, { id: "ground", name: "Groundedness", unit: "", fmt: (v) => v.toFixed(2), bad: "down" }, { id: "task", name: "Task completion", unit: "", fmt: (v) => `${(v * 100).toFixed(0)}%`, bad: "down" }] },
  { group: "Performance", items: [{ id: "ttft", name: "Time to first token", unit: "ms", fmt: (v) => `${v.toFixed(0)}ms`, bad: "up" }, { id: "e2e", name: "End-to-end latency", unit: "s", fmt: (v) => `${v.toFixed(1)}s`, bad: "up" }, { id: "tps", name: "Tokens / second", unit: "", fmt: (v) => v.toFixed(0), bad: "down" }, { id: "thru", name: "Throughput", unit: "rps", fmt: (v) => `${v.toFixed(0)} rps`, bad: "up" }] },
  { group: "Cost", items: [{ id: "tin", name: "Input tokens / req", unit: "", fmt: (v) => v.toFixed(0), bad: "up" }, { id: "tout", name: "Output tokens / req", unit: "", fmt: (v) => v.toFixed(0), bad: "up" }, { id: "creq", name: "Cost / request", unit: "$", fmt: (v) => `$${v.toFixed(4)}`, bad: "up" }, { id: "cuser", name: "Cost / user / day", unit: "$", fmt: (v) => `$${v.toFixed(2)}`, bad: "up" }, { id: "capp", name: "Top app cost share", unit: "%", fmt: (v) => `${v.toFixed(0)}%`, bad: "up" }] },
  { group: "Reliability", items: [{ id: "err", name: "Error rate", unit: "%", fmt: (v) => `${v.toFixed(1)}%`, bad: "up" }, { id: "timeout", name: "Timeout rate", unit: "%", fmt: (v) => `${v.toFixed(1)}%`, bad: "up" }, { id: "mfail", name: "Model failures", unit: "%", fmt: (v) => `${v.toFixed(1)}%`, bad: "up" }, { id: "tfail", name: "Tool failures", unit: "%", fmt: (v) => `${v.toFixed(1)}%`, bad: "up" }, { id: "rfail", name: "Retrieval failures", unit: "%", fmt: (v) => `${v.toFixed(1)}%`, bad: "up" }] },
];
const BASE: Record<string, number> = { cpu: 34, mem: 3.1, http5xx: 0.3, faith: 0.91, rel: 0.88, ground: 0.9, task: 0.86, ttft: 420, e2e: 2.4, tps: 85, thru: 40, tin: 2100, tout: 260, creq: 0.0036, cuser: 0.42, capp: 38, err: 0.6, timeout: 0.4, mfail: 0.3, tfail: 0.5, rfail: 0.4 };

function metricsAt(active: Set<IncidentId>, noise: () => number) {
  const m: Record<string, number> = {};
  for (const [k, v] of Object.entries(BASE)) m[k] = v * (1 + (noise() - 0.5) * 0.06);
  if (active.has("provider")) { m.ttft *= 4.5; m.e2e *= 3.2; m.tps *= 0.4; m.timeout += 7; m.mfail += 5; m.err += 3; m.http5xx += 1.5; }
  if (active.has("retrieval")) { m.rfail += 28; m.ground -= 0.32; m.faith -= 0.08; m.task -= 0.25; m.rel -= 0.12; }
  if (active.has("prompt")) { m.ground -= 0.27; m.faith -= 0.3; m.task -= 0.14; }
  if (active.has("loop")) { m.tin *= 5.5; m.tout *= 2.5; m.creq *= 5.8; m.cuser *= 5.5; m.e2e *= 2.4; m.cpu += 6; }
  if (active.has("tool")) { m.tfail += 35; m.task -= 0.3; m.err += 4; m.http5xx += 0.8; }
  if (active.has("surge")) { m.thru *= 3.5; m.capp = 81; m.cpu += 22; m.cuser *= 1.2; m.e2e *= 1.3; }
  return m;
}

function Spark({ values, bad, color }: { values: number[]; bad: boolean; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 26}`).join(" ");
  return <svg viewBox="0 0 100 30" className="h-7 w-full" preserveAspectRatio="none"><polyline fill="none" stroke={bad ? "#e11d48" : color} strokeWidth={1.8} points={pts} /></svg>;
}

export function MetricsDashboard() {
  const [active, setActive] = useState<Set<IncidentId>>(new Set());
  const [series, setSeries] = useState<Record<string, number>[]>(() => Array.from({ length: 30 }, (_, i) => metricsAt(new Set(), () => ((i * 9301 + 49297) % 233280) / 233280)));
  const [mystery, setMystery] = useState<IncidentId | null>(null);
  const [guess, setGuess] = useState<string>("");
  const [revealed, setRevealed] = useState(false);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    let seed = 1;
    const noise = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const t = setInterval(() => setSeries((s) => [...s, metricsAt(activeRef.current, noise)].slice(-40)), 800);
    return () => clearInterval(t);
  }, []);

  const toggle = (id: IncidentId) => setActive((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const startMystery = () => {
    const pick = INCIDENTS[Math.floor(Math.random() * INCIDENTS.length)].id;
    setMystery(pick); setGuess(""); setRevealed(false); setActive(new Set([pick]));
  };
  const latest = series.at(-1) ?? BASE;

  return (
    <div className="space-y-4">
      <Card title="Incident control (facilitator)">
        <div className="flex flex-wrap items-center gap-2">
          {INCIDENTS.map((i) => <Btn key={i.id} size="sm" variant={active.has(i.id) && !mystery ? "danger" : "secondary"} onClick={() => { setMystery(null); toggle(i.id); }}>{i.name}</Btn>)}
          <Btn size="sm" variant="primary" onClick={startMystery}>🎲 Mystery incident</Btn>
          <Btn size="sm" variant="ghost" onClick={() => { setActive(new Set()); setMystery(null); }}>Clear all</Btn>
        </div>
        {mystery && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-indigo-50 p-2 text-sm">
            <span className="font-semibold">A mystery incident is active. What is it?</span>
            <select value={guess} onChange={(e) => setGuess(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm"><option value="">Your diagnosis…</option>{INCIDENTS.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
            <Btn size="sm" onClick={() => setRevealed(true)} disabled={!guess}>Reveal</Btn>
            {revealed && <Pill color={guess === mystery ? "green" : "red"}>{guess === mystery ? "Correct!" : `It was: ${INCIDENTS.find((i) => i.id === mystery)!.name}`}</Pill>}
          </div>
        )}
        {revealed && mystery && <div className="mt-2 text-xs text-slate-600">{INCIDENTS.find((i) => i.id === mystery)!.cause}</div>}
      </Card>
      <div className="space-y-3">
        {METRIC_GROUPS.map((g) => (
          <div key={g.group}>
            <div className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">{g.group}{g.group === "Traditional infra" && <span className="ml-2 font-normal normal-case text-slate-400">(what most teams monitor today)</span>}</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              {g.items.map((it) => {
                const v = latest[it.id];
                const base = BASE[it.id];
                const dev = (v - base) / (Math.abs(base) || 1);
                const bad = it.bad === "up" ? (it.id.endsWith("fail") || ["err", "timeout", "http5xx"].includes(it.id) ? v - base > 2 : dev > 0.35) : dev < -0.12;
                return (
                  <div key={it.id} className={cx("rounded-lg border bg-white p-2 transition", bad ? "border-rose-400 ring-2 ring-rose-200" : "border-slate-200")}>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{it.name}</div>
                    <div className={cx("text-lg font-bold tabular-nums", bad ? "text-rose-600" : "text-slate-900")}>{it.fmt(v)}</div>
                    <Spark values={series.map((s) => s[it.id])} bad={bad} color="#64748b" />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Callout tone="info" title="Try this">Inject <b>Silent prompt regression</b>. Look at the &quot;Traditional infra&quot; row first, then the Quality row. That gap is why LLM observability needs quality metrics.</Callout>
    </div>
  );
}
