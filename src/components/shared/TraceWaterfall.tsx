"use client";
import { useState } from "react";
import { Bot, Brain, Database, ShieldAlert, Wrench } from "lucide-react";
import type { Span, SpanKind } from "@/lib/agent";
import { fmtUsd } from "@/lib/sim";
import { cx, Pill } from "@/components/ui";

const KIND: Record<SpanKind, { color: string; icon: React.ReactNode; label: string }> = {
  agent: { color: "bg-slate-500", icon: <Bot size={13} />, label: "Agent" },
  llm: { color: "bg-violet-500", icon: <Brain size={13} />, label: "LLM call" },
  tool: { color: "bg-sky-500", icon: <Wrench size={13} />, label: "Tool call" },
  retrieval: { color: "bg-emerald-500", icon: <Database size={13} />, label: "Retrieval" },
  policy: { color: "bg-rose-500", icon: <ShieldAlert size={13} />, label: "Policy / guard" },
};

export function TraceWaterfall({ spans, highlight }: { spans: Span[]; highlight?: "slowest" | "costliest" | null }) {
  const [sel, setSel] = useState<string | null>(null);
  if (!spans.length) return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">Run the agent to see its trace</div>;
  const total = Math.max(1, ...spans.map((s) => s.end));
  const children = spans.filter((s) => s.kind !== "agent");
  const slowest = children.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a), children[0]);
  const costliest = children.reduce((a, b) => ((b.cost ?? 0) > (a.cost ?? 0) ? b : a), children[0]);
  const selected = spans.find((s) => s.id === sel);

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">
          {Object.entries(KIND).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className={cx("h-2 w-2 rounded-full", v.color)} />{v.label}</span>)}
          <span className="ml-auto font-mono">{(total / 1000).toFixed(2)}s total</span>
        </div>
        {spans.map((s) => {
          const k = KIND[s.kind];
          const isHi = (highlight === "slowest" && s.id === slowest?.id) || (highlight === "costliest" && s.id === costliest?.id);
          return (
            <button
              type="button"
              key={s.id}
              onClick={() => setSel(s.id)}
              className={cx("grid w-full grid-cols-[230px_1fr_90px] items-center gap-2 border-b border-slate-50 px-3 py-1.5 text-left text-xs hover:bg-slate-50", sel === s.id && "bg-indigo-50", isHi && "ring-2 ring-inset ring-amber-400")}
            >
              <span className={cx("flex items-center gap-1.5 truncate", s.parentId && "pl-4", s.status === "blocked" && "text-rose-700", s.status === "error" && "text-rose-700")}>
                <span className={cx("flex h-5 w-5 items-center justify-center rounded text-white", k.color)}>{k.icon}</span>
                <span className="truncate font-medium">{s.name}</span>
              </span>
              <span className="relative h-4 rounded bg-slate-50">
                <span className={cx("absolute top-0.5 h-3 rounded-sm opacity-90", k.color, s.status === "blocked" && "bg-[repeating-linear-gradient(45deg,#e11d48,#e11d48_3px,#fda4af_3px,#fda4af_6px)]")} style={{ left: `${(s.start / total) * 100}%`, width: `${Math.max(0.6, ((s.end - s.start) / total) * 100)}%` }} />
              </span>
              <span className="text-right font-mono text-slate-500">{s.kind === "agent" ? "" : `${Math.round(s.end - s.start)}ms`}</span>
            </button>
          );
        })}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
        {selected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{selected.name}</span>
              <Pill color={selected.status === "ok" ? "green" : "red"}>{selected.status}</Pill>
            </div>
            <div className="grid grid-cols-2 gap-1 text-slate-600">
              <span>Duration: <b>{Math.round(selected.end - selected.start)} ms</b></span>
              {selected.model && <span>Model: <b>{selected.model}</b></span>}
              {selected.tokensIn !== undefined && <span>Tokens in/out: <b>{selected.tokensIn}/{selected.tokensOut}</b></span>}
              {selected.cost !== undefined && <span>Cost: <b>{fmtUsd(selected.cost)}</b></span>}
            </div>
            {selected.note && <div className="rounded bg-amber-50 px-2 py-1 text-amber-800">{selected.note}</div>}
            {selected.input && <Block label="Input">{selected.input}</Block>}
            {selected.output && <Block label="Output">{selected.output}</Block>}
          </div>
        ) : (
          <div className="text-slate-400">Click a span to inspect its prompt, output, tokens and cost.</div>
        )}
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 font-semibold text-slate-500">{label}</div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-800">{children}</pre>
    </div>
  );
}
