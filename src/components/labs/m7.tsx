"use client";
import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useApp } from "@/lib/store";
import { ArchCanvas, PaletteItem, Requirement, Solution } from "@/components/shared/ArchCanvas";
import { Btn, Card, cx, TextArea } from "@/components/ui";

const PALETTE: PaletteItem[] = [
  { type: "apps", label: "AI Applications (100+)", group: "Consumers", color: "#334155" },
  { type: "portal", label: "Developer Portal / SDK", group: "Consumers", color: "#475569" },
  { type: "gateway", label: "AI Gateway", group: "Entry", color: "#2563eb" },
  { type: "iam", label: "Identity & Access (IAM)", group: "Entry", color: "#e11d48" },
  { type: "guard", label: "Guardrails", group: "Entry", color: "#be123c" },
  { type: "router", label: "Model Router", group: "Model layer", color: "#7c3aed" },
  { type: "modelreg", label: "Model Registry", group: "Model layer", color: "#6d28d9" },
  { type: "provA", label: "LLM Provider A", group: "Model layer", color: "#8b5cf6" },
  { type: "provB", label: "LLM Provider B", group: "Model layer", color: "#a78bfa" },
  { type: "selfhost", label: "Self-hosted models", group: "Model layer", color: "#9333ea" },
  { type: "ingest", label: "Document Ingestion", group: "Knowledge layer", color: "#059669" },
  { type: "vectordb", label: "Vector DB", group: "Knowledge layer", color: "#0d9488" },
  { type: "retrieval", label: "Retrieval API", group: "Knowledge layer", color: "#0f766e" },
  { type: "agent", label: "Agent Runtime", group: "Agent layer", color: "#0891b2" },
  { type: "tools", label: "Tool Registry / MCP", group: "Agent layer", color: "#0e7490" },
  { type: "orch", label: "Workflow Orchestration", group: "Agent layer", color: "#155e75" },
  { type: "prompts", label: "Prompt Registry", group: "Platform services", color: "#4f46e5" },
  { type: "eval", label: "Evaluation Service", group: "Platform services", color: "#d97706" },
  { type: "obs", label: "Observability & Tracing", group: "Platform services", color: "#ea580c" },
  { type: "cost", label: "Cost Management", group: "Platform services", color: "#c2410c" },
  { type: "gov", label: "Governance & Policy", group: "Platform services", color: "#b91c1c" },
  { type: "audit", label: "Audit Log", group: "Platform services", color: "#991b1b" },
  { type: "data", label: "Enterprise Data (HRIS, CRM, Docs)", group: "Foundation", color: "#64748b" },
  { type: "k8s", label: "Cloud / Kubernetes", group: "Foundation", color: "#1e293b" },
];

const either = (g: Parameters<Requirement["check"]>[0], a: string, bs: string[]) => bs.some((b) => g.edge(a, b));

const REQS: Requirement[] = [
  { id: "apps", label: "100+ AI applications onboard self-service", hint: "Apps → Gateway, plus a Developer Portal/SDK", check: (g) => g.edge("apps", "gateway") && g.has("portal") },
  { id: "multi", label: "Multiple LLM providers", hint: "Gateway/Router → Provider A and Provider B (or self-hosted)", check: (g) => [either(g, "provA", ["router", "gateway"]), either(g, "provB", ["router", "gateway"]), either(g, "selfhost", ["router", "gateway"])].filter(Boolean).length >= 2 },
  { id: "rag", label: "RAG applications", hint: "Ingestion → Vector DB → Retrieval API, exposed via the Gateway or Agent", check: (g) => g.edge("ingest", "vectordb") && g.edge("retrieval", "vectordb") && either(g, "retrieval", ["gateway", "agent", "router"]) },
  { id: "agent", label: "Agentic AI applications", hint: "Agent Runtime ↔ Tool Registry, Agent reachable from the Gateway", check: (g) => g.edge("agent", "tools") && either(g, "agent", ["gateway", "orch"]) },
  { id: "data", label: "Internal enterprise data", hint: "Enterprise Data → Ingestion or Tool Registry", check: (g) => either(g, "data", ["ingest", "tools"]) },
  { id: "mon", label: "Production monitoring", hint: "Observability connected to the Gateway", check: (g) => either(g, "obs", ["gateway", "agent"]) },
  { id: "eval", label: "AI evaluation", hint: "Evaluation service connected to Observability or the Gateway", check: (g) => either(g, "eval", ["obs", "gateway", "prompts"]) },
  { id: "sec", label: "Security", hint: "IAM + Guardrails attached to the Gateway", check: (g) => g.edge("iam", "gateway") && either(g, "guard", ["gateway", "agent"]) },
  { id: "cost", label: "Cost governance", hint: "Cost Management fed by the Gateway/Observability + a Governance node", check: (g) => either(g, "cost", ["gateway", "obs"]) && g.has("gov") },
  { id: "infra", label: "Runs on Cloud / Kubernetes", hint: "Connect K8s to the platform services or self-hosted models", check: (g) => g.has("k8s") && either(g, "k8s", ["gateway", "selfhost", "vectordb", "agent", "obs"]) },
];

const SOLUTION: Solution = {
  nodes: [
    { type: "apps", x: 300, y: -40 }, { type: "portal", x: 60, y: -40 }, { type: "gateway", x: 300, y: 70 }, { type: "iam", x: 60, y: 70 }, { type: "guard", x: 540, y: 70 },
    { type: "router", x: 60, y: 200 }, { type: "provA", x: -120, y: 300 }, { type: "provB", x: 60, y: 300 }, { type: "selfhost", x: 240, y: 300 },
    { type: "retrieval", x: 330, y: 200 }, { type: "vectordb", x: 420, y: 300 }, { type: "ingest", x: 600, y: 300 }, { type: "data", x: 780, y: 300 },
    { type: "agent", x: 580, y: 200 }, { type: "tools", x: 780, y: 200 },
    { type: "obs", x: 900, y: 70 }, { type: "eval", x: 1100, y: 0 }, { type: "cost", x: 1100, y: 110 }, { type: "gov", x: 900, y: -40 }, { type: "k8s", x: 300, y: 420 },
  ],
  edges: [[1, 0], [0, 2], [2, 3], [2, 4], [2, 5], [5, 6], [5, 7], [5, 8], [2, 9], [9, 10], [11, 10], [12, 11], [2, 13], [13, 14], [14, 12], [2, 15], [15, 16], [15, 17], [15, 18], [8, 19], [10, 19]],
};

export function Capstone() {
  const { team } = useApp();
  const [phase, setPhase] = useState<"design" | "present">("design");
  const [left, setLeft] = useState(12 * 60);
  const [run, setRun] = useState(false);
  const [notes, setNotes] = useState({ first90: "", spof: "", buildbuy: "" });

  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [run]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
        <div className="text-sm font-semibold text-indigo-900">Team: {team || <span className="font-normal italic">set your team name on the Session map</span>}</div>
        <div className="ml-auto flex items-center gap-2">
          {(["design", "present"] as const).map((p) => <Btn key={p} size="sm" variant={phase === p ? "primary" : "secondary"} onClick={() => { setPhase(p); setLeft(p === "design" ? 12 * 60 : 2 * 60); setRun(false); }}>{p === "design" ? "Design · 12 min" : "Present · 2 min"}</Btn>)}
          <span className={cx("font-mono text-2xl font-bold tabular-nums", left < 60 ? "text-rose-600" : "text-indigo-900")}>{mm}:{ss}</span>
          <Btn size="sm" variant="secondary" onClick={() => setRun(!run)}>{run ? <Pause size={13} /> : <Play size={13} />}</Btn>
          <Btn size="sm" variant="ghost" onClick={() => { setRun(false); setLeft(phase === "design" ? 720 : 120); }}><RotateCcw size={13} /></Btn>
        </div>
      </div>
      <ArchCanvas palette={PALETTE} requirements={REQS} solution={SOLUTION} storageKey="arch.capstone" height={600} />
      <div className="grid gap-3 md:grid-cols-3">
        {([["first90", "What do you build in the first 90 days, and why?"], ["spof", "Single point of failure and its mitigation"], ["buildbuy", "Build vs buy: which components do you buy?"]] as const).map(([k, label]) => (
          <Card key={k} title={label}><TextArea value={notes[k]} onChange={(v) => setNotes({ ...notes, [k]: v })} rows={4} /></Card>
        ))}
      </div>
    </div>
  );
}
