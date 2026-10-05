"use client";
import { useMemo, useState } from "react";
import { Boxes, CheckCircle2, Copy, Loader2, Play, Plug, Rocket, ShieldAlert, Terminal, Zap } from "lucide-react";
import { useApp } from "@/lib/store";
import { AgentPolicy, DEFAULT_POLICY, runAgent, SAMPLE_TASKS, Span, TOOLS } from "@/lib/agent";
import { MODELS } from "@/lib/sim";
import { Btn, Callout, Card, cx, Input, Pill, Select, Slider, Stat, Toggle } from "@/components/ui";
import { LineChart, Radar } from "@/components/shared/Charts";
import { TraceWaterfall } from "@/components/shared/TraceWaterfall";
import { useApproval } from "@/components/shared/Approval";

// ============ 6.1 100 teams ============
const DIY = [
  { n: "Gateway & keys", w: 6, c: "#2563eb" }, { n: "RAG stack", w: 6, c: "#059669" }, { n: "Agent runtime", w: 6, c: "#0891b2" },
  { n: "Eval harness", w: 5, c: "#d97706" }, { n: "Tracing & cost", w: 5, c: "#ea580c" }, { n: "Guardrails", w: 4, c: "#e11d48" }, { n: "Prompt mgmt", w: 2, c: "#7c3aed" },
];
const DIY_WEEKS = DIY.reduce((a, d) => a + d.w, 0);

export function HundredTeams() {
  const [teams, setTeams] = useState(12);
  const [platformBuild, setPlatformBuild] = useState(90);
  const [platformTeam, setPlatformTeam] = useState(5);
  const onboard = 1.5;
  const xs = Array.from({ length: 51 }, (_, i) => i * 2 || 1);
  const diy = (n: number) => n * DIY_WEEKS * 1.15; // build + run/maintain
  const plat = (n: number) => platformBuild + platformTeam * 46 * 0.5 + n * onboard;
  const breakEven = xs.find((n) => plat(n) < diy(n)) ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card title="Assumptions (engineer-weeks per year)">
          <div className="space-y-3">
            <Slider label="Number of teams building AI apps" value={teams} min={1} max={100} onChange={setTeams} />
            <Slider label="Platform initial build" value={platformBuild} min={30} max={200} step={10} onChange={setPlatformBuild} fmt={(v) => `${v} wks`} />
            <Slider label="Platform team size (FTE)" value={platformTeam} min={2} max={15} onChange={setPlatformTeam} />
            <div className="rounded bg-slate-50 p-2 text-[11px] text-slate-600">Each DIY team re-builds: {DIY.map((d) => `${d.n} (${d.w}w)`).join(", ")} = {DIY_WEEKS} weeks + 15% upkeep.</div>
          </div>
        </Card>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="DIY effort" value={`${Math.round(diy(teams))} wks`} tone="red" />
            <Stat label="With platform" value={`${Math.round(plat(teams))} wks`} tone="green" />
            <Stat label="Break-even" value={`${breakEven} teams`} />
            <Stat label="Ways PII is handled" value={`${teams} vs 1`} sub="governance surface" tone={teams > 3 ? "red" : "slate"} />
          </div>
          <Card title="Total effort vs number of teams"><LineChart height={150} series={[{ name: "Every team builds its own stack", color: "#e11d48", values: xs.map(diy) }, { name: "Shared AI platform", color: "#059669", values: xs.map(plat) }]} xLabels={xs.map(String)} markers={[{ x: xs.indexOf(xs.find((x) => x >= teams) ?? 100), label: `${teams} teams`, color: "#4f46e5" }]} /></Card>
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Without a platform">
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: Math.min(teams, 24) }, (_, i) => (
                  <div key={i} className="w-12 overflow-hidden rounded border border-slate-200">
                    <div className="bg-slate-700 py-0.5 text-center text-[8px] text-white">app {i + 1}</div>
                    {DIY.map((d) => <div key={d.n} style={{ background: d.c, height: d.w }} title={d.n} />)}
                  </div>
                ))}
                {teams > 24 && <div className="self-center text-xs text-slate-500">+{teams - 24} more…</div>}
              </div>
            </Card>
            <Card title="With a platform">
              <div className="flex flex-wrap gap-1.5">{Array.from({ length: Math.min(teams, 24) }, (_, i) => <div key={i} className="w-12 rounded bg-slate-700 py-1 text-center text-[8px] text-white">app {i + 1}</div>)}</div>
              <div className="mt-2 grid grid-cols-7 overflow-hidden rounded">{DIY.map((d) => <div key={d.n} style={{ background: d.c }} className="px-1 py-2 text-center text-[8px] font-semibold leading-tight text-white">{d.n}</div>)}</div>
              <div className="mt-1 text-center text-[10px] text-slate-500">shared platform layer: built once, governed once</div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 6.2 Agent runtime + tool registry ============
const MCP_SERVERS = [
  { name: "jira-mcp", url: "https://mcp.internal/jira", tools: ["jira_search", "jira_create_issue", "jira_delete_project"] },
  { name: "github-mcp", url: "https://mcp.internal/github", tools: ["gh_search_code", "gh_create_pr", "gh_merge_pr"] },
];

export function AgentRuntime() {
  const { isLive, settings } = useApp();
  const [policy, setPolicy] = useState<AgentPolicy>({ ...DEFAULT_POLICY, registered: { ...DEFAULT_POLICY.registered }, approval: { ...DEFAULT_POLICY.approval } });
  const [task, setTask] = useState(SAMPLE_TASKS[1]);
  const [spans, setSpans] = useState<Span[]>([]);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [mcp, setMcp] = useState<Record<string, Record<string, boolean>>>({});
  const approval = useApproval();

  const run = async () => {
    setBusy(true); setSpans([]); setAnswer("");
    const r = await runAgent({ task, policy, live: isLive, settings, onSpan: setSpans, onApproval: approval.request });
    setAnswer(r.answer);
    setBusy(false);
  };
  const setReg = (n: string, v: boolean) => setPolicy({ ...policy, registered: { ...policy.registered, [n]: v } });
  const setApp = (n: string, v: boolean) => setPolicy({ ...policy, approval: { ...policy.approval, [n]: v } });
  const decisions = spans.filter((s) => s.kind === "policy" || s.note);
  const graph = spans.filter((s) => s.kind !== "agent");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
        <Card title="Platform tool registry" pad={false}>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-3 py-2">Tool</th><th>Source</th><th>Scope</th><th>Risk</th><th>Owner</th><th className="text-center">Granted to HR agent</th><th className="text-center">Human approval</th></tr></thead>
            <tbody>
              {TOOLS.map((t) => (
                <tr key={t.name} className="border-t border-slate-100">
                  <td className="px-3 py-1.5"><div className="font-mono font-semibold">{t.name}</div><div className="text-[10px] text-slate-500">{t.description}</div></td>
                  <td>{t.source === "mcp" ? <Pill color="cyan"><Plug size={9} />MCP</Pill> : <Pill>native</Pill>}</td>
                  <td><Pill color={t.scope === "read" ? "green" : t.scope === "read:pii" ? "amber" : t.scope === "write" ? "violet" : "red"}>{t.scope}</Pill></td>
                  <td><Pill color={t.risk === "low" ? "green" : t.risk === "medium" ? "amber" : "red"}>{t.risk}</Pill></td>
                  <td className="text-slate-600">{t.owner}</td>
                  <td className="text-center"><input type="checkbox" checked={!!policy.registered[t.name]} onChange={(e) => setReg(t.name, e.target.checked)} /></td>
                  <td className="text-center"><input type="checkbox" checked={!!policy.approval[t.name]} onChange={(e) => setApp(t.name, e.target.checked)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"><Plug size={13} />Connect an MCP server</div>
            <div className="grid gap-2 md:grid-cols-2">
              {MCP_SERVERS.map((s) => (
                <div key={s.name} className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-2 text-xs">
                  <div className="flex items-center justify-between"><span className="font-mono font-semibold">{s.name}</span>{mcp[s.name] ? <Pill color="green">connected</Pill> : <Btn size="sm" variant="secondary" onClick={() => setMcp({ ...mcp, [s.name]: Object.fromEntries(s.tools.map((t) => [t, false])) })}>Connect</Btn>}</div>
                  <div className="text-[10px] text-slate-500">{s.url}</div>
                  {mcp[s.name] && (
                    <div className="mt-1 space-y-0.5">
                      <div className="text-[10px] text-slate-500">tools/list discovered:</div>
                      {s.tools.map((t) => (
                        <label key={t} className="flex items-center gap-1.5">
                          <input type="checkbox" checked={mcp[s.name][t]} onChange={(e) => setMcp({ ...mcp, [s.name]: { ...mcp[s.name], [t]: e.target.checked } })} />
                          <span className="font-mono">{t}</span>
                          {/delete|merge/.test(t) && <Pill color="red">high risk</Pill>}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {Object.values(mcp).some((m) => Object.entries(m).some(([k, v]) => v && /delete|merge/.test(k))) && <div className="mt-2"><Callout tone="bad" title="Excessive agency">You granted a destructive MCP tool to an HR agent. A platform policy should require an owner review for high-risk MCP tools.</Callout></div>}
          </div>
        </Card>
        <Card title="Agent runtime policy">
          <div className="space-y-3">
            <Select label="Model (via gateway)" value={policy.model} onChange={(v) => setPolicy({ ...policy, model: v })} options={MODELS.map((m) => m.id)} />
            <Slider label="Max steps (loop guard)" value={policy.maxSteps} min={1} max={12} onChange={(v) => setPolicy({ ...policy, maxSteps: v })} />
            <Toggle label="Enforce data ownership" hint="Users can only access their own records" checked={policy.enforceOwnership} onChange={(v) => setPolicy({ ...policy, enforceOwnership: v })} />
            <Toggle label="Sanitise tool outputs" hint="Strip instructions found in tool results" checked={policy.sanitizeToolOutput} onChange={(v) => setPolicy({ ...policy, sanitizeToolOutput: v })} />
            <div className="rounded bg-slate-50 p-2 text-[11px] text-slate-600">Acting as employee <b>E1001</b> (Arjun Mehta)</div>
          </div>
        </Card>
      </div>

      <Card title="Run a task">
        <div className="flex gap-2"><Input value={task} onChange={setTask} /><Btn onClick={run} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : isLive ? <Zap size={14} /> : <Play size={14} />}Run{isLive && " LIVE"}</Btn></div>
        <div className="mt-2 flex flex-wrap gap-1">{SAMPLE_TASKS.map((t) => <button type="button" key={t} onClick={() => setTask(t)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200">{t}</button>)}</div>
      </Card>
      {approval.banner}

      {graph.length > 0 && (
        <Card title="Execution graph (workflow orchestration)">
          <div className="flex flex-wrap items-center gap-1">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white">start</span>
            {graph.map((s) => (
              <span key={s.id} className="flex items-center gap-1">
                <span className="text-slate-300">→</span>
                <span className={cx("rounded-lg border-2 px-2 py-1 text-[11px] font-semibold", s.kind === "llm" ? "border-violet-300 bg-violet-50 text-violet-800" : s.kind === "policy" || s.status === "blocked" ? "border-rose-400 bg-rose-50 text-rose-800" : "border-sky-300 bg-sky-50 text-sky-800")}>{s.name.replace("tool.", "").replace("policy ✋ ", "✋ ")}</span>
              </span>
            ))}
            {!busy && <><span className="text-slate-300">→</span><span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">respond</span></>}
          </div>
        </Card>
      )}
      <TraceWaterfall spans={spans} />
      {answer && <Card title="Agent response"><div className="text-sm">{answer}</div></Card>}
      {decisions.length > 0 && (
        <Card title="Policy decisions (audit log)">
          <ul className="space-y-1 text-xs">{decisions.map((d) => <li key={d.id} className="flex items-center gap-2"><ShieldAlert size={13} className={d.status === "blocked" ? "text-rose-600" : "text-amber-600"} /><b>{d.name}</b><span className="text-slate-600">{d.note ?? d.output}</span></li>)}</ul>
        </Card>
      )}
    </div>
  );
}

// ============ 6.3 Golden path ============
const TEMPLATES = [
  { id: "rag", name: "RAG knowledge app", icon: "📚", desc: "Q&A over your documents" },
  { id: "chat", name: "AI assistant", icon: "💬", desc: "Chat with prompts + memory" },
  { id: "agent", name: "Agent with tools", icon: "🤖", desc: "Tool calling via MCP" },
  { id: "docai", name: "Document intelligence", icon: "📄", desc: "Extract structured data" },
  { id: "code", name: "Coding agent", icon: "👩‍💻", desc: "Repo-aware code assistant" },
  { id: "cs", name: "Customer-service agent", icon: "🎧", desc: "Ticketing + knowledge" },
];
const CLASS_POLICY: Record<string, { models: string; guard: string[] }> = {
  public: { models: "any approved provider", guard: ["toxicity filter"] },
  internal: { models: "approved cloud providers (no training on data)", guard: ["toxicity filter", "prompt-injection classifier"] },
  confidential: { models: "EU/IN-resident providers + self-hosted", guard: ["toxicity filter", "prompt-injection classifier", "PII redaction"] },
  restricted: { models: "self-hosted only (llama-70b, hr-ft-8b)", guard: ["toxicity filter", "prompt-injection classifier", "PII redaction", "DLP", "human review of tool calls"] },
};

export function GoldenPath() {
  const [tpl, setTpl] = useState("rag");
  const [name, setName] = useState("benefits-bot");
  const [team, setTeam] = useState("people-analytics");
  const [cls, setCls] = useState("confidential");
  const [budget, setBudget] = useState(2000);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const pol = CLASS_POLICY[cls];
  const t = TEMPLATES.find((x) => x.id === tpl)!;

  const create = async () => {
    setBusy(true); setDone(false); setLog([]);
    const steps = [
      `Creating repo ${team}/${name} from template '${tpl}'…`,
      `Issuing gateway key ${name}-prod with budget $${budget}/mo and alert at 80%`,
      `Applying data policy '${cls}': models → ${pol.models}`,
      `Enabling guardrails: ${pol.guard.join(", ")}`,
      `Registering prompt 'system' v1 in the prompt registry (owner: ${team})`,
      tpl === "rag" || tpl === "cs" ? "Provisioning vector index namespace + ingestion pipeline" : tpl === "agent" || tpl === "code" ? "Creating agent runtime profile + empty tool allow-list" : "Configuring structured-output schema validator",
      "Wiring OpenTelemetry tracing → observability platform",
      "Adding starter eval suite (12 cases) + CI quality gates",
      "Creating dashboards: quality, latency, cost per user",
      "✓ Ready. First deploy goes to staging via canary.",
    ];
    for (const s of steps) { setLog((l) => [...l, s]); await new Promise((r) => setTimeout(r, 280)); }
    setDone(true); setBusy(false);
  };

  const sdk = `from acme_ai import App\n\napp = App("${name}")            # gateway key, tracing, budget: injected\n\n@app.handler\ndef answer(q: str, user):\n${tpl === "rag" || tpl === "cs" ? `    ctx = app.knowledge.search(q, user=user, top_k=3)  # ACL-filtered\n    return app.llm.chat(prompt="system", context=ctx, question=q)` : tpl === "agent" || tpl === "code" ? `    return app.agent.run(q, user=user, tools=app.tools.allowed())  # policy-enforced` : tpl === "docai" ? `    return app.llm.extract(q, schema=InvoiceSchema)  # validated JSON` : `    return app.llm.chat(prompt="system", question=q, memory=app.memory(user))`}`;
  const yaml = `app: ${name}\nteam: ${team}\ntemplate: ${tpl}\ndata_classification: ${cls}\nmodels:\n  alias: default-chat   # platform resolves per policy\n  allowed: ${pol.models}\nbudget:\n  monthly_usd: ${budget}\n  alert_at: 0.8\nguardrails: [${pol.guard.join(", ")}]\neval:\n  suite: starter-${tpl}\n  gates: platform-defaults\nobservability: { tracing: on, sample_eval: 5% }`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card title={<span className="flex items-center gap-1.5"><Boxes size={14} />Developer portal: create a new AI app</span>}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {TEMPLATES.map((x) => (
              <button type="button" key={x.id} onClick={() => setTpl(x.id)} className={cx("rounded-lg border-2 p-2 text-left", tpl === x.id ? "border-cyan-500 bg-cyan-50" : "border-slate-200 hover:border-cyan-300")}>
                <div className="text-lg">{x.icon}</div><div className="text-xs font-semibold">{x.name}</div><div className="text-[10px] text-slate-500">{x.desc}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs"><span className="font-medium">App name</span><Input value={name} onChange={setName} className="py-1" /></label>
            <label className="text-xs"><span className="font-medium">Team</span><Input value={team} onChange={setTeam} className="py-1" /></label>
            <Select label="Data classification" value={cls} onChange={setCls} options={["public", "internal", "confidential", "restricted"]} />
            <Slider label="Monthly budget" value={budget} min={200} max={20000} step={200} onChange={setBudget} fmt={(v) => `$${v.toLocaleString()}`} />
          </div>
          <Btn className="mt-3 w-full" onClick={create} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}Create {t.name}</Btn>
        </Card>
        <Card title={<span className="flex items-center gap-1.5"><Terminal size={14} />Provisioning</span>}>
          <pre className="mb-2 rounded bg-slate-900 p-2 font-mono text-[11px] text-emerald-300">$ aiplat create {name} --template {tpl} --team {team} --class {cls} --budget {budget}</pre>
          <div className="min-h-40 space-y-0.5 font-mono text-[11px]">{log.map((l, i) => <div key={i} className={l.startsWith("✓") ? "font-bold text-emerald-700" : "text-slate-700"}>{l.startsWith("✓") ? "" : "› "}{l}</div>)}</div>
        </Card>
      </div>
      {done && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Inherited automatically">
            <ul className="space-y-1 text-xs">
              {["Gateway key + quota + budget alerts", `Model access per '${cls}' policy`, ...pol.guard.map((g) => `Guardrail: ${g}`), "Distributed tracing (OpenTelemetry)", "Starter eval suite + CI gates", "Prompt registry entry", "Cost dashboard per user/app", "Audit logging"].map((x) => <li key={x} className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-600" />{x}</li>)}
            </ul>
          </Card>
          <Card title="app.py (AI SDK)"><pre className="whitespace-pre-wrap font-mono text-[11px]">{sdk}</pre></Card>
          <Card title="ai-app.yaml" right={<button type="button" onClick={() => navigator.clipboard?.writeText(yaml)} className="text-slate-400 hover:text-slate-700"><Copy size={13} /></button>}><pre className="whitespace-pre-wrap font-mono text-[11px]">{yaml}</pre></Card>
        </div>
      )}
      {done && <Callout tone="info" title="Discuss">Change the classification to <b>restricted</b> and create the app again. What changed? The developer wrote no extra code. That is policy enforcement by the platform.</Callout>}
    </div>
  );
}

// ============ 6.4 Maturity ============
const LAYERS_M = [
  { n: "Developer Exp.", caps: "AI SDK, APIs, templates, CLI, developer portal", next: "Publish one golden-path template + SDK with tracing built in." },
  { n: "Model layer", caps: "Model registry, gateway, routing", next: "Put every LLM call behind one gateway with per-app keys and budgets." },
  { n: "Knowledge layer", caps: "Ingestion, embeddings, vector DB, retrieval APIs", next: "Offer a managed retrieval API with ACL filtering instead of per-team vector DBs." },
  { n: "Agent layer", caps: "Agent runtime, tool registry, MCP, orchestration", next: "Stand up a tool registry with scopes and approval policies before agents scale." },
  { n: "Evaluation layer", caps: "Datasets, automated eval, quality gates", next: "Make an eval suite and CI gate mandatory for production prompts." },
  { n: "Operations layer", caps: "Observability, logging, tracing, cost mgmt", next: "Adopt LLM tracing with cost per app/user and quality sampling." },
  { n: "Governance layer", caps: "Access control, audit, policy, compliance", next: "Define data classification → allowed models/guardrails as policy-as-code." },
];

export function Maturity() {
  const [vals, setVals] = useState<number[]>([2, 3, 2, 1, 1, 2, 2]);
  const gaps = useMemo(() => LAYERS_M.map((l, i) => ({ ...l, v: vals[i] })).sort((a, b) => a.v - b.v).slice(0, 3), [vals]);
  const levels = ["None", "Ad hoc", "Repeatable", "Defined", "Managed", "Optimised"];
  const summary = `AI Platform maturity\n${LAYERS_M.map((l, i) => `${l.n}: ${vals[i]}/5 (${levels[vals[i]]})`).join("\n")}\nNext 3 investments:\n${gaps.map((g, i) => `${i + 1}. ${g.n}: ${g.next}`).join("\n")}`;
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <Card title="Rate your organisation (0 = none, 5 = optimised)">
        <div className="space-y-3">
          {LAYERS_M.map((l, i) => (
            <div key={l.n} className="grid items-center gap-2 md:grid-cols-[180px_1fr_90px]">
              <div><div className="text-sm font-semibold">{l.n}</div><div className="text-[10px] text-slate-500">{l.caps}</div></div>
              <input type="range" min={0} max={5} value={vals[i]} onChange={(e) => setVals(vals.map((v, j) => (j === i ? +e.target.value : v)))} />
              <Pill color={vals[i] <= 1 ? "red" : vals[i] <= 2 ? "amber" : "green"}>{vals[i]} · {levels[vals[i]]}</Pill>
            </div>
          ))}
        </div>
      </Card>
      <div className="space-y-3">
        <Card title="Your platform radar"><Radar axes={LAYERS_M.map((l) => l.n)} values={vals} target={LAYERS_M.map(() => 3)} /><div className="text-center text-[10px] text-slate-500">dashed green = &quot;Defined&quot; (3) baseline for 100+ apps</div></Card>
        <Card title="Suggested next 3 investments" right={<button type="button" onClick={() => navigator.clipboard?.writeText(summary)} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800"><Copy size={12} />copy</button>}>
          <ol className="space-y-2 text-xs">{gaps.map((g, i) => <li key={g.n}><b>{i + 1}. {g.n}</b> ({g.v}/5): {g.next}</li>)}</ol>
        </Card>
      </div>
    </div>
  );
}

