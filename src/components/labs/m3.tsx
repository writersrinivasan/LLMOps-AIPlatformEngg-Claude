"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Circle, File, Folder, GitPullRequest, Loader2, MinusCircle, Play, RotateCcw, XCircle } from "lucide-react";
import { useApp } from "@/lib/store";
import { GOLDEN, PROMPT_V2, Scores } from "@/lib/eval";
import { runCase } from "@/lib/runner";
import { rng, sleep } from "@/lib/sim";
import { Btn, Callout, Card, cx, Pill, Select, Slider, Stat, TextArea, Toggle } from "@/components/ui";
import { LineChart } from "@/components/shared/Charts";

// ============ 3.1 Release BOM ============
const INGREDIENTS = [
  { id: "code", name: "Code", ver: "app@4.12.0", desc: "Orchestration, API, UI" },
  { id: "prompt", name: "Prompt", ver: "hr-assistant/system@v2", desc: "System prompt + templates" },
  { id: "model", name: "Model", ver: "balanced-m@v3", desc: "LLM + parameters (temp, max_tokens)" },
  { id: "data", name: "Data", ver: "hr-docs@2026-06-01", desc: "Knowledge base documents" },
  { id: "context", name: "Context", ver: "chunk=sentence/45, embed=e5-v2, k=3", desc: "Chunking, embedding model, retrieval params" },
  { id: "tools", name: "Tools", ver: "tool-registry@2.3 (5 tools)", desc: "Tool schemas, permissions, MCP servers" },
  { id: "eval", name: "Evaluation", ver: "golden@v7 (8 cases) + thresholds@v3", desc: "Datasets & gates" },
];
const CHECKS = ["Unit/integration tests", "Container rebuild", "Re-index vectors", "Prompt/behaviour eval", "RAG eval", "Agent/tool-call eval", "Safety eval (PII, toxicity)", "Security review", "Latency & cost re-baseline", "Canary / shadow rollout"];
const IMPACT: Record<string, number[]> = {
  code: [0, 1, 7, 9],
  prompt: [3, 4, 6, 9],
  model: [3, 4, 5, 6, 8, 9],
  data: [2, 4, 6],
  context: [2, 4, 8, 9],
  tools: [0, 5, 7, 9],
  eval: [3, 4, 5, 6],
};

export function ReleaseBom() {
  const [changed, setChanged] = useState<string | null>("prompt");
  const hit = new Set(changed ? IMPACT[changed] : []);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Traditional release">
          <div className="flex items-center gap-2">
            {["Code", "Build", "Test", "Deploy"].map((s, i) => (
              <div key={s} className="flex items-center gap-2"><div className="rounded-lg border-2 border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold">{s}</div>{i < 3 && <span className="text-slate-300">→</span>}</div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">One versioned artifact (the code) with deterministic tests. If tests pass, behaviour is known.</p>
        </Card>
        <Card title="AI release = 7 versioned ingredients">
          <div className="flex items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {INGREDIENTS.map((g) => (
                <button key={g.id} type="button" onClick={() => setChanged(g.id)} className={cx("rounded-lg border-2 px-2.5 py-1.5 text-xs font-semibold transition", changed === g.id ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400")}>{g.name}</button>
              ))}
            </div>
            <span className="text-2xl text-slate-300">⇒</span>
            <div className="rounded-lg bg-slate-900 px-3 py-3 text-center text-xs font-bold text-white">AI<br />Release</div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Click an ingredient to simulate changing <b>only that one</b>.</p>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card title={changed ? `Blast radius of changing: ${INGREDIENTS.find((g) => g.id === changed)!.name}` : "Blast radius"}>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECKS.map((c, i) => (
              <div key={c} className={cx("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition", hit.has(i) ? "border-amber-300 bg-amber-50 font-semibold text-amber-900" : "border-slate-100 text-slate-400")}>
                {hit.has(i) ? <RotateCcw size={14} /> : <MinusCircle size={14} />}{c}
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-600"><b>{hit.size}</b> of {CHECKS.length} checks must re-run. Notice that a prompt change needs no rebuild, but it does need a full behavioural evaluation.</div>
        </Card>
        <Card title="release-manifest.yaml">
          <pre className="font-mono text-[11px] leading-5">
            <span className="text-slate-400">release: hr-assistant-2026.10.05</span>{"\n"}
            {INGREDIENTS.map((g) => (
              <span key={g.id} className={cx("block", changed === g.id && "bg-amber-100 font-bold text-amber-900")}>{g.id}: {changed === g.id ? g.ver.replace(/(v|@)(\d+)/, (_m, p, n) => `${p}${+n + 1}`) + "  # changed" : g.ver}</span>
            ))}
          </pre>
          <p className="mt-2 text-[11px] text-slate-500">Pin every ingredient. Then &quot;what was running when it broke?&quot; has an answer.</p>
        </Card>
      </div>
    </div>
  );
}

// ============ 3.2 Git-based development ============
const FILES: Record<string, string> = {
  "src/app.py": `from platform_sdk import gateway, prompts, retriever, trace\n\n@trace\ndef answer(question, user):\n    ctx = retriever.search(question, top_k=cfg.retrieval.top_k, acl=user.role)\n    sys = prompts.get("hr-assistant/system", version=cfg.prompt.version)\n    return gateway.chat(model=cfg.model.name, system=sys, context=ctx, q=question)`,
  "prompts/hr-assistant/system.md": PROMPT_V2,
  "config/base.yaml": `model:\n  name: balanced-m\n  temperature: 0.2\n  max_tokens: 400\nprompt:\n  version: v2\nretrieval:\n  top_k: 3\n  rerank: true\nguardrails:\n  pii: block\n  injection: block`,
  "config/dev.yaml": `model:\n  name: fast-s\n  temperature: 0.7\nretrieval:\n  top_k: 5\nguardrails:\n  pii: warn`,
  "config/staging.yaml": `prompt:\n  version: v3   # candidate\nretrieval:\n  top_k: 3`,
  "config/prod.yaml": `model:\n  name: balanced-m\n  fallback: llama-70b\nbudget:\n  monthly_usd: 30000\nrollout:\n  strategy: canary\n  steps: [5, 25, 50, 100]`,
  "evals/golden.jsonl": GOLDEN.map((g) => JSON.stringify({ q: g.query, behavior: g.behavior, must: g.mustInclude })).join("\n"),
  "evals/thresholds.yaml": `correctness: {min: 0.85, mode: block}\ngroundedness: {min: 0.80, mode: block}\npii_leakage: {max: 0, mode: block}\ntoxicity: {max: 0, mode: block}\nrelevance: {min: 0.70, mode: warn}`,
  "models.lock.yaml": `balanced-m: provider-b/balanced-m@2026-03-14\nllama-70b: hf/meta-llama/Llama-3.3-70B@sha256:9f2c…\ne5-v2: hf/intfloat/e5-base-v2@sha256:41aa…`,
  ".github/workflows/ai-ci.yml": `on: [pull_request]\njobs:\n  ci:\n    steps:\n      - run: pytest tests/unit\n      - run: config-lint config/\n      - run: secret-scan .\n      - run: llm-eval --dataset evals/golden.jsonl --gates evals/thresholds.yaml\n      - run: docker build .\n      - run: deploy --env staging --strategy canary`,
};

function parseYaml(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let parent = "";
  for (const line of s.split("\n")) {
    const m = line.match(/^(\s*)([\w_]+):\s*(.*?)\s*(#.*)?$/);
    if (!m) continue;
    if (!m[1]) { parent = m[2]; if (m[3]) out[m[2]] = m[3]; }
    else if (m[3]) out[`${parent}.${m[2]}`] = m[3];
  }
  return out;
}

export function GitWorkflow() {
  const [files, setFiles] = useState(FILES);
  const [open, setOpen] = useState("config/prod.yaml");
  const [envA, setEnvA] = useState("dev");
  const [envB, setEnvB] = useState("prod");
  const [msg, setMsg] = useState("Tune prod retrieval");
  const [pr, setPr] = useState<{ checks: { name: string; status: "pending" | "running" | "pass" | "fail" | "skip"; note?: string }[] } | null>(null);

  const changedFiles = Object.keys(files).filter((f) => files[f] !== FILES[f]);
  const merged = (env: string) => ({ ...parseYaml(files["config/base.yaml"]), ...parseYaml(files[`config/${env}.yaml`]) });
  const A = merged(envA), B = merged(envB);
  const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();

  const openPr = async () => {
    const all = Object.entries(files).filter(([f]) => changedFiles.includes(f));
    const text = all.map(([, c]) => c).join("\n");
    const promptChanged = changedFiles.some((f) => f.startsWith("prompts/"));
    const temp = Number(merged("prod")["model.temperature"] ?? 0);
    const checks: { name: string; status: "pending" | "running" | "pass" | "fail" | "skip"; note?: string; fail?: boolean }[] = [
      { name: "Unit tests", status: "pending", fail: changedFiles.includes("src/app.py") && !/def answer/.test(files["src/app.py"]), note: "pytest tests/unit" },
      { name: "Config lint", status: "pending", fail: temp > 1 || /top_k:\s*(0|[2-9]\d)/.test(text), note: temp > 1 ? `prod temperature ${temp} > 1.0` : "schema + bounds" },
      { name: "Secret scan", status: "pending", fail: /sk-[a-z0-9-]{8,}|api_key\s*[:=]/i.test(text), note: "gitleaks" },
      { name: "LLM evaluation", status: "pending", fail: promptChanged && !/only|context/i.test(files["prompts/hr-assistant/system.md"]), note: promptChanged ? "prompt changed → full golden set" : "smoke set (prompt unchanged)" },
      { name: "Container build", status: "pending", note: "docker build" },
      { name: "Deploy to staging (canary)", status: "pending" },
    ];
    setPr({ checks });
    let failed = false;
    for (let i = 0; i < checks.length; i++) {
      if (failed) { checks[i].status = "skip"; setPr({ checks: [...checks] }); continue; }
      checks[i].status = "running"; setPr({ checks: [...checks] });
      await sleep(600);
      checks[i].status = checks[i].fail ? "fail" : "pass";
      if (checks[i].fail) {
        failed = true;
        if (checks[i].name === "Secret scan") checks[i].note = "Found a credential pattern. Rotate the key and use a secret manager.";
        if (checks[i].name === "LLM evaluation") checks[i].note = "groundedness 0.58 < 0.80 (blocked)";
      }
      setPr({ checks: [...checks] });
    }
  };

  const tree = Object.keys(files).reduce<Record<string, string[]>>((t, f) => { const d = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "."; (t[d] ??= []).push(f); return t; }, {});

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[250px_1fr]">
        <Card title="hr-assistant (repo)" pad={false}>
          <div className="p-2 text-xs">
            {Object.entries(tree).map(([dir, fs]) => (
              <div key={dir} className="mb-1">
                <div className="flex items-center gap-1 px-1 py-0.5 font-semibold text-slate-600"><Folder size={12} className="text-amber-500" />{dir}/</div>
                {fs.map((f) => (
                  <button type="button" key={f} onClick={() => setOpen(f)} className={cx("ml-3 flex w-[calc(100%-12px)] items-center gap-1 rounded px-1 py-0.5 text-left", open === f ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50")}>
                    <File size={11} className="text-slate-400" />{f.split("/").pop()}{changedFiles.includes(f) && <span className="ml-auto text-[10px] font-bold text-amber-600">M</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Card>
        <Card title={open} right={files[open] !== FILES[open] && <Btn size="sm" variant="ghost" onClick={() => setFiles({ ...files, [open]: FILES[open] })}>Revert</Btn>}>
          <TextArea value={files[open]} onChange={(v) => setFiles({ ...files, [open]: v })} rows={12} mono />
          <div className="mt-1 text-[11px] text-slate-500">Try: set <code>temperature: 1.5</code> in prod.yaml, paste <code>api_key: sk-live-abc123def456</code>, or delete the grounding line from the prompt.</div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Environment-specific config (base + overlay)" right={<div className="flex gap-1 text-xs">{[[envA, setEnvA], [envB, setEnvB]].map(([v, s], i) => <select key={i} value={v as string} onChange={(e) => (s as (x: string) => void)(e.target.value)} className="rounded border border-slate-300 px-1">{["dev", "staging", "prod"].map((e) => <option key={e}>{e}</option>)}</select>)}</div>}>
          <table className="w-full font-mono text-[11px]">
            <thead><tr className="text-left text-slate-400"><th className="py-1">key</th><th>{envA}</th><th>{envB}</th></tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k} className={cx("border-t border-slate-100", A[k] !== B[k] && "bg-amber-50")}>
                  <td className="py-1 text-slate-600">{k}</td><td>{A[k] ?? "—"}</td><td className={A[k] !== B[k] ? "font-bold text-amber-800" : ""}>{B[k] ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Commit & pull request">
          <div className="text-xs text-slate-600">Changed files: {changedFiles.length ? changedFiles.map((f) => <Pill key={f} color="amber" className="mr-1">{f}</Pill>) : <i>none: edit a file first</i>}</div>
          <div className="mt-2 flex gap-2">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
            <Btn onClick={openPr} disabled={!changedFiles.length}><GitPullRequest size={14} />Open PR</Btn>
          </div>
          {pr && (
            <div className="mt-3 space-y-1">
              {pr.checks.map((c) => (
                <div key={c.name} className="flex items-center gap-2 rounded-md border border-slate-100 px-2 py-1.5 text-xs">
                  {c.status === "pass" ? <CheckCircle2 size={14} className="text-emerald-600" /> : c.status === "fail" ? <XCircle size={14} className="text-rose-600" /> : c.status === "running" ? <Loader2 size={14} className="animate-spin text-blue-600" /> : c.status === "skip" ? <MinusCircle size={14} className="text-slate-300" /> : <Circle size={14} className="text-slate-300" />}
                  <span className="font-medium">{c.name}</span><span className="ml-auto text-slate-500">{c.status === "skip" ? "skipped" : c.note}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============ 3.3 Evaluation gates ============
type Metric = "correctness" | "relevance" | "groundedness" | "hallucination" | "toxicity" | "pii" | "toolcall" | "structured";
const METRICS: { id: Metric; name: string; dir: "min" | "max"; def: number; mode: "block" | "warn" }[] = [
  { id: "correctness", name: "Answer correctness", dir: "min", def: 0.85, mode: "block" },
  { id: "relevance", name: "Relevance", dir: "min", def: 0.7, mode: "warn" },
  { id: "groundedness", name: "Groundedness", dir: "min", def: 0.8, mode: "block" },
  { id: "hallucination", name: "Hallucination rate", dir: "max", def: 0.1, mode: "block" },
  { id: "toxicity", name: "Toxicity rate", dir: "max", def: 0, mode: "block" },
  { id: "pii", name: "PII leakage rate", dir: "max", def: 0, mode: "block" },
  { id: "toolcall", name: "Tool-call accuracy", dir: "min", def: 0.9, mode: "block" },
  { id: "structured", name: "Structured output (JSON) valid", dir: "min", def: 0.98, mode: "warn" },
];
const CANDIDATES: { name: string; desc: string; m: Record<Metric, number> }[] = [
  { name: "R1: prompt v3 'friendlier'", desc: "Marketing rewrote the tone", m: { correctness: 0.81, relevance: 0.88, groundedness: 0.62, hallucination: 0.31, toxicity: 0, pii: 0, toolcall: 0.94, structured: 0.99 } },
  { name: "R2: switch to fast-s (cost)", desc: "−85% cost per request", m: { correctness: 0.86, relevance: 0.79, groundedness: 0.84, hallucination: 0.08, toxicity: 0, pii: 0, toolcall: 0.83, structured: 0.95 } },
  { name: "R3: v2.1 + JSON fix", desc: "Bug fix release", m: { correctness: 0.92, relevance: 0.84, groundedness: 0.9, hallucination: 0.05, toxicity: 0, pii: 0, toolcall: 0.95, structured: 1 } },
  { name: "R4: new embedding model", desc: "Faster re-index", m: { correctness: 0.88, relevance: 0.69, groundedness: 0.86, hallucination: 0.07, toxicity: 0, pii: 0.02, toolcall: 0.95, structured: 0.99 } },
];

export function EvalGates() {
  const { isLive, settings } = useApp();
  const [th, setTh] = useState(Object.fromEntries(METRICS.map((m) => [m.id, { v: m.def, mode: m.mode }])) as Record<Metric, { v: number; mode: "block" | "warn" }>);
  const [cands, setCands] = useState(CANDIDATES);
  const [busy, setBusy] = useState(false);

  const verdict = (m: Record<Metric, number>) => METRICS.map((x) => {
    const t = th[x.id];
    const ok = x.dir === "min" ? m[x.id] >= t.v - 1e-9 : m[x.id] <= t.v + 1e-9;
    return { id: x.id, ok, block: !ok && t.mode === "block", warn: !ok && t.mode === "warn" };
  });

  const measure = async () => {
    setBusy(true);
    const rows: Scores[] = [];
    for (const tc of GOLDEN) rows.push((await runCase(tc, PROMPT_V2, { live: isLive, settings, seed: 11 })).scores);
    const avg = (f: (s: Scores) => number) => rows.reduce((a, s) => a + f(s), 0) / rows.length;
    const m: Record<Metric, number> = { correctness: avg((s) => s.correctness), relevance: avg((s) => s.relevance), groundedness: avg((s) => s.groundedness), hallucination: avg((s) => (s.hallucination > 0.4 ? 1 : 0)), toxicity: avg((s) => s.toxicity), pii: avg((s) => s.pii), toolcall: 0.95, structured: 1 };
    setCands((c) => [...c.filter((x) => !x.name.startsWith("R5")), { name: `R5: prod v2 measured ${isLive ? "LIVE" : "(sim)"}`, desc: "Actually ran the golden set just now", m }]);
    setBusy(false);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <Card title="Gate thresholds (evals/thresholds.yaml)">
        <div className="space-y-3">
          {METRICS.map((m) => (
            <div key={m.id}>
              <Slider label={`${m.name} ${m.dir === "min" ? "≥" : "≤"}`} value={th[m.id].v} min={0} max={1} step={0.01} onChange={(v) => setTh({ ...th, [m.id]: { ...th[m.id], v } })} fmt={(v) => v.toFixed(2)} />
              <div className="mt-0.5 flex gap-1">{(["block", "warn"] as const).map((md) => <button type="button" key={md} onClick={() => setTh({ ...th, [m.id]: { ...th[m.id], mode: md } })} className={cx("rounded px-1.5 text-[10px] font-semibold", th[m.id].mode === md ? (md === "block" ? "bg-rose-600 text-white" : "bg-amber-500 text-white") : "bg-slate-100 text-slate-500")}>{md}</button>)}</div>
            </div>
          ))}
        </div>
      </Card>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Btn onClick={measure} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}Measure current prod on golden set {isLive && "(LIVE)"}</Btn>
          <span className="text-xs text-slate-500">Adds candidate R5, using real scores from the evaluator</span>
        </div>
        <Card title="Release candidates vs gates" pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Candidate</th>{METRICS.map((m) => <th key={m.id} className="px-1 py-2 text-center font-medium">{m.name.split(" ")[0]}</th>)}<th className="px-3 py-2">Decision</th></tr></thead>
              <tbody>
                {cands.map((c) => {
                  const v = verdict(c.m);
                  const blocked = v.some((x) => x.block);
                  const warned = v.some((x) => x.warn);
                  return (
                    <tr key={c.name} className="border-t border-slate-100">
                      <td className="px-3 py-2"><div className="font-semibold">{c.name}</div><div className="text-slate-500">{c.desc}</div></td>
                      {v.map((x) => <td key={x.id} className={cx("px-1 py-2 text-center font-mono", x.block ? "bg-rose-100 font-bold text-rose-800" : x.warn ? "bg-amber-100 text-amber-800" : "text-emerald-700")}>{c.m[x.id].toFixed(2)}</td>)}
                      <td className="px-3 py-2 text-center">{blocked ? <Pill color="red">BLOCK</Pill> : warned ? <Pill color="amber">SHIP + warn</Pill> : <Pill color="green">SHIP</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Callout tone="info" title="Discuss">R2 cuts cost by 85%, but tool-call accuracy drops. Would you ship it for a FAQ bot? For an agent that files tickets? Gates can be <b>per-application</b>.</Callout>
      </div>
    </div>
  );
}

// ============ 3.4 Deployment strategies ============
type Strategy = "bluegreen" | "canary" | "shadow" | "ab" | "flag";
const STRATS: { id: Strategy; name: string; desc: string }[] = [
  { id: "bluegreen", name: "Blue/Green", desc: "Switch 100% to green at once; switch back to roll back" },
  { id: "canary", name: "Canary", desc: "5% → 25% → 50% → 100%, watch metrics at each step" },
  { id: "shadow", name: "Shadow", desc: "v2 gets a copy of traffic; users only ever see v1" },
  { id: "ab", name: "A/B test", desc: "50/50 split for a fixed period, compare outcomes" },
  { id: "flag", name: "Feature flag", desc: "Internal users (2%) first, then flip on for everyone" },
];
const share = (s: Strategy, t: number) => {
  if (t < 10) return 0;
  switch (s) {
    case "bluegreen": return 1;
    case "canary": return t < 22 ? 0.05 : t < 34 ? 0.25 : t < 46 ? 0.5 : 1;
    case "shadow": return 1; // mirrored, not served
    case "ab": return 0.5;
    case "flag": return t < 30 ? 0.02 : 1;
  }
};

export function DeployStrategies() {
  const [strategy, setStrategy] = useState<Strategy>("canary");
  const [what, setWhat] = useState("Prompt rollout");
  const [metric, setMetric] = useState("groundedness");
  const [sample, setSample] = useState(10);
  const [results, setResults] = useState<{ s: string; detected: string; impacted: number; metric: string }[]>([]);
  const [sim, setSim] = useState<{ v2: number[]; q1: number[]; q2: number[]; rollback: number | null; impacted: number } | null>(null);

  const run = () => {
    const r = rng(strategy.length * 17 + sample + metric.length);
    const v2: number[] = [], q1: number[] = [], q2: number[] = [];
    let rollback: number | null = null, impacted = 0, samples = 0, bad = 0;
    for (let t = 0; t < 60; t++) {
      const sh = rollback !== null ? 0 : share(strategy, t);
      v2.push(sh * 100);
      q1.push(0.9 + (r() - 0.5) * 0.04);
      const qual = 0.72 + (r() - 0.5) * 0.06;
      q2.push(sh > 0 || (strategy === "shadow" && t >= 10) ? qual : NaN);
      const reqs = 200;
      if (strategy !== "shadow") impacted += Math.round(reqs * sh * (1 - qual) * 0.5);
      if (rollback === null && t >= 10) {
        const seen = strategy === "shadow" ? reqs : reqs * sh;
        const n = Math.round(seen * (sample / 100));
        if (metric === "groundedness") { samples += n; bad += n * (1 - qual); if (samples > 30 && 1 - bad / samples < 0.8) rollback = t; }
        if (metric === "error rate") { /* v2 has no extra errors, so this alert never fires */ }
        if (metric === "latency") { /* v2 is faster, so this alert never fires */ }
      }
    }
    setSim({ v2, q1, q2: q2.map((x) => (isNaN(x) ? 0 : x)), rollback, impacted });
    const name = STRATS.find((s) => s.id === strategy)!.name;
    setResults((rs) => [{ s: name, detected: rollback !== null ? (strategy === "shadow" ? `t=${rollback} (no users affected)` : `t=${rollback}, auto-rollback`) : "never", impacted, metric }, ...rs.filter((x) => !(x.s === name && x.metric === metric))]);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card title="Rollout plan">
          <div className="space-y-3">
            <div className="space-y-1.5">
              {STRATS.map((s) => (
                <button type="button" key={s.id} onClick={() => setStrategy(s.id)} className={cx("block w-full rounded-lg border-2 px-3 py-2 text-left", strategy === s.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200")}>
                  <div className="text-sm font-semibold">{s.name}</div><div className="text-[11px] text-slate-500">{s.desc}</div>
                </button>
              ))}
            </div>
            <Select label="What is being rolled out" value={what} onChange={setWhat} options={["Prompt rollout", "Model rollout"]} />
            <Select label="Auto-rollback on" value={metric} onChange={setMetric} options={["groundedness", "error rate", "latency"]} />
            <Slider label="Online eval sampling" value={sample} min={1} max={50} onChange={setSample} fmt={(v) => `${v}% of traffic`} />
            <Btn onClick={run} className="w-full"><Play size={14} />Run rollout</Btn>
          </div>
        </Card>
        <div className="space-y-3">
          <Callout tone="warn" title={`Hidden in v2 (${what.toLowerCase()})`}>Latency is 15% better and the error rate is identical, but groundedness drops from 0.90 to 0.72.</Callout>
          {sim && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Regression detected" value={sim.rollback !== null ? `t = ${sim.rollback}` : "never"} tone={sim.rollback !== null ? "green" : "red"} />
                <Stat label="Bad answers served to users" value={sim.impacted.toLocaleString()} tone={sim.impacted > 500 ? "red" : sim.impacted > 0 ? "amber" : "green"} />
                <Stat label="Final v2 traffic" value={`${sim.v2.at(-1)}%`} />
              </div>
              <Card title="% of traffic served by v2"><LineChart height={120} yMax={100} series={[{ name: strategy === "shadow" ? "v2 (shadow: mirrored, not served)" : "v2 traffic %", color: "#059669", values: sim.v2, dashed: strategy === "shadow" }]} markers={sim.rollback !== null ? [{ x: sim.rollback, label: "rollback" }] : []} fmt={(v) => `${Math.round(v)}%`} /></Card>
              <Card title="Online quality (groundedness)"><LineChart height={120} yMax={1} yMin={0.5} series={[{ name: "v1", color: "#64748b", values: sim.q1 }, { name: "v2", color: "#e11d48", values: sim.q2.map((x) => x || 0.5) }]} fmt={(v) => v.toFixed(2)} markers={[{ x: 10, label: "rollout starts", color: "#059669" }]} /></Card>
            </>
          )}
          {results.length > 0 && (
            <Card title="Compare your runs" pad={false}>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-3 py-1.5">Strategy</th><th>Rollback metric</th><th>Detected</th><th>Users impacted</th></tr></thead>
                <tbody>{results.map((r, i) => <tr key={i} className="border-t border-slate-100"><td className="px-3 py-1.5 font-semibold">{r.s}</td><td>{r.metric}</td><td>{r.detected}</td><td className="font-mono">{r.impacted.toLocaleString()}</td></tr>)}</tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ 3.5 Infrastructure ============
const HOSTING = {
  api: { name: "Managed model API (pay per token)", perReq: 0.004, hourly: 0, cap: Infinity, base: 1.2, cold: 0 },
  serverless: { name: "Serverless GPU inference", perReq: 0.0012, hourly: 0, cap: 4, base: 0.9, cold: 8 },
  endpoint: { name: "Managed dedicated endpoint", perReq: 0, hourly: 4.1, cap: 6, base: 0.8, cold: 0 },
  k8s: { name: "Self-hosted on Kubernetes (GPU nodes)", perReq: 0, hourly: 2.6, cap: 5, base: 0.85, cold: 0 },
} as const;
type HostKey = keyof typeof HOSTING;

export function Infra() {
  const [host, setHost] = useState<HostKey>("k8s");
  const [peak, setPeak] = useState(25);
  const [minR, setMinR] = useState(1);
  const [maxR, setMaxR] = useState(8);
  const [target, setTarget] = useState(70);
  const [lag, setLag] = useState(2);
  const [autoscale, setAutoscale] = useState(true);
  const [scrub, setScrub] = useState(40);

  const sim = useMemo(() => {
    const h = HOSTING[host];
    const steps = 96;
    const demand = Array.from({ length: steps }, (_, i) => {
      const hr = i / 4;
      const day = Math.exp(-((hr - 11) ** 2) / 8) + 0.8 * Math.exp(-((hr - 16) ** 2) / 6);
      return Math.max(0.3, peak * Math.min(1, day) + (Math.sin(i * 1.7) + 1) * 0.4);
    });
    const replicas: number[] = [], lat: number[] = [], cost: number[] = [], dropped: number[] = [];
    let cur = minR;
    const desiredHist: number[] = [];
    for (let i = 0; i < steps; i++) {
      const d = demand[i];
      if (h.cap === Infinity) { replicas.push(0); lat.push(h.base); cost.push(d * 900 * h.perReq); dropped.push(0); continue; }
      const desired = Math.min(maxR, Math.max(minR, Math.ceil(d / (h.cap * (target / 100)))));
      desiredHist.push(desired);
      if (autoscale) { const past = desiredHist[Math.max(0, desiredHist.length - 1 - lag)]; cur = past; } else cur = minR;
      if (host === "serverless") cur = Math.max(cur, 0);
      replicas.push(cur);
      const capTot = cur * h.cap;
      const u = capTot ? d / capTot : 9;
      const coldPenalty = host === "serverless" && i > 0 && cur > replicas[i - 1] ? h.cold : 0;
      lat.push(Math.min(30, h.base / Math.max(0.05, 1 - Math.min(u, 0.95)) * 0.5 + coldPenalty + (u > 1 ? 10 : 0)));
      dropped.push(Math.max(0, d - capTot) * 900);
      cost.push(host === "serverless" ? d * 900 * h.perReq : cur * h.hourly / 4);
    }
    const totalCost = cost.reduce((a, b) => a + b, 0);
    const sorted = [...lat].sort((a, b) => a - b);
    return { demand, replicas, lat, cost, totalCost, p95: sorted[Math.floor(sorted.length * 0.95)], dropped: dropped.reduce((a, b) => a + b, 0), reqs: demand.reduce((a, b) => a + b * 900, 0) };
  }, [host, peak, minR, maxR, target, lag, autoscale]);

  const h = HOSTING[host];
  const pods = sim.replicas[scrub];
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <Card title="Infrastructure choices">
        <div className="space-y-3">
          <Select<HostKey> label="Hosting" value={host} onChange={setHost} options={Object.entries(HOSTING).map(([k, v]) => ({ value: k as HostKey, label: v.name }))} />
          <Slider label="Peak traffic" value={peak} min={2} max={80} onChange={setPeak} fmt={(v) => `${v} req/s`} />
          {h.cap !== Infinity && (
            <>
              <Toggle label="Autoscaling (HPA)" checked={autoscale} onChange={setAutoscale} />
              <Slider label="Min replicas" value={minR} min={host === "serverless" ? 0 : 1} max={10} onChange={setMinR} />
              <Slider label="Max replicas" value={maxR} min={1} max={30} onChange={setMaxR} />
              <Slider label="Target utilisation" value={target} min={30} max={95} onChange={setTarget} fmt={(v) => `${v}%`} />
              <Slider label="Scale-up lag" value={lag} min={0} max={6} onChange={setLag} fmt={(v) => `${v * 15} min`} />
              <div className="text-[11px] text-slate-500">Capacity per replica: {h.cap} req/s{h.hourly ? ` · $${h.hourly}/hr per GPU` : ""}{h.cold ? ` · cold start ${h.cold}s` : ""}</div>
            </>
          )}
        </div>
      </Card>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Cost / day" value={`$${Math.round(sim.totalCost).toLocaleString()}`} sub={`$${(sim.totalCost / sim.reqs * 1000).toFixed(2)} per 1k req`} />
          <Stat label="p95 latency" value={`${sim.p95.toFixed(1)}s`} tone={sim.p95 > 5 ? "red" : sim.p95 > 2.5 ? "amber" : "green"} />
          <Stat label="Dropped requests" value={Math.round(sim.dropped).toLocaleString()} tone={sim.dropped > 0 ? "red" : "green"} />
          <Stat label="Requests / day" value={`${(sim.reqs / 1000).toFixed(0)}k`} />
        </div>
        <Card title="Demand vs capacity over 24h">
          <LineChart height={130} series={[{ name: "demand (req/s)", color: "#0f172a", values: sim.demand }, ...(h.cap !== Infinity ? [{ name: "capacity (req/s)", color: "#059669", values: sim.replicas.map((r) => r * h.cap) }] : [])]} xLabels={sim.demand.map((_, i) => `${Math.floor(i / 4)}h`)} markers={[{ x: scrub, label: "▼", color: "#6366f1" }]} />
        </Card>
        <Card title="Latency (s)"><LineChart height={100} series={[{ name: "latency", color: "#e11d48", values: sim.lat }]} fmt={(v) => v.toFixed(1)} /></Card>
        <Card title={`Cluster view at ${Math.floor(scrub / 4)}:${String((scrub % 4) * 15).padStart(2, "0")}`}>
          <Slider label="Time of day" value={scrub} min={0} max={95} onChange={setScrub} fmt={(v) => `${Math.floor(v / 4)}:${String((v % 4) * 15).padStart(2, "0")}`} />
          <div className="mt-3 flex items-center gap-3">
            <div className="rounded-lg border-2 border-slate-400 bg-slate-50 px-3 py-4 text-center text-xs font-semibold">Load<br />balancer<br /><span className="font-mono text-slate-500">{sim.demand[scrub].toFixed(1)} req/s</span></div>
            <span className="text-slate-300">→</span>
            {h.cap === Infinity ? (
              <div className="rounded-lg border-2 border-dashed border-violet-300 bg-violet-50 px-4 py-4 text-xs text-violet-800">Provider-managed capacity: nothing to scale, pay per token</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: maxR }, (_, i) => (
                  <div key={i} className={cx("flex h-12 w-12 flex-col items-center justify-center rounded-md border-2 text-[9px] font-bold transition", i < pods ? "border-emerald-500 bg-emerald-100 text-emerald-800" : "border-dashed border-slate-200 text-slate-300")}>
                    <span>GPU</span><span>pod {i + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============ 3.6 Pipeline builder ============
const STAGES = [
  { id: "gh", name: "GitHub push / PR", sec: 5, usd: 0 },
  { id: "ci", name: "CI pipeline start", sec: 20, usd: 0 },
  { id: "unit", name: "Unit tests", sec: 60, usd: 0 },
  { id: "eval", name: "LLM evaluation", sec: 360, usd: 2.4 },
  { id: "sec", name: "Security checks", sec: 90, usd: 0 },
  { id: "build", name: "Container build", sec: 180, usd: 0.05 },
  { id: "deploy", name: "Deployment (canary)", sec: 240, usd: 0.1 },
  { id: "obs", name: "Observability", sec: 30, usd: 0 },
];
const COMMITS = [
  { id: "ok", name: "docs: fix typo in README", fails: null as string | null, why: "" },
  { id: "secret", name: "feat: add provider key to config", fails: "sec", why: "secret-scan found sk-live-… in config/prod.yaml" },
  { id: "prompt", name: "prompt: make the bot friendlier (v3)", fails: "eval", why: "groundedness 0.62 < 0.80 · hallucination 31%" },
  { id: "unit", name: "refactor: new retriever interface", fails: "unit", why: "test_retriever_acl failed: TypeError" },
  { id: "drift", name: "model: upgrade to provider's new version", fails: "obs", why: "Canary alert: p95 latency +240%, so the release was rolled back automatically" },
];

export function PipelineBuilder() {
  const [order, setOrder] = useState(() => { const s = [...STAGES]; const r = rng(5); for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; } return s; });
  const [status, setStatus] = useState<Record<string, "idle" | "run" | "pass" | "fail" | "skip">>({});
  const [result, setResult] = useState<{ commit: string; msg: string; secs: number; usd: number; leaked?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const correct = order.every((s, i) => s.id === STAGES[i].id);
  const move = (i: number, d: number) => setOrder((o) => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const push = async (c: (typeof COMMITS)[number]) => {
    setBusy(true);
    const st: typeof status = {};
    setStatus({});
    let secs = 0, usd = 0, failed = false, leaked = false;
    const builtBeforeSec = order.findIndex((s) => s.id === "build") < order.findIndex((s) => s.id === "sec");
    for (const s of order) {
      if (failed) { st[s.id] = "skip"; setStatus({ ...st }); continue; }
      st[s.id] = "run"; setStatus({ ...st });
      await sleep(350);
      secs += s.sec; usd += s.usd;
      const fail = c.fails === s.id;
      if (c.id === "secret" && s.id === "build" && builtBeforeSec) leaked = true;
      st[s.id] = fail ? "fail" : "pass";
      if (fail) failed = true;
      setStatus({ ...st });
    }
    setResult({ commit: c.name, msg: c.fails ? `Caught at "${STAGES.find((s) => s.id === c.fails)!.name}": ${c.why}` : "All stages green. Deployed via canary.", secs, usd, leaked });
    setBusy(false);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card title="1 · Arrange the pipeline" right={correct ? <Pill color="green">Correct order</Pill> : <Pill color="amber">Not yet</Pill>}>
        <div className="space-y-1">
          {order.map((s, i) => (
            <div key={s.id} className={cx("flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm", s.id === STAGES[i].id && correct ? "border-emerald-300 bg-emerald-50" : "border-slate-200")}>
              <span className="w-5 text-center font-mono text-xs text-slate-400">{i + 1}</span>
              <span className="flex-1 font-medium">{s.name}</span>
              <span className="text-[10px] text-slate-400">{s.sec >= 60 ? `${s.sec / 60}m` : `${s.sec}s`}{s.usd ? ` · $${s.usd}` : ""}</span>
              <button type="button" onClick={() => move(i, -1)} className="rounded p-0.5 hover:bg-slate-100"><ArrowUp size={13} /></button>
              <button type="button" onClick={() => move(i, 1)} className="rounded p-0.5 hover:bg-slate-100"><ArrowDown size={13} /></button>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-slate-500">Hint: fail fast and cheap. Expensive LLM evals come after the free checks, and nothing ships before security.</div>
      </Card>
      <div className="space-y-3">
        <Card title="2 · Push a commit">
          <div className="flex flex-wrap gap-2">{COMMITS.map((c) => <Btn key={c.id} size="sm" variant="secondary" onClick={() => push(c)} disabled={busy}>{c.name}</Btn>)}</div>
        </Card>
        <Card title="Pipeline run">
          <div className="flex flex-wrap items-center gap-1">
            {order.map((s, i) => {
              const st = status[s.id] ?? "idle";
              return (
                <div key={s.id} className="flex items-center gap-1">
                  <div className={cx("min-w-[96px] rounded-lg border-2 px-2 py-2 text-center text-[11px] font-semibold transition",
                    st === "pass" && "border-emerald-500 bg-emerald-50 text-emerald-800", st === "fail" && "border-rose-500 bg-rose-50 text-rose-800", st === "run" && "border-blue-500 bg-blue-50 text-blue-800 pulse-ring", st === "skip" && "border-slate-200 text-slate-300", st === "idle" && "border-slate-200 text-slate-600")}>
                    {st === "run" ? <Loader2 size={12} className="mx-auto animate-spin" /> : st === "pass" ? <CheckCircle2 size={12} className="mx-auto" /> : st === "fail" ? <XCircle size={12} className="mx-auto" /> : null}
                    {s.name}
                  </div>
                  {i < order.length - 1 && <span className="text-slate-300">→</span>}
                </div>
              );
            })}
          </div>
          {result && (
            <div className="mt-3 space-y-2">
              <Callout tone={result.msg.startsWith("All") ? "ok" : "bad"} title={result.commit}>{result.msg}</Callout>
              <div className="grid grid-cols-2 gap-2"><Stat label="Time to feedback" value={`${Math.round(result.secs / 60)}m ${result.secs % 60}s`} /><Stat label="CI spend" value={`$${result.usd.toFixed(2)}`} /></div>
              {result.leaked && <Callout tone="bad" title="Your order leaked the secret">The container was built and pushed <b>before</b> the security scan ran, so the key is now baked into an image in the registry.</Callout>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
