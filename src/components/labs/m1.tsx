"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Lock, Play, Shuffle, XCircle } from "lucide-react";
import { Btn, Callout, Card, cx, Pill } from "@/components/ui";

// ---------------- 1.1 Evolution ----------------
const ERAS = [
  {
    id: "sdlc", name: "Software (SDLC)", year: "1990s →", color: "#64748b",
    artifact: "Source code", tests: "Deterministic unit/integration tests", failure: "Bugs, crashes", owner: "Dev + Ops", deploy: "Binary / container", feedback: "Bug reports",
  },
  {
    id: "mlops", name: "ML Engineering / MLOps", year: "2015 →", color: "#0ea5e9",
    artifact: "Code + data + trained model", tests: "Offline metrics (accuracy, F1, AUC)", failure: "Data drift, training/serving skew", owner: "Data scientists + ML engineers", deploy: "Model artifact behind an endpoint", feedback: "Labelled data → retrain",
  },
  {
    id: "llmops", name: "LLMOps", year: "2023 →", color: "#8b5cf6",
    artifact: "Prompt + model choice + context/RAG + tools + config", tests: "Semantic evals, LLM-as-judge, red-teaming", failure: "Hallucination, injection, cost blow-up, silent quality drift", owner: "AI engineers + product + domain SMEs", deploy: "Prompt/config release on a hosted model, often with no training", feedback: "Traces, user feedback → prompts, eval sets, retrieval",
  },
  {
    id: "platform", name: "AI Platform Engineering", year: "2025 →", color: "#4f46e5",
    artifact: "Shared capabilities: gateway, registries, eval, observability, guardrails", tests: "Platform SLOs + golden paths + policy-as-code", failure: "Every team re-builds infra; ungoverned spend and data exposure", owner: "Platform team serving 100s of app teams", deploy: "Self-service APIs, SDKs, templates", feedback: "Developer adoption, cost & quality across all apps",
  },
];
const ROWS: [keyof (typeof ERAS)[number], string][] = [
  ["artifact", "What gets versioned"], ["tests", "How we test"], ["failure", "Typical failure"], ["owner", "Who owns it"], ["deploy", "Unit of deployment"], ["feedback", "Feedback loop"],
];

const WHY = [
  ["Non-deterministic", "The same input can give different outputs, so exact-match tests break."],
  ["No training step", "Behaviour changes through prompts and context, not retraining. Releases happen daily."],
  ["Pay per token", "Cost scales with usage and prompt size, so a bad prompt can cost $$$."],
  ["Natural-language attack surface", "Prompt injection, jailbreaks and data leakage all arrive through text."],
  ["Composite systems", "Model + retrieval + tools + agents means many places to fail."],
  ["Third-party models", "The provider can update or deprecate the model under you."],
];

const SORT_CARDS: { text: string; ans: "eng" | "plat" }[] = [
  { text: "Write the system prompt for the claims-triage bot", ans: "eng" },
  { text: "Provide one AI gateway with per-team API keys and budgets", ans: "plat" },
  { text: "Pick chunk size for the legal-contracts RAG app", ans: "eng" },
  { text: "Offer a managed vector DB with tenant isolation", ans: "plat" },
  { text: "Build a golden dataset for the sales assistant", ans: "eng" },
  { text: "Run an evaluation service any team can call from CI", ans: "plat" },
  { text: "Define tool schemas for the HR agent", ans: "eng" },
  { text: "Operate the tool registry with scopes & approvals", ans: "plat" },
  { text: "Tune retrieval for one product's FAQ", ans: "eng" },
  { text: "Provide org-wide tracing & cost dashboards", ans: "plat" },
  { text: "Enforce PII guardrails for every app by default", ans: "plat" },
  { text: "A/B test two prompts for the onboarding chatbot", ans: "eng" },
];

export function Evolution() {
  const [era, setEra] = useState(2);
  const [placed, setPlaced] = useState<Record<number, "eng" | "plat">>({});
  const [checked, setChecked] = useState(false);
  const correct = Object.entries(placed).filter(([i, v]) => SORT_CARDS[+i].ans === v).length;

  return (
    <div className="space-y-5">
      <Card title="Four eras of engineering: click an era">
        <div className="relative mb-4 flex items-center justify-between">
          <div className="absolute top-5 right-6 left-6 h-1 rounded bg-gradient-to-r from-slate-300 via-sky-300 to-indigo-500" />
          {ERAS.map((e, i) => (
            <button key={e.id} type="button" onClick={() => setEra(i)} className="relative z-10 flex w-1/4 flex-col items-center gap-1">
              <span className={cx("flex h-10 w-10 items-center justify-center rounded-full border-4 border-white text-sm font-bold text-white shadow transition", era === i && "scale-125")} style={{ background: e.color }}>{i + 1}</span>
              <span className={cx("text-center text-sm", era === i ? "font-bold" : "text-slate-600")}>{e.name}</span>
              <span className="text-[11px] text-slate-400">{e.year}</span>
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {ROWS.map(([k, label]) => (
                <tr key={k} className="border-t border-slate-100">
                  <td className="w-40 py-2 pr-2 text-xs font-semibold text-slate-500">{label}</td>
                  {ERAS.map((e, i) => (
                    <td key={e.id} className={cx("px-2 py-2 align-top text-xs transition", i === era ? "bg-indigo-50 font-medium text-slate-900" : "text-slate-400")}>{e[k]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Why LLM applications need a different operational model">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map(([h, d]) => (
            <div key={h} className="rounded-lg border border-violet-100 bg-violet-50/50 p-3">
              <div className="text-sm font-semibold text-violet-900">{h}</div>
              <div className="text-xs text-slate-600">{d}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Sorting game: AI Engineering vs AI Platform Engineering" right={<div className="flex gap-2"><Btn size="sm" variant="secondary" onClick={() => { setPlaced({}); setChecked(false); }}><Shuffle size={13} />Reset</Btn><Btn size="sm" onClick={() => setChecked(true)} disabled={Object.keys(placed).length < SORT_CARDS.length}>Check answers</Btn></div>}>
        <p className="mb-3 text-xs text-slate-500">AI Engineering = building <b>one</b> AI application. AI Platform Engineering = building <b>reusable capabilities</b> that many teams consume. Assign every card.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {SORT_CARDS.map((c, i) => {
            const p = placed[i];
            const ok = checked && p === c.ans;
            const bad = checked && p && p !== c.ans;
            return (
              <div key={i} className={cx("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", ok && "border-emerald-300 bg-emerald-50", bad && "border-rose-300 bg-rose-50", !checked && "border-slate-200")}>
                <span className="flex-1">{c.text}</span>
                {(["eng", "plat"] as const).map((b) => (
                  <button key={b} type="button" onClick={() => { setPlaced({ ...placed, [i]: b }); setChecked(false); }} className={cx("rounded-md px-2 py-1 text-[11px] font-semibold", p === b ? (b === "eng" ? "bg-sky-600 text-white" : "bg-indigo-600 text-white") : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                    {b === "eng" ? "AI Eng" : "Platform"}
                  </button>
                ))}
                {ok && <CheckCircle2 size={16} className="text-emerald-600" />}
                {bad && <XCircle size={16} className="text-rose-600" />}
              </div>
            );
          })}
        </div>
        {checked && <div className="mt-3"><Callout tone={correct === SORT_CARDS.length ? "ok" : "warn"} title={`${correct}/${SORT_CARDS.length} correct`}>Rule of thumb: if it is specific to one product&apos;s behaviour, it&apos;s AI Engineering. If it should exist <i>once</i> for the whole company, it&apos;s Platform.</Callout></div>}
      </Card>
    </div>
  );
}

// ---------------- 1.2 Lifecycle ----------------
const STAGES = [
  { name: "Data", what: "Collect and curate the documents, FAQs, logs and labelled examples the app will use.", artifact: "Source documents, eval seed data", risk: "Garbage in: stale or unauthorised documents end up in answers." },
  { name: "Model Selection", what: "Choose models by quality, latency, cost, context window, hosting and licence.", artifact: "Model registry entry", risk: "Overpaying for a frontier model, or under-powering complex tasks." },
  { name: "Prompt / Context Eng.", what: "Design system prompts, templates and how context is assembled.", artifact: "Versioned prompt templates", risk: "Untracked prompt edits cause silent regressions." },
  { name: "RAG / Tool Integration", what: "Connect knowledge (retrieval) and actions (tools/APIs/MCP).", artifact: "Index config, tool schemas", risk: "Wrong docs retrieved; tools with excessive permissions." },
  { name: "App Development", what: "Build the UX, orchestration, guardrails and agent logic.", artifact: "Application code", risk: "Business logic tangled into prompts." },
  { name: "Evaluation", what: "Score quality, safety and cost on golden datasets before release.", artifact: "Eval reports, thresholds", risk: "Ship on vibes: regressions reach users." },
  { name: "Deployment", what: "Release via canary/shadow with feature flags and rollback.", artifact: "Release (code+prompt+model+config)", risk: "Big-bang release with no rollback path." },
  { name: "Observability", what: "Trace every step: tokens, latency, cost, retrieval and tool calls.", artifact: "Traces, dashboards, alerts", risk: "Can't explain why an answer was wrong." },
  { name: "Feedback", what: "Capture thumbs up/down, corrections and escalations.", artifact: "Feedback dataset", risk: "Users stop using it, and nobody knows why." },
  { name: "Continuous Improvement", what: "Turn failures into new test cases, prompt fixes and data updates.", artifact: "New eval cases, prompt vN+1", risk: "The same failure repeats forever." },
];

const INCIDENTS = [
  { text: "After a prompt tweak, the bot started answering salary questions it used to refuse. Nobody noticed for 2 weeks.", ans: "Evaluation", alt: "Observability" },
  { text: "The assistant quoted a leave policy that was replaced 6 months ago.", ans: "Data", alt: "RAG / Tool Integration" },
  { text: "The monthly LLM bill tripled. Nobody can say which app caused it.", ans: "Observability", alt: "Deployment" },
  { text: "Users keep rephrasing the same question about expense limits, and the bot keeps failing it.", ans: "Feedback", alt: "Continuous Improvement" },
  { text: "A new model version was rolled out to 100% of users at once and broke JSON outputs.", ans: "Deployment", alt: "Evaluation" },
  { text: "A simple FAQ bot is using the most expensive frontier model for every request.", ans: "Model Selection", alt: "" },
];

export function Lifecycle() {
  const [sel, setSel] = useState(0);
  const [running, setRunning] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSel((s) => (s + 1) % STAGES.length), 900);
    return () => clearInterval(t);
  }, [running]);

  const R = 150, C = 200;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <Card title="The LLM application lifecycle loop" right={<Btn size="sm" variant="secondary" onClick={() => setRunning(!running)}><Play size={13} />{running ? "Stop" : "Animate"}</Btn>}>
          <svg viewBox="0 0 400 400" className="w-full">
            <circle cx={C} cy={C} r={R} fill="none" stroke="#e2e8f0" strokeWidth={14} />
            <circle cx={C} cy={C} r={R} fill="none" stroke="#8b5cf6" strokeWidth={14} strokeDasharray={`${(2 * Math.PI * R) / STAGES.length} ${2 * Math.PI * R}`} strokeDashoffset={-((sel / STAGES.length) * 2 * Math.PI * R) + (Math.PI * R) / 2} style={{ transition: "stroke-dashoffset .5s" }} transform={`rotate(-90 ${C} ${C})`} opacity={0.35} />
            {STAGES.map((s, i) => {
              const a = (i / STAGES.length) * Math.PI * 2 - Math.PI / 2;
              const x = C + Math.cos(a) * R, y = C + Math.sin(a) * R;
              return (
                <g key={s.name} onClick={() => { setSel(i); setRunning(false); }} className="cursor-pointer">
                  <circle cx={x} cy={y} r={sel === i ? 22 : 17} fill={sel === i ? "#7c3aed" : "#fff"} stroke="#7c3aed" strokeWidth={2} style={{ transition: "r .3s" }} />
                  <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={sel === i ? "#fff" : "#7c3aed"}>{i + 1}</text>
                  <text x={C + Math.cos(a) * (R + 38)} y={C + Math.sin(a) * (R + 38) + 3} textAnchor="middle" fontSize={9.5} fill="#334155" fontWeight={sel === i ? 700 : 400}>{s.name}</text>
                </g>
              );
            })}
            <text x={C} y={C - 6} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0f172a">{STAGES[sel].name}</text>
            <text x={C} y={C + 12} textAnchor="middle" fontSize={10} fill="#64748b">stage {sel + 1} of {STAGES.length}</text>
          </svg>
        </Card>
        <Card title={`${sel + 1}. ${STAGES[sel].name}`}>
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">{STAGES[sel].what}</p>
            <div><Pill color="violet">Artifact</Pill> <span className="ml-1 text-slate-700">{STAGES[sel].artifact}</span></div>
            <Callout tone="warn" title="If you skip this stage…">{STAGES[sel].risk}</Callout>
            <div className="text-xs text-slate-500">Notice: <b>Feedback</b> loops back into <b>Data</b>, prompts and eval sets. LLM apps improve without retraining any model.</div>
          </div>
        </Card>
      </div>

      <Card title="Incident Detective: which stage should have caught it?" right={<Btn size="sm" onClick={() => setReveal(true)}>Reveal</Btn>}>
        <div className="space-y-2">
          {INCIDENTS.map((inc, i) => {
            const a = answers[i];
            const ok = a === inc.ans || (inc.alt && a === inc.alt);
            return (
              <div key={i} className={cx("grid items-center gap-2 rounded-lg border px-3 py-2 md:grid-cols-[1fr_220px]", reveal && a && (ok ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"), !reveal && "border-slate-200")}>
                <div className="flex gap-2 text-sm"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />{inc.text}</div>
                <div>
                  <select value={a ?? ""} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm">
                    <option value="">Choose stage…</option>
                    {STAGES.map((s) => <option key={s.name}>{s.name}</option>)}
                  </select>
                  {reveal && <div className="mt-0.5 text-[11px] text-slate-600">Best answer: <b>{inc.ans}</b>{inc.alt && <> (also fine: {inc.alt})</>}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ---------------- 1.3 Component builder ----------------
const COMPONENTS = [
  { id: "gateway", name: "Model Gateway", desc: "One API to all LLMs; keys, routing, quotas" },
  { id: "modelreg", name: "Model Registry", desc: "Approved models + metadata" },
  { id: "promptreg", name: "Prompt Registry", desc: "Versioned prompts, rollback" },
  { id: "vector", name: "Vector Database", desc: "Embeddings + similarity search" },
  { id: "kstore", name: "Feature / Knowledge Store", desc: "Curated enterprise knowledge" },
  { id: "rag", name: "RAG Pipeline", desc: "Ingest → chunk → embed → retrieve" },
  { id: "agent", name: "Agent Runtime", desc: "Tool-calling loop, tool registry" },
  { id: "eval", name: "Evaluation Framework", desc: "Golden sets, judges, gates" },
  { id: "obs", name: "Observability Layer", desc: "Traces, cost, quality metrics" },
  { id: "sec", name: "Security & Governance", desc: "Guardrails, access, audit" },
  { id: "cicd", name: "CI/CD & AI Release Mgmt", desc: "Eval-gated releases, canary" },
];
const USECASES = [
  { name: "RAG application", team: "Knowledge team", req: ["gateway", "vector", "rag"], nice: ["eval", "obs"] },
  { name: "AI assistant", team: "Productivity team", req: ["gateway", "promptreg"], nice: ["obs", "eval"] },
  { name: "Coding agent", team: "Dev-Ex team", req: ["gateway", "agent", "sec"], nice: ["obs", "cicd"] },
  { name: "Customer-service agent", team: "CX team", req: ["gateway", "agent", "rag", "sec", "eval"], nice: ["obs", "cicd"] },
  { name: "Document intelligence", team: "Ops team", req: ["gateway", "kstore", "modelreg"], nice: ["eval"] },
];
export function ComponentBuilder() {
  const [BUDGET, setBudget] = useState(6);
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= BUDGET ? p : [...p, id]));
  const unblocked = USECASES.filter((u) => u.req.every((r) => picked.includes(r))).length;
  const name = (id: string) => COMPONENTS.find((c) => c.id === id)!.name;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <Card title={`Platform components: ${picked.length}/${BUDGET} funded`} right={<div className="flex gap-1"><Btn size="sm" variant={BUDGET === 6 ? "primary" : "secondary"} onClick={() => { setBudget(6); setPicked((p) => p.slice(0, 6)); }}>Year 1: 6</Btn><Btn size="sm" variant={BUDGET === 11 ? "primary" : "secondary"} onClick={() => setBudget(11)}>Year 2: 11</Btn><Btn size="sm" variant="ghost" onClick={() => setPicked([])}>Reset</Btn></div>}>
        <div className="grid gap-2 sm:grid-cols-2">
          {COMPONENTS.map((c) => {
            const on = picked.includes(c.id);
            const locked = !on && picked.length >= BUDGET;
            return (
              <button key={c.id} type="button" onClick={() => toggle(c.id)} className={cx("rounded-lg border-2 p-3 text-left transition", on ? "border-violet-500 bg-violet-50" : locked ? "border-slate-100 opacity-50" : "border-slate-200 hover:border-violet-300")}>
                <div className="flex items-center justify-between text-sm font-semibold">{c.name}{on ? <CheckCircle2 size={15} className="text-violet-600" /> : locked ? <Lock size={13} className="text-slate-400" /> : null}</div>
                <div className="text-xs text-slate-500">{c.desc}</div>
              </button>
            );
          })}
        </div>
      </Card>
      <div className="space-y-3">
        <Card title={`Teams unblocked: ${unblocked}/${USECASES.length}`}>
          <div className="space-y-2">
            {USECASES.map((u) => {
              const missing = u.req.filter((r) => !picked.includes(r));
              const nice = u.nice.filter((r) => !picked.includes(r));
              const ok = !missing.length;
              return (
                <div key={u.name} className={cx("rounded-lg border p-3", ok ? "border-emerald-300 bg-emerald-50" : "border-slate-200")}>
                  <div className="flex items-center justify-between">
                    <div><span className="text-sm font-semibold">{u.name}</span> <span className="text-xs text-slate-500">· {u.team}</span></div>
                    {ok ? <Pill color="green">Can build</Pill> : <Pill color="red">Blocked</Pill>}
                  </div>
                  {!ok && <div className="mt-1 text-xs text-rose-700">Needs: {missing.map(name).join(", ")}</div>}
                  {ok && nice.length > 0 && <div className="mt-1 text-xs text-amber-700">⚠ Can ship, but without {nice.map(name).join(", ")}: risky in production</div>}
                </div>
              );
            })}
          </div>
        </Card>
        {!picked.includes("sec") && picked.length > 3 && <Callout tone="bad" title="No Security & Governance">Agents with tools and customer-facing bots can&apos;t pass a security review.</Callout>}
        {!picked.includes("obs") && picked.length > 3 && <Callout tone="warn" title="No Observability">You won&apos;t know what any of these apps cost or why they fail.</Callout>}
        {BUDGET === 6 && picked.length === 6 && <Callout tone="info" title="Year 1 budget spent">The 5 use cases need 9 distinct components, so with 6 you can unblock at most 3 teams. Which 3 did you choose, and why? That is a platform roadmap decision.</Callout>}
        {unblocked === USECASES.length && <Callout tone="ok" title="All 5 teams unblocked">This is the core of an Enterprise AI Platform. Every new team now starts at 80% done.</Callout>}
      </div>
    </div>
  );
}
