"use client";
import { Building2, CheckCircle2, Coins, Layers, Plug, Server, TrendingUp } from "lucide-react";
import { Autopilot } from "@/lib/showcase/autopilot";
import { MCP_TOOLS, POOL, TENANTS } from "@/lib/showcase/data";
import { crore, useEngine } from "./CommandCenter";
import { CountUp, ModChip, Panel, Tag } from "./ui";

const RISK_HEX = { low: "#4ade80", medium: "#fbbf24", high: "#f43f5e" };

const CAPABILITIES = [
  { name: "AI Gateway", what: "routing · keys · quotas · failover · semantic cache", m: "m2" },
  { name: "Prompt registry", what: "versioned prompts, A/B tests, rollback", m: "m2" },
  { name: "RAG service", what: "ingest · chunk · embed · ACL-filtered retrieval", m: "m2" },
  { name: "Eval service", what: "golden sets, LLM-judge, CI gates, online evals", m: "m4" },
  { name: "Guardrails", what: "PII, injection, output policy, red-team corpus", m: "m5" },
  { name: "Tracing & cost", what: "OpenTelemetry spans, token & ₹ per tenant", m: "m5" },
  { name: "Agent runtime", what: "supervisor, step limits, HITL, tool policies", m: "m6" },
  { name: "Tool registry (MCP)", what: "owned, scoped, risk-rated tools", m: "m6" },
  { name: "Release pipeline", what: "BOM, gates, shadow, canary, auto-rollback", m: "m3" },
];

export function PlatformView({ engine }: { engine: Autopilot }) {
  useEngine(engine);
  const claimsHandled = engine.totals.claims;
  const manualHours = claimsHandled * 2.5;

  return (
    <div className="space-y-4">
      {/* ROI */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel title="Business impact: manual vs ClaimPilot" icon={<TrendingUp size={15} />} modules={["m1", "m7"]}>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { k: "Time to decision", before: "9.4 days", after: "< 2 min", hex: "#a78bfa" },
              { k: "Cost per claim", before: "₹1,150", after: "₹4.80", hex: "#4ade80" },
              { k: "CSAT", before: "3.6 ★", after: "4.7 ★", hex: "#fbbf24" },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl bg-white/[0.04] p-3">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{x.k}</div>
                <div className="mt-1 text-sm text-slate-500 line-through">{x.before}</div>
                <div className="text-2xl font-black" style={{ color: x.hex, textShadow: `0 0 16px ${x.hex}77` }}>{x.after}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div><div className="text-2xl font-extrabold text-cyan-300"><CountUp value={manualHours} /></div><div className="text-[11px] text-slate-400">adjuster hours freed today</div></div>
            <div><div className="text-2xl font-extrabold text-pink-300"><CountUp value={engine.totals.saved} fmt={crore} /></div><div className="text-[11px] text-slate-400">operating cost saved today</div></div>
            <div><div className="text-2xl font-extrabold text-emerald-300"><CountUp value={engine.totals.blocked + engine.totals.siu} /></div><div className="text-[11px] text-slate-400">attacks &amp; fraud stopped</div></div>
          </div>
        </Panel>

        <Panel title="FinOps: chargeback by tenant (this month)" icon={<Coins size={15} />} modules={["m5", "m6"]}>
          <div className="space-y-2.5">
            {TENANTS.map((t) => {
              const spend = engine.tenantSpend[t.id] ?? 0;
              const pct = spend / t.budget;
              return (
                <div key={t.id}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200">{t.emoji} {t.name}</span>
                    <span className="font-mono text-slate-400"><span style={{ color: pct > 0.9 ? "#f43f5e" : t.hex }}>${spend.toFixed(0)}</span> / ${t.budget}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct * 100)}%`, background: `linear-gradient(90deg, ${t.hex}88, ${t.hex})`, boxShadow: `0 0 10px ${t.hex}` }} />
                  </div>
                  <div className="mt-0.5 flex gap-2 text-[10px] text-slate-500"><span>{t.agents} agents</span><span>SLO {t.slo}%</span>{pct > 0.8 && <span className="text-amber-300">⚠ 80% budget alert sent</span>}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="MCP tool registry" icon={<Plug size={15} />} modules={["m6", "m5"]} right={<Tag hex="#38bdf8">{MCP_TOOLS.length} tools · 6 owners</Tag>}>
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="pb-1">Server · tool</th><th>Scope</th><th>Risk</th><th>Owner</th><th className="text-right">Calls</th></tr></thead>
            <tbody>
              {MCP_TOOLS.map((t) => {
                const key = `${t.server}.${t.tool}`;
                return (
                  <tr key={key} className="border-t border-white/5">
                    <td className="py-1.5 font-mono text-sky-200">{t.server}<span className="text-slate-500">.</span>{t.tool}{t.hitl && <Tag hex="#fde68a" className="ml-1">HITL</Tag>}</td>
                    <td className="text-slate-400">{t.scope}</td>
                    <td><span className="inline-flex items-center gap-1" style={{ color: RISK_HEX[t.risk] }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: RISK_HEX[t.risk] }} />{t.risk}</span></td>
                    <td className="text-slate-400">{t.owner}</td>
                    <td className="text-right font-mono text-slate-200">{(engine.toolCalls[key] ?? 0).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="Model pool behind the gateway" icon={<Server size={15} />} modules={["m2"]}>
          <div className="grid grid-cols-2 gap-2">
            {POOL.map((p) => {
              const share = engine.modelShare[p.id] ?? 0;
              const down = engine.active("outage") && p.provider === "Provider A";
              return (
                <div key={p.id} className="rounded-xl border p-2.5" style={{ borderColor: (down ? "#f43f5e" : p.hex) + "55", background: (down ? "#f43f5e" : p.hex) + "0d" }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold" style={{ color: p.hex }}>{p.id}</span>
                    <Tag hex={down ? "#f43f5e" : "#4ade80"}>{down ? "circuit open" : p.tier === "fallback" ? `fallback · ${engine.replicas} pods` : "healthy"}</Tag>
                  </div>
                  <div className="mt-1 text-[10.5px] text-slate-400">{p.provider} · ${p.inPrice}/${p.outPrice} per 1M tok</div>
                  <div className="mt-2 flex items-end justify-between">
                    <span className="text-2xl font-extrabold text-white">{Math.round(share * 100)}%</span>
                    <span className="text-[10px] text-slate-500">of live traffic</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Platform capabilities: reused by every team" icon={<Layers size={15} />} modules={["m6", "m1"]}>
          <div className="grid gap-2 sm:grid-cols-3">
            {CAPABILITIES.map((c) => (
              <div key={c.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100"><CheckCircle2 size={13} className="text-emerald-400" />{c.name}</div>
                <div className="mt-0.5 text-[10.5px] text-slate-400">{c.what}</div>
                <div className="mt-1.5"><ModChip m={c.m} /></div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Golden path: a new team ships an agent in 1 day" icon={<Building2 size={15} />} modules={["m6"]}>
          <ol className="relative space-y-3 border-l border-dashed border-cyan-400/40 pl-5 text-xs">
            {[
              ["09:00", "`aiplatform new agent --template=claims-specialist`", "repo, prompts, eval set & CI scaffolded"],
              ["10:30", "Register tools in the MCP registry", "scopes + risk + owner reviewed"],
              ["13:00", "Write 40 golden cases", "the eval service runs them on every PR"],
              ["15:00", "Gateway key + budget issued", "chargeback starts automatically"],
              ["16:30", "Shadow → canary → 100%", "traces, cost and evals on dashboards by default"],
            ].map(([t, a, b]) => (
              <li key={t} className="relative">
                <span className="absolute -left-[27px] top-0.5 h-3 w-3 rounded-full border-2 border-cyan-300 bg-[#0b1020] shadow-[0_0_8px_#22d3ee]" />
                <div className="font-mono text-[10px] text-cyan-300">{t}</div>
                <div className="font-semibold text-slate-100">{a.replace(/`/g, "")}</div>
                <div className="text-[11px] text-slate-500">{b}</div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
