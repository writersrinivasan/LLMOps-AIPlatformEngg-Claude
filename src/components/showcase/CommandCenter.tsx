"use client";
import { useSyncExternalStore } from "react";
import { Activity, BellRing, Check, Gauge as GaugeIcon, Pause, Play, Radio, ShieldAlert, Siren, UserCheck, X } from "lucide-react";
import { cx } from "@/components/ui";
import { Autopilot, INCIDENTS, IncidentId } from "@/lib/showcase/autopilot";
import { LINE_STYLE, NodeId, POOL } from "@/lib/showcase/data";
import { AgentMesh, NodeBadge } from "./AgentMesh";
import { CountUp, fmtTime, GlowBtn, ModChip, Panel, Spark, Tag } from "./ui";

const TAG_HEX: Record<string, string> = { GATEWAY: "#60a5fa", GUARD: "#fb7185", EVAL: "#fbbf24", SRE: "#a78bfa", HITL: "#fde68a", FINOPS: "#4ade80", AGENT: "#22d3ee", DEPLOY: "#34d399" };
const TONE: Record<string, string> = { info: "text-slate-300", ok: "text-emerald-300", warn: "text-amber-300", bad: "text-rose-300" };

export const crore = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : `₹${(n / 1e5).toFixed(1)} L`);

export function useEngine(engine: Autopilot) {
  return useSyncExternalStore(engine.subscribe, engine.getVersion, () => 0);
}

export function CommandCenter({ engine }: { engine: Autopilot }) {
  useEngine(engine);
  const s = engine.series;
  const last = (a: number[], d = 0) => a.at(-1) ?? d;
  const faith = last(s.faith, 0.94);
  const now = s.t.at(-1) ?? 0;

  const badges: Partial<Record<NodeId, NodeBadge>> = {};
  if (engine.active("outage")) badges.gateway = { text: "FAILOVER", hex: "#fbbf24", pulse: true };
  if (engine.active("injection")) badges.guardIn = { text: "UNDER ATTACK", hex: "#f43f5e", pulse: true };
  if (engine.canary.state === "canary") badges.coverage = { text: "CANARY v3.3", hex: "#fbbf24", pulse: true };
  if (engine.canary.state === "rolled-back") badges.coverage = { text: "ROLLED BACK ✓", hex: "#4ade80" };
  if (engine.queue.length) badges.human = { text: `${engine.queue.length} WAITING`, hex: "#fde68a", pulse: true };
  if (engine.replicas > 2) badges.supervisor = { text: `${engine.replicas} REPLICAS`, hex: "#a78bfa" };
  if (faith < 0.9) badges.judge = { text: "SLO BREACH", hex: "#f43f5e", pulse: true };
  if (engine.active("surge")) badges.channels = { text: "×4 TRAFFIC", hex: "#22d3ee", pulse: true };

  const counts: Partial<Record<NodeId, number>> = {
    customer: engine.nodeCount.customer ?? 0, judge: engine.nodeCount.judge ?? 0, guardIn: engine.nodeCount.guardIn ?? 0,
    human: engine.nodeCount.human ?? 0, mcp: engine.nodeCount.mcp ?? 0, vector: engine.nodeCount.vector ?? 0,
  };

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Claims decided today" hex="#22d3ee" value={<CountUp value={engine.totals.claims} />} sub={`${Math.round(last(s.throughput))} / min right now`} />
        <Kpi label="Straight-through rate" hex="#4ade80" value={<CountUp value={last(s.stp, 67)} fmt={(v) => v.toFixed(0) + "%"} />} sub="no human touch needed" />
        <Kpi label="Time to decision" hex="#a78bfa" value={<CountUp value={last(s.p95, 7)} fmt={(v) => v.toFixed(1) + "s"} />} sub="p95 · industry avg 9.4 days" />
        <Kpi label="Paid out today" hex="#fbbf24" value={<CountUp value={engine.totals.paidOut} fmt={crore} />} sub={`${engine.totals.autoSettled.toLocaleString("en-IN")} auto-settled`} />
        <Kpi label="Ops cost saved" hex="#f472b6" value={<CountUp value={engine.totals.saved} fmt={crore} />} sub={`₹${last(s.cost, 4.6).toFixed(2)} AI vs ₹1,150 manual`} />
        <Kpi label="Online faithfulness" hex={faith < 0.9 ? "#f43f5e" : "#fbbf24"} value={<CountUp value={faith} fmt={(v) => v.toFixed(2)} />} sub={faith < 0.9 ? "⚠ below SLO 0.90" : "LLM judge · SLO ≥ 0.90"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Panel
          title="Live agent mesh"
          icon={<Radio size={15} />}
          modules={["m2", "m6", "m7"]}
          pad={false}
          right={
            <>
              <Tag hex="#94a3b8">synthetic traffic replay</Tag>
              <label className="hidden items-center gap-2 text-[11px] text-slate-400 md:flex">
                Traffic
                <input type="range" min={10} max={120} value={engine.rate} onChange={(e) => engine.setRate(Number(e.target.value))} className="w-24" />
                <span className="w-12 font-mono text-slate-200">{engine.rate}/min</span>
              </label>
              <GlowBtn hex={engine.running ? "#fbbf24" : "#4ade80"} className="!px-2 !py-1 text-xs" onClick={() => (engine.running ? engine.stop() : engine.start())}>
                {engine.running ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Run</>}
              </GlowBtn>
            </>
          }
        >
          <div className="px-2 pt-2">
            <AgentMesh source={engine} badges={badges} counts={counts} />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-white/5 px-4 py-2 text-[11px] text-slate-400">
            {Object.values(LINE_STYLE).map((l) => (
              <span key={l.label} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: l.hex, boxShadow: `0 0 6px ${l.hex}` }} />{l.emoji} {l.label}</span>
            ))}
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />blocked / fraud</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-300" />needs adjuster</span>
            <span className="ml-auto">Every dot is a claim moving between agents.</span>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Chaos console" icon={<Siren size={15} />} modules={["m5", "m3"]}>
            <p className="mb-3 text-xs text-slate-400">Break production on purpose and watch the platform heal itself.</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(INCIDENTS) as IncidentId[]).map((id) => {
                const inc = INCIDENTS[id];
                const on = engine.active(id);
                const left = on ? Math.max(0, (engine.incidents[id]! - now) / inc.duration) : 0;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!engine.running || on}
                    onClick={() => engine.trigger(id)}
                    title={inc.desc}
                    className={cx("relative overflow-hidden rounded-xl border p-2.5 text-left transition disabled:cursor-not-allowed", on ? "border-rose-400/60 bg-rose-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.07]", !engine.running && "opacity-40")}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-100"><span className="text-lg">{inc.emoji}</span>{inc.label}</div>
                    <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-slate-400">{inc.desc}</div>
                    <div className="mt-1.5"><ModChip m={inc.module} /></div>
                    {on && <div className="absolute bottom-0 left-0 h-1 bg-rose-400 transition-all duration-1000" style={{ width: `${left * 100}%` }} />}
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Adjuster queue" icon={<UserCheck size={15} />} modules={["m5", "m6"]} right={<Tag hex="#fde68a">{engine.queue.length} waiting</Tag>}>
            {engine.queue.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-500">Claims above ₹50,000 pause here for a human (AUTH-2.0)</div>
            ) : (
              <ul className="space-y-2">
                {engine.queue.map((q) => (
                  <li key={q.id} className="flex items-center gap-2 rounded-xl border border-amber-200/20 bg-amber-200/[0.06] px-2.5 py-2 animate-[fadeUp_.4s_ease]">
                    <span className="text-lg">{LINE_STYLE[q.line].emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-100">{q.id} · {q.customer}</div>
                      <div className="text-[11px] text-slate-400">₹{q.amount.toLocaleString("en-IN")} · fraud {q.fraud.toFixed(2)}</div>
                      <div className="mt-1 h-0.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-amber-300" style={{ width: `${Math.max(0, Math.min(100, ((q.autoAt - now) / (q.autoAt - q.at)) * 100))}%` }} /></div>
                    </div>
                    <button type="button" onClick={() => engine.approve(q.id, true)} className="rounded-lg bg-emerald-500/20 p-1.5 text-emerald-300 hover:bg-emerald-500/40" title="Approve payout"><Check size={14} /></button>
                    <button type="button" onClick={() => engine.approve(q.id, false)} className="rounded-lg bg-rose-500/20 p-1.5 text-rose-300 hover:bg-rose-500/40" title="Reject"><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Throughput" unit="claims/min" color="#22d3ee" values={s.throughput} v={last(s.throughput).toFixed(0)} m="m5" />
          <Metric title="p95 latency" unit="seconds" color="#a78bfa" values={s.p95} v={last(s.p95).toFixed(1)} threshold={{ v: 12, label: "SLO" }} m="m5" />
          <Metric title="Cost per claim" unit="₹" color="#4ade80" values={s.cost} v={"₹" + last(s.cost).toFixed(2)} m="m5" />
          <Metric title="Online faithfulness" unit="LLM judge" color="#fbbf24" values={s.faith} v={faith.toFixed(2)} min={0.6} max={1} threshold={{ v: 0.9, label: "SLO" }} m="m4" />
          <Metric title="Guardrail blocks" unit="per min" color="#fb7185" values={s.blocks} v={last(s.blocks).toFixed(0)} min={0} m="m5" />
          <Metric title="Semantic cache hits" unit="%" color="#38bdf8" values={s.cache} v={last(s.cache).toFixed(0) + "%"} min={0} max={70} m="m5" />
          <Metric title="Gateway errors" unit="% 5xx to users" color="#f43f5e" values={s.errors} v={last(s.errors).toFixed(1) + "%"} min={0} max={15} m="m2" />
          <Panel title="Model routing" icon={<GaugeIcon size={14} />} modules={["m2"]} className="!rounded-xl">
            <div className="space-y-1.5">
              {POOL.map((p) => {
                const v = engine.modelShare[p.id] ?? 0;
                return (
                  <div key={p.id} className="text-[11px]">
                    <div className="flex justify-between text-slate-300"><span className="font-mono">{p.id}</span><span>{Math.round(v * 100)}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded bg-white/5"><div className="h-full rounded transition-all duration-700" style={{ width: `${v * 100}%`, background: p.hex, boxShadow: `0 0 8px ${p.hex}` }} /></div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <Panel title="Live event stream" icon={<BellRing size={15} />} modules={["m5"]} right={<span className="flex items-center gap-1 text-[10px] text-emerald-400"><Activity size={11} className="animate-pulse" />streaming</span>} pad={false}>
          <ul className="scrollbar-dark h-[300px] space-y-0.5 overflow-y-auto p-2 font-mono text-[11px]">
            {engine.feed.map((e) => (
              <li key={e.id} className="flex gap-2 rounded px-1.5 py-1 animate-[fadeUp_.35s_ease] hover:bg-white/5">
                <span className="shrink-0 text-slate-500">{fmtTime(e.at)}</span>
                <span className="w-[58px] shrink-0 font-bold" style={{ color: TAG_HEX[e.tag] }}>{e.tag}</span>
                <span className={TONE[e.tone]}>{e.text}</span>
              </li>
            ))}
            {!engine.feed.length && <li className="p-6 text-center text-slate-500"><ShieldAlert className="mx-auto mb-2" size={18} />Press Run to start production traffic</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, hex }: { label: string; value: React.ReactNode; sub: string; hex: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ background: hex + "55" }} />
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-2xl font-extrabold" style={{ color: hex, textShadow: `0 0 18px ${hex}66` }}>{value}</div>
      <div className="text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}

function Metric({ title, unit, color, values, v, min, max, threshold, m }: { title: string; unit: string; color: string; values: number[]; v: string; min?: number; max?: number; threshold?: { v: number; label: string }; m: string }) {
  return (
    <Panel modules={[m]} className="!rounded-xl" pad={false}>
      <div className="px-3 pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-300">{title}</span>
          <span className="text-lg font-bold tabular-nums" style={{ color }}>{v}</span>
        </div>
        <div className="text-[10px] text-slate-500">{unit}</div>
      </div>
      <Spark values={values.slice(-60)} color={color} min={min} max={max} threshold={threshold} />
    </Panel>
  );
}
