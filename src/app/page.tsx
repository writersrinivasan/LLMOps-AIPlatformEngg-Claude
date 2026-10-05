"use client";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Hand, Layers, Rocket, Users, Zap } from "lucide-react";
import { COLORS, MODULES, TOTAL_MINUTES } from "@/lib/curriculum";
import { useApp } from "@/lib/store";
import { cx, Input } from "@/components/ui";

export default function Home() {
  const { done, team, setTeam, isLive } = useApp();
  const starts = MODULES.map((_, i) => MODULES.slice(0, i).reduce((a, x) => a + x.minutes, 0));
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-900 p-8 text-white">
        <div className="text-xs font-bold uppercase tracking-widest text-indigo-300">5-Hour Advanced Technical Session</div>
        <h1 className="mt-2 text-4xl font-bold">LLMOps &amp; AI Platform Engineering</h1>
        <p className="mt-2 max-w-2xl text-indigo-100">
          No slides. Every concept is a lab: you route traffic through a gateway, break a RAG pipeline, gate a release on evals, trace an agent, red-team it, and design a platform for 100 teams.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Principle icon={<Hand size={18} />} title="Do, then discuss" text="Each lab starts with a task. Concepts come out of what you observe." />
          <Principle icon={<Users size={18} />} title="Work in teams" text="Pairs or teams of 3–5. The facilitator guides the debrief rather than lecturing." />
          <Principle icon={<Zap size={18} />} title={isLive ? "LIVE mode on" : "Offline simulator"} text={isLive ? "Gateway, RAG, eval and agent labs call your real LLM." : "Everything works without keys. Add an OpenAI-compatible endpoint in Settings to go live."} />
        </div>
        <div className="mt-5 flex max-w-sm items-center gap-2">
          <Input value={team} onChange={setTeam} placeholder="Your team name (optional)" className="border-white/20 bg-white/10 text-white placeholder:text-indigo-200" />
        </div>
      </div>

      <Link href="/showcase" className="group mt-6 flex items-center gap-4 rounded-2xl bg-[#060a17] p-5 text-white ring-1 ring-violet-500/40 transition hover:ring-violet-400">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 text-2xl">🛡️</div>
        <div className="flex-1">
          <div className="text-xs font-bold uppercase tracking-widest text-cyan-300">Finale · industry showcase</div>
          <div className="text-lg font-bold">ClaimPilot: an agentic insurance-claims platform built from everything in this session</div>
          <div className="text-sm text-slate-400">7 agents, gateway, RAG, guardrails, HITL, evals, canary + rollback and FinOps, visualised live.</div>
        </div>
        <Rocket className="text-violet-300 transition group-hover:-translate-y-1" />
      </Link>

      <h2 className="mt-8 mb-3 text-lg font-bold">Session timeline · {TOTAL_MINUTES} minutes</h2>
      <div className="flex h-12 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {MODULES.map((m, i) => {
          const start = starts[i];
          return (
            <Link key={m.id} href={`/${m.id}`} style={{ width: `${(m.minutes / TOTAL_MINUTES) * 100}%` }} className={cx("flex flex-col justify-center border-r border-white/40 px-2 text-white transition hover:brightness-110", COLORS[m.color].bg)}>
              <span className="truncate text-xs font-bold">M{m.num} · {m.minutes}m</span>
              <span className="truncate text-[10px] opacity-80">{fmtClock(start)}–{fmtClock(start + m.minutes)}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {MODULES.map((m) => {
          const c = COLORS[m.color];
          return (
            <Link key={m.id} href={`/${m.id}`} className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white", c.bg)}>{m.num}</div>
                <div className="flex-1">
                  <div className="font-semibold leading-tight text-slate-900">{m.title}</div>
                  <div className="text-xs text-slate-500">{m.tagline} · {m.minutes} min</div>
                </div>
                <ArrowRight size={18} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-600" />
              </div>
              <ul className="mt-3 space-y-1">
                {m.labs.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 text-sm text-slate-700">
                    {done.has(l.id) ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Layers size={14} className="text-slate-300" />}
                    <span className="w-7 text-xs text-slate-400">{l.id}</span>
                    <span className="flex-1">{l.title}</span>
                    <span className="text-xs text-slate-400">{l.minutes}m</span>
                  </li>
                ))}
              </ul>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Principle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-4">
      <div className="flex items-center gap-2 font-semibold">{icon}{title}</div>
      <div className="mt-1 text-sm text-indigo-100">{text}</div>
    </div>
  );
}

const fmtClock = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
