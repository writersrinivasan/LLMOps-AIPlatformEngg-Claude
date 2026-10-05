"use client";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Ban, Bot, CircleDollarSign, FileText, Loader2, Paperclip, PauseCircle, Play, Plug, RotateCcw, ScanSearch, ShieldCheck, Sparkles, TriangleAlert, Zap } from "lucide-react";
import { cx } from "@/components/ui";
import { useApp } from "@/lib/store";
import { Claim, inr, LINE_STYLE, NodeId, NODES, SAMPLE_CLAIMS } from "@/lib/showcase/data";
import { ClaimInsights, detectLine, runClaim, scanInjection, scanPii, Step } from "@/lib/showcase/engine";
import { AgentMesh, MeshSource } from "./AgentMesh";
import { Gauge, GlowBtn, ModChip, Panel, Tag } from "./ui";

const NODE = Object.fromEntries(NODES.map((n) => [n.id, n]));
const PREV: Partial<Record<NodeId, NodeId[]>> = {
  gateway: ["channels"], guardIn: ["gateway"], supervisor: ["guardIn"],
  intake: ["supervisor"], vision: ["supervisor"], coverage: ["supervisor"], fraud: ["supervisor"],
  settlement: ["intake", "vision", "coverage", "fraud"], human: ["settlement"], comms: ["settlement"], guardOut: ["comms"], judge: ["guardOut"],
};

/** Particle source for the studio mesh: agents "hand off" to each other as steps start. */
class StudioBus implements MeshSource {
  particles: MeshSource["particles"] = [];
  nodeHits: MeshSource["nodeHits"] = {};
  private pid = 0;
  fire(from: NodeId, to: NodeId, color: string) {
    const t0 = Date.now();
    this.particles = [...this.particles.filter((p) => t0 - p.t0 < 1500), { id: this.pid++, from, to, t0, dur: 650, color, size: 5 }];
    this.nodeHits[to] = t0 + 650;
  }
  reset() { this.particles = []; this.nodeHits = {}; }
}
const nowMs = () => Date.now();

interface Approval { claim: Claim; payable: number; insights: ClaimInsights; resolve: (ok: boolean) => void }

export function ClaimStudio() {
  const { settings, isLive } = useApp();
  const [claim, setClaim] = useState<Claim>(SAMPLE_CLAIMS[0]);
  const [custom, setCustom] = useState({ text: "My scooter skidded on a wet road near Koramangala and the front fork and headlight are broken. Garage estimate attached.", amount: 24000 });
  const [isCustom, setIsCustom] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [ins, setIns] = useState<ClaimInsights>({});
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [wall, setWall] = useState<{ start: number; end?: number }>({ start: 0 });
  const [confetti, setConfetti] = useState<{ id: number; left: number; delay: number; color: string; rot: number }[]>([]);
  const [bus] = useState(() => new StudioBus());
  const seen = useRef(new Set<string>());
  const runId = useRef(0);

  const active = new Set<NodeId>(steps.map((s) => s.agent));
  if (steps.length) active.add("channels");
  if (done) active.add("customer");

  const fire = (from: NodeId, to: NodeId, color: string) => bus.fire(from, to, color);

  const pick = (c: Claim) => { if (!running) { setIsCustom(false); setClaim(c); reset(); } };
  const reset = () => { setSteps([]); setIns({}); setDone(false); seen.current = new Set(); bus.reset(); setConfetti([]); };

  const run = async () => {
    const c: Claim = isCustom
      ? { id: "CLM-YOURS", customer: "You (live demo)", policyNo: "DEMO-0001", line: detectLine(custom.text), channel: "Web", title: "Your claim", text: custom.text, amount: custom.amount, attachments: ["photo_1.jpg", "estimate.pdf"], priorClaims: 0, hoursToReport: 6 }
      : claim;
    reset();
    const my = ++runId.current;
    setRunning(true);
    setWall({ start: nowMs() });
    const color = LINE_STYLE[c.line].hex;
    await runClaim({
      claim: c, live: isLive, settings, speed,
      onUpdate: (u) => {
        if (my !== runId.current) return;
        for (const s of u.steps) {
          if (!seen.current.has(s.id)) {
            seen.current.add(s.id);
            let prev = PREV[s.agent] ?? [];
            if (s.agent === "comms" && u.steps.some((x) => x.agent === "human")) prev = ["human"];
            if (s.agent === "settlement" && u.steps.filter((x) => x.agent === "settlement").length > 1) prev = [];
            prev.forEach((p) => fire(p, s.agent, s.status === "blocked" ? "#f43f5e" : color));
            if (s.agent === "coverage") setTimeout(() => fire("coverage", "vector", "#34d399"), 300);
            if (s.agent === "fraud" || s.agent === "supervisor") setTimeout(() => fire(s.agent, "mcp", "#38bdf8"), 300);
          }
        }
        setSteps(u.steps);
        setIns(u.insights);
      },
      onApproval: (ctx) => new Promise<boolean>((resolve) => setApproval({ ...ctx, resolve })),
    });
    if (my !== runId.current) return;
    fire("guardOut", "customer", "#4ade80");
    setRunning(false);
    setDone(true);
    setWall((w) => ({ ...w, end: nowMs() }));
  };

  // celebrate a paid claim
  const decision = ins.settlement?.decision;
  useEffect(() => {
    if (!done || !(decision === "AUTO_SETTLED" || decision === "ADJUSTER_APPROVED")) return;
    const colors = ["#22d3ee", "#f472b6", "#fbbf24", "#a3e635", "#a78bfa", "#4ade80"];
    const t = setTimeout(() => setConfetti(Array.from({ length: 70 }, (_, i) => ({ id: i, left: Math.random() * 100, delay: Math.random() * 0.6, color: colors[i % colors.length], rot: Math.random() * 360 }))), 50);
    const t2 = setTimeout(() => setConfetti([]), 4200);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [done, decision]);

  const totals = {
    cost: steps.reduce((a, s) => a + (s.cost ?? 0), 0),
    tokens: steps.reduce((a, s) => a + (s.tokensIn ?? 0) + (s.tokensOut ?? 0), 0),
    llm: steps.filter((s) => s.model && s.tokensIn).length,
    tools: steps.reduce((a, s) => a + (s.tools?.length ?? 0), 0),
  };
  const viewClaim = isCustom ? null : claim;
  const seq = steps.filter((s) => s.group !== "parallel");
  const par = steps.filter((s) => s.group === "parallel");
  const beforePar = seq.filter((s) => ["gateway", "guardIn", "supervisor"].includes(s.agent));
  const afterPar = seq.filter((s) => !["gateway", "guardIn", "supervisor"].includes(s.agent));

  return (
    <div className="relative space-y-4">
      {confetti.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {confetti.map((c) => (
            <span key={c.id} className="confetti" style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, background: c.color, transform: `rotate(${c.rot}deg)` }} />
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[330px_1fr_370px]">
        {/* ---------- left: claim inbox ---------- */}
        <div className="space-y-4">
          <Panel title="Claims inbox" icon={<FileText size={15} />} modules={["m1"]}>
            <div className="space-y-2">
              {SAMPLE_CLAIMS.map((c) => {
                const sel = !isCustom && claim.id === c.id;
                const l = LINE_STYLE[c.line];
                return (
                  <button key={c.id} type="button" onClick={() => pick(c)} disabled={running}
                    className={cx("w-full rounded-xl border p-2.5 text-left transition disabled:cursor-not-allowed", sel ? "bg-white/[0.08]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06]")}
                    style={sel ? { borderColor: l.hex, boxShadow: `0 0 18px ${l.hex}40` } : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{l.emoji}</span>
                      <span className="flex-1 truncate text-sm font-semibold text-slate-100">{c.title}</span>
                      <span className="font-mono text-xs" style={{ color: l.hex }}>{inr(c.amount)}</span>
                    </div>
                    <div className="mt-0.5 pl-7 text-[11px] text-slate-500">{c.id} · {c.channel} · {c.customer}</div>
                  </button>
                );
              })}
              <button type="button" disabled={running} onClick={() => { setIsCustom(true); reset(); }}
                className={cx("w-full rounded-xl border border-dashed p-2.5 text-left text-sm font-semibold transition", isCustom ? "border-fuchsia-400 bg-fuchsia-500/10 text-fuchsia-200" : "border-white/20 text-slate-400 hover:text-slate-200")}>
                ✍️ Write your own claim (let the room try)
              </button>
            </div>
          </Panel>

          <Panel title="First notice of loss" icon={<Paperclip size={15} />} modules={["m5"]}>
            {viewClaim ? (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-1 text-slate-400">
                  <span>Policy <b className="text-slate-200">{viewClaim.policyNo}</b></span>
                  <span>Line <b style={{ color: LINE_STYLE[viewClaim.line].hex }}>{LINE_STYLE[viewClaim.line].label}</b></span>
                  <span>Reported <b className="text-slate-200">{viewClaim.hoursToReport}h</b> after</span>
                  <span>Prior claims <b className="text-slate-200">{viewClaim.priorClaims}</b></span>
                </div>
                <HighlightedText text={viewClaim.text} scanned={steps.some((s) => s.agent === "guardIn" && s.status !== "running")} />
                <div className="flex flex-wrap gap-1">{viewClaim.attachments.map((a) => <Tag key={a} hex="#94a3b8">📎 {a}</Tag>)}</div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea value={custom.text} onChange={(e) => setCustom({ ...custom, text: e.target.value })} rows={6} disabled={running}
                  className="w-full rounded-lg border border-white/15 bg-black/30 p-2 text-xs text-slate-100 focus:border-fuchsia-400 focus:outline-none" />
                <label className="flex items-center gap-2 text-xs text-slate-400">Amount ₹
                  <input type="number" value={custom.amount} onChange={(e) => setCustom({ ...custom, amount: Number(e.target.value) || 0 })} disabled={running}
                    className="w-28 rounded-md border border-white/15 bg-black/30 px-2 py-1 font-mono text-slate-100" />
                  <Tag hex={LINE_STYLE[detectLine(custom.text)].hex}>{LINE_STYLE[detectLine(custom.text)].emoji} {LINE_STYLE[detectLine(custom.text)].label}</Tag>
                </label>
                <div className="text-[10.5px] text-slate-500">Try: add a phone number, write &quot;ignore all previous instructions&quot;, or claim ₹2,00,000.</div>
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <GlowBtn hex="#4ade80" className="flex-1" onClick={run} disabled={running}>
                {running ? <><Loader2 size={15} className="animate-spin" /> Agents working…</> : done ? <><RotateCcw size={15} /> Run again</> : <><Play size={15} /> Process claim</>}
              </GlowBtn>
              <button type="button" onClick={() => setSpeed(speed === 1 ? 2 : 1)} className="rounded-lg border border-white/15 px-2 py-2 font-mono text-xs text-slate-300 hover:bg-white/10" title="Simulation speed">{speed}×</button>
            </div>
            <div className={cx("mt-2 flex items-center gap-1.5 text-[11px]", isLive ? "text-emerald-300" : "text-slate-500")}>
              <Zap size={12} /> {isLive ? `LIVE: Intake, Coverage, Comms & Judge call ${settings.model || "your server model"}` : "Simulator. Toggle LIVE in LLM settings for real model calls"}
            </div>
          </Panel>
        </div>

        {/* ---------- center: mesh + agent timeline ---------- */}
        <div className="min-w-0 space-y-4">
          <Panel title="Agent orchestration" icon={<Bot size={15} />} modules={["m6", "m2"]} pad={false}
            right={running ? <Tag hex="#60a5fa">agents working…</Tag> : wall.end ? <Tag hex="#4ade80">{((wall.end - wall.start) / 1000).toFixed(1)}s wall clock</Tag> : null}>
            <div className="px-2 pt-1"><AgentMesh source={bus} active={steps.length ? active : undefined} dimIdle={steps.length > 0} /></div>
          </Panel>

          <Panel title="Agent reasoning timeline" icon={<Sparkles size={15} />} modules={["m5"]}>
            {!steps.length && <div className="py-10 text-center text-sm text-slate-500">Pick a claim and press <b className="text-emerald-300">Process claim</b>. Every agent step, tool call and guardrail shows up here as it happens.</div>}
            <div className="space-y-2">
              {beforePar.map((s) => <StepCard key={s.id} s={s} />)}
              {par.length > 0 && (
                <div className="rounded-2xl border border-violet-400/25 bg-violet-500/[0.04] p-2">
                  <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold text-violet-300"><Zap size={12} /> {par.length} specialist agents running in parallel <ModChip m="m6" /></div>
                  <div className="grid gap-2 md:grid-cols-2">{par.map((s) => <StepCard key={s.id} s={s} compact />)}</div>
                </div>
              )}
              {afterPar.map((s) => <StepCard key={s.id} s={s} />)}
            </div>
          </Panel>
        </div>

        {/* ---------- right: insights ---------- */}
        <div className="space-y-4">
          <DecisionCard ins={ins} done={done} seconds={wall.end ? (wall.end - wall.start) / 1000 : 0} />

          {ins.route && (
            <Panel title="Gateway routing" icon={<Plug size={14} />} modules={["m2"]}>
              <div className="flex items-center gap-3 text-xs">
                <Gauge value={ins.route.complexity} color="#60a5fa" size={70} label="complexity" />
                <div className="flex-1 space-y-1 text-slate-300">
                  <div>→ <b className="font-mono text-sky-300">{ins.route.model}</b></div>
                  <div className="text-[11px] text-slate-400">{ins.route.reason}</div>
                  <div><Tag hex={ins.route.cache.hit ? "#4ade80" : "#94a3b8"}>semantic cache {ins.route.cache.hit ? "HIT" : "miss"} · {ins.route.cache.similarity.toFixed(2)}</Tag></div>
                </div>
              </div>
            </Panel>
          )}

          {ins.retrieval && (
            <Panel title="Retrieved policy clauses" icon={<ScanSearch size={14} />} modules={["m2"]} right={<Tag hex="#34d399">hybrid + rerank</Tag>}>
              <div className="space-y-2">
                {ins.retrieval.map((r, i) => (
                  <div key={r.clause.id} className="rounded-lg border border-emerald-300/15 bg-emerald-400/[0.04] p-2 text-[11px] animate-[fadeUp_.4s_ease]" style={{ animationDelay: `${i * 120}ms`, animationFillMode: "backwards" }}>
                    <div className="flex items-center justify-between"><b className="font-mono text-emerald-300">{r.clause.id}</b><span className="text-slate-400">{r.clause.title}</span></div>
                    <div className="mt-1 h-1 overflow-hidden rounded bg-white/5"><div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: `${r.reranked * 100}%` }} /></div>
                    <div className="mt-1 text-slate-300">{r.clause.text}</div>
                    <div className="mt-0.5 text-right font-mono text-[10px] text-slate-500">sim {r.score.toFixed(2)} → rerank {r.reranked.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {ins.estimate && (
            <Panel title="Damage assessment" icon={<CircleDollarSign size={14} />} modules={["m6"]}>
              <table className="w-full text-[11px]">
                <tbody>
                  {ins.estimate.map((i) => (
                    <tr key={i.label} className="border-b border-white/5 align-top">
                      <td className="py-1 pr-2 text-slate-300">{i.label}{i.why && <div className="text-[10px] text-amber-300">{i.why}</div>}</td>
                      <td className="py-1 text-right font-mono text-slate-500 line-through decoration-rose-400/60">{i.allowed !== i.claimed ? inr(i.claimed) : ""}</td>
                      <td className="py-1 pl-2 text-right font-mono text-slate-100">{inr(i.allowed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          {ins.fraud && (
            <Panel title="Fraud signals" icon={<TriangleAlert size={14} />} modules={["m5", "m6"]}>
              <div className="flex items-center gap-3">
                <Gauge value={ins.fraud.score} size={78} color={ins.fraud.score >= 0.7 ? "#f43f5e" : ins.fraud.score >= 0.4 ? "#fbbf24" : "#4ade80"} label="risk" />
                <ul className="flex-1 space-y-1 text-[11px]">
                  {ins.fraud.signals.map((s) => (
                    <li key={s.label} className="flex justify-between gap-2 text-slate-300"><span>{s.label}</span><span className="font-mono text-slate-500">+{s.weight.toFixed(2)}</span></li>
                  ))}
                </ul>
              </div>
            </Panel>
          )}

          {ins.judge && (
            <Panel title="LLM-as-judge (online eval)" icon={<BadgeCheck size={14} />} modules={["m4"]}>
              <div className="grid grid-cols-4 gap-1">
                <Gauge value={ins.judge.faithfulness} size={64} color="#fbbf24" label="faithful" />
                <Gauge value={ins.judge.groundedness} size={64} color="#22d3ee" label="grounded" />
                <Gauge value={ins.judge.policyCompliance} size={64} color="#a78bfa" label="policy" />
                <Gauge value={ins.judge.tone} size={64} color="#f472b6" label="tone" />
              </div>
              {ins.judge.verdict && <div className="mt-2 text-[11px] italic text-slate-400">&ldquo;{ins.judge.verdict}&rdquo;</div>}
            </Panel>
          )}

          {ins.letter && (
            <Panel title="Message to customer" icon={<ShieldCheck size={14} />} modules={["m5"]} right={<Tag hex="#4ade80">passed output guard</Tag>}>
              <div className="rounded-2xl rounded-tl-sm bg-emerald-900/40 p-3 text-xs leading-relaxed text-emerald-50 shadow-inner">{ins.letter}<div className="mt-1 text-right text-[10px] text-emerald-300/70">✓✓ WhatsApp</div></div>
            </Panel>
          )}
        </div>
      </div>

      {steps.length > 0 && (
        <Panel title="Distributed trace" icon={<Sparkles size={15} />} modules={["m5"]}
          right={<span className="flex gap-2 font-mono text-[11px] text-slate-400"><span>{totals.llm} LLM calls</span><span>{totals.tools} tool calls</span><span>{totals.tokens.toLocaleString()} tokens</span><span className="text-emerald-300">${totals.cost.toFixed(4)} ≈ ₹{(totals.cost * 84).toFixed(2)}</span></span>}>
          <Waterfall steps={steps} />
        </Panel>
      )}

      {approval && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg animate-[fadeUp_.3s_ease] rounded-3xl border border-amber-300/40 bg-[#0d1428] p-6 shadow-[0_0_60px_rgba(251,191,36,.25)]">
            <div className="flex items-center gap-2 text-amber-300"><PauseCircle size={20} /><span className="text-xs font-bold uppercase tracking-widest">Agent paused · human-in-the-loop</span><ModChip m="m5" className="ml-auto" /></div>
            <h3 className="mt-2 text-xl font-bold text-white">Approve payout of {inr(approval.payable)}?</h3>
            <p className="mt-1 text-sm text-slate-400">{approval.claim.id} · {approval.claim.customer}. The amount is above the agent&apos;s ₹50,000 authority (AUTH-2.0), so <span className="font-mono text-amber-200">payments.initiate_payout</span> needs a licensed adjuster.</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400">Assessed</div><div className="font-bold text-white">{inr(approval.insights.settlement?.assessed ?? 0)}</div></div>
              <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400">Coverage</div><div className="font-bold text-emerald-300">{approval.insights.coverage?.clauses[0] ?? "-"}</div></div>
              <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400">Fraud risk</div><div className="font-bold text-emerald-300">{approval.insights.fraud?.score.toFixed(2)}</div></div>
            </div>
            <div className="mt-3 rounded-xl bg-white/5 p-2 text-[11px] text-slate-300">{approval.insights.coverage?.reasoning}</div>
            <div className="mt-5 flex gap-3">
              <GlowBtn hex="#4ade80" className="flex-1" onClick={() => { approval.resolve(true); setApproval(null); }}><BadgeCheck size={16} /> Approve payout</GlowBtn>
              <GlowBtn hex="#f43f5e" className="flex-1" onClick={() => { approval.resolve(false); setApproval(null); }}><Ban size={16} /> Ask for documents</GlowBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HighlightedText({ text, scanned }: { text: string; scanned: boolean }) {
  if (!scanned) return <p className="rounded-lg bg-black/30 p-2 leading-relaxed text-slate-200">{text}</p>;
  const inj = scanInjection(text);
  const pii = scanPii(text);
  // build segments: injected sentence struck through, PII masked
  let html = text;
  for (const p of pii.found) html = html.replace(p.value, `\u0001${p.kind}\u0002`);
  if (inj.found && inj.snippet) html = html.replace(inj.snippet, `\u0003${inj.snippet}\u0004`);
  const parts = html.split(/(\u0001[A-Z]+\u0002|\u0003[\s\S]*?\u0004)/);
  return (
    <p className="rounded-lg bg-black/30 p-2 leading-relaxed text-slate-200">
      {parts.map((p, i) =>
        p.startsWith("\u0001") ? <span key={i} className="mx-0.5 rounded bg-rose-500/25 px-1 font-mono text-[10px] font-bold text-rose-200">[{p.slice(1, -1)}]</span>
          : p.startsWith("\u0003") ? <span key={i} className="rounded bg-rose-600/20 text-rose-300 line-through decoration-2" title="Quarantined by input guard">{p.slice(1, -1)}</span>
            : <span key={i}>{p}</span>,
      )}
    </p>
  );
}

function useTyped(text: string, on: boolean) {
  const [n, setN] = useState(on ? 0 : text.length);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 3)), 16);
    return () => clearInterval(id);
  }, [text, on]);
  return on ? text.slice(0, n) : text;
}

const STATUS: Record<Step["status"], { hex: string; label: string }> = {
  running: { hex: "#60a5fa", label: "running" },
  ok: { hex: "#4ade80", label: "done" },
  warn: { hex: "#fbbf24", label: "flagged" },
  blocked: { hex: "#f43f5e", label: "blocked" },
  waiting: { hex: "#fde68a", label: "waiting for human" },
};

function StepCard({ s, compact }: { s: Step; compact?: boolean }) {
  const n = NODE[s.agent];
  const st = STATUS[s.status];
  const thought = useTyped(s.thought, true);
  return (
    <div className="animate-[fadeUp_.35s_ease] rounded-xl border bg-black/20 p-2.5" style={{ borderColor: n.hex + "40" }}>
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base" style={{ background: n.hex + "22", boxShadow: s.status === "running" ? `0 0 14px ${n.hex}` : undefined }}>{n.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-semibold text-slate-100">{s.title}</span>
            <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ color: st.hex, background: st.hex + "1f" }}>
              {s.status === "running" && <Loader2 size={10} className="animate-spin" />}{st.label}
            </span>
            {s.live && <Tag hex="#4ade80">⚡ LIVE</Tag>}
          </div>
          <div className="mt-0.5 text-[11.5px] italic text-slate-400">💭 {thought}</div>
          {s.tools && s.tools.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{s.tools.map((t) => <Tag key={t} hex="#38bdf8">🔌 {t}</Tag>)}</div>}
          {s.output && <pre className={cx("mt-1.5 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2 font-mono text-[10.5px] leading-snug text-slate-200", compact ? "max-h-28" : "max-h-40")}>{s.output}</pre>}
          {s.note && <div className="mt-1 rounded-md bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">{s.note}</div>}
          {s.status !== "running" && (
            <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-slate-500">
              {s.model && <span>{s.model}</span>}
              <span>{Math.round(s.end - s.start)} ms</span>
              {s.tokensIn ? <span>{s.tokensIn}→{s.tokensOut} tok</span> : null}
              {s.cost ? <span>${s.cost.toFixed(5)}</span> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Waterfall({ steps }: { steps: Step[] }) {
  const total = Math.max(1, ...steps.map((s) => s.end));
  return (
    <div className="space-y-1">
      {steps.map((s) => {
        const n = NODE[s.agent];
        return (
          <div key={s.id} className="grid grid-cols-[200px_1fr_70px] items-center gap-2 text-[11px]">
            <span className={cx("truncate", s.group && "pl-3")} style={{ color: n.hex }}>{n.icon} {s.title.split(":")[0]}</span>
            <span className="relative h-3.5 rounded bg-white/[0.03]">
              <span className={cx("absolute top-0.5 h-2.5 rounded-sm", s.status === "running" && "animate-pulse")}
                style={{ left: `${(s.start / total) * 100}%`, width: `${Math.max(0.8, ((s.end - s.start) / total) * 100)}%`, background: s.status === "blocked" ? "#f43f5e" : n.hex, boxShadow: `0 0 8px ${n.hex}88` }} />
            </span>
            <span className="text-right font-mono text-slate-500">{s.status === "running" ? "…" : `${Math.round(s.end - s.start)}ms`}</span>
          </div>
        );
      })}
    </div>
  );
}

function DecisionCard({ ins, done, seconds }: { ins: ClaimInsights; done: boolean; seconds: number }) {
  const s = ins.settlement;
  if (!s) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-5 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Decision</div>
        <div className="mt-2 text-sm text-slate-400">Waiting for the agents…</div>
      </div>
    );
  }
  const cfg = {
    AUTO_SETTLED: { title: "Approved & paid", hex: "#4ade80", emoji: "🎉", from: "from-emerald-500/30", sub: "Straight-through. No human needed" },
    ADJUSTER_APPROVED: { title: done ? "Approved by adjuster" : "Awaiting adjuster", hex: done ? "#4ade80" : "#fbbf24", emoji: done ? "🎉" : "⏳", from: done ? "from-emerald-500/30" : "from-amber-500/30", sub: "Agent prepared, human decided" },
    ADJUSTER_REJECTED: { title: "More documents needed", hex: "#fbbf24", emoji: "📄", from: "from-amber-500/30", sub: "Human overrode the agent" },
    SIU_REFERRAL: { title: "Referred to SIU", hex: "#f43f5e", emoji: "🛡️", from: "from-rose-500/30", sub: "Attack neutralised · ₹0 auto-paid" },
  }[s.decision];
  return (
    <div className={cx("relative overflow-hidden rounded-2xl border bg-gradient-to-br to-transparent p-5", cfg.from)} style={{ borderColor: cfg.hex + "66", boxShadow: `0 0 40px ${cfg.hex}30` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: cfg.hex }}>Decision</span>
        <ModChip m="m7" />
      </div>
      <div className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-white"><span>{cfg.emoji}</span>{cfg.title}</div>
      <div className="mt-1 text-3xl font-black tabular-nums" style={{ color: cfg.hex, textShadow: `0 0 20px ${cfg.hex}88` }}>{inr(s.payable)}</div>
      <div className="mt-1 text-xs text-slate-300">{cfg.sub}{done && seconds > 0 ? ` · decided in ${seconds.toFixed(1)}s` : ""}</div>
      <div className="mt-2 text-[11px] text-slate-400">{s.authority}</div>
      {s.deductible > 0 && <div className="text-[11px] text-slate-500">Assessed {inr(s.assessed)} − deductible {inr(s.deductible)}</div>}
    </div>
  );
}
