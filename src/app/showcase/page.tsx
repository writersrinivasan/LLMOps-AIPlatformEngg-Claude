"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, FlaskConical, Layers, Radar, Rocket, Sparkles, Zap } from "lucide-react";
import { cx } from "@/components/ui";
import { useApp } from "@/lib/store";
import { Autopilot } from "@/lib/showcase/autopilot";
import { LENS } from "@/lib/showcase/data";
import { MODULES } from "@/lib/curriculum";
import { CommandCenter } from "@/components/showcase/CommandCenter";
import { ClaimStudio } from "@/components/showcase/ClaimStudio";
import { ReleaseLab } from "@/components/showcase/ReleaseLab";
import { PlatformView } from "@/components/showcase/PlatformView";
import { GlowBtn, LensCtx, ModChip } from "@/components/showcase/ui";

type TabId = "command" | "studio" | "release" | "platform";
const TABS: { id: TabId; label: string; icon: React.ReactNode; hex: string; modules: string[]; blurb: string }[] = [
  { id: "command", label: "Mission Control", icon: <Radar size={15} />, hex: "#22d3ee", modules: ["m2", "m5", "m6"], blurb: "Production traffic flowing through 7 agents, live" },
  { id: "studio", label: "Claim Studio", icon: <Sparkles size={15} />, hex: "#f472b6", modules: ["m2", "m4", "m5", "m6"], blurb: "One claim, every agent step, traced" },
  { id: "release", label: "Release & Evals", icon: <FlaskConical size={15} />, hex: "#34d399", modules: ["m3", "m4"], blurb: "Ship a prompt like software" },
  { id: "platform", label: "Platform & FinOps", icon: <Layers size={15} />, hex: "#fbbf24", modules: ["m1", "m6", "m7"], blurb: "One platform, many teams" },
];

export default function Showcase() {
  const { isLive, settings } = useApp();
  const [engine] = useState(() => new Autopilot());
  const [tab, setTab] = useState<TabId>("command");
  const [lens, setLens] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);
  const [intro, setIntro] = useState(true);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString("en-IN", { hour12: false })), 1000);
    return () => { clearInterval(id); engine.stop(); };
  }, [engine]);

  const launch = () => { engine.start(); setIntro(false); };

  return (
    <LensCtx.Provider value={{ lens, focus, setFocus }}>
      <div className="relative min-h-screen overflow-x-hidden bg-[#060a17] pb-24 text-slate-100">
        <div className="orb left-[-10%] top-[-10%] h-[480px] w-[480px] bg-cyan-500/20" />
        <div className="orb right-[-8%] top-[20%] h-[420px] w-[420px] bg-fuchsia-500/15" style={{ animationDelay: "-5s" }} />
        <div className="orb bottom-[-10%] left-[30%] h-[460px] w-[460px] bg-violet-600/20" style={{ animationDelay: "-9s" }} />

        {/* ---------- top bar ---------- */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#060a17]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-3 px-4 py-3 md:px-6">
            <Link href="/" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" title="Back to the labs"><ArrowLeft size={18} /></Link>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 text-xl shadow-[0_0_24px_rgba(167,139,250,.6)]">🛡️</div>
              <div>
                <div className="text-lg font-black leading-none tracking-tight"><span className="text-shimmer">ClaimPilot</span></div>
                <div className="text-[11px] text-slate-400">Acme Assure · Agentic claims platform</div>
              </div>
            </div>
            <div className="ml-2 hidden items-center gap-1.5 lg:flex">
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">● prod</span>
              <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-400">ap-south-1</span>
              <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-400">{clock}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/settings" className={cx("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold", isLive ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-slate-400")}>
                <Zap size={13} /> {isLive ? `LIVE · ${settings.model || "server model"}` : "Simulator"}
              </Link>
              <button type="button" onClick={() => { setLens(!lens); if (lens) setFocus(null); }}
                className={cx("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition", lens ? "bg-violet-500/20 text-violet-200" : "bg-white/5 text-slate-400")}>
                {lens ? <Eye size={13} /> : <EyeOff size={13} />} Learning lens
              </button>
            </div>
          </div>
          <nav className="mx-auto flex max-w-[1680px] gap-1 overflow-x-auto px-4 pb-2 md:px-6">
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={cx("group flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition", on ? "text-[#060a17]" : "text-slate-300 hover:bg-white/5")}
                  style={on ? { background: t.hex, boxShadow: `0 0 24px ${t.hex}77` } : undefined}>
                  {t.icon}{t.label}
                  <span className={cx("hidden text-[11px] font-normal md:inline", on ? "text-[#060a17]/70" : "text-slate-500")}>· {t.blurb}</span>
                </button>
              );
            })}
          </nav>
        </header>

        <main className="relative mx-auto max-w-[1680px] px-4 py-5 md:px-6">
          {tab === "command" && <CommandCenter engine={engine} />}
          {tab === "studio" && <ClaimStudio />}
          {tab === "release" && <ReleaseLab />}
          {tab === "platform" && <PlatformView engine={engine} />}
        </main>

        {/* ---------- learning journey bar ---------- */}
        {lens && (
          <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#060a17]/85 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1680px] items-center gap-2 overflow-x-auto px-4 py-2.5 md:px-6">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your 5 hours →</span>
              {MODULES.map((m) => {
                const l = LENS[m.id];
                const on = focus === m.id;
                return (
                  <button key={m.id} type="button" onClick={() => setFocus(on ? null : m.id)}
                    title={`${m.title}: highlight every panel that uses it`}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-left transition hover:brightness-125"
                    style={{ borderColor: l.hex + (on ? "" : "55"), background: on ? l.hex + "33" : l.hex + "0f", boxShadow: on ? `0 0 18px ${l.hex}88` : undefined }}>
                    <span className="flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-black text-[#060a17]" style={{ background: l.hex }}>{m.num}</span>
                    <span className="text-[11px] leading-tight">
                      <span className="block font-semibold text-slate-100">{l.label}</span>
                      <span className="text-[10px] text-slate-500">{m.minutes} min</span>
                    </span>
                  </button>
                );
              })}
              {focus && <button type="button" onClick={() => setFocus(null)} className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:text-white">clear ✕</button>}
            </div>
          </footer>
        )}

        {/* ---------- intro ---------- */}
        {intro && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#050814]/95 p-6 backdrop-blur-md">
            <div className="orb left-[10%] top-[10%] h-[400px] w-[400px] bg-cyan-500/30" />
            <div className="orb bottom-[5%] right-[10%] h-[420px] w-[420px] bg-fuchsia-500/25" style={{ animationDelay: "-6s" }} />
            <div className="relative max-w-3xl text-center animate-[fadeUp_.6s_ease]">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 text-4xl shadow-[0_0_60px_rgba(167,139,250,.7)]">🛡️</div>
              <div className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Industry showcase · insurance claims</div>
              <h1 className="mt-3 text-5xl font-black tracking-tight md:text-7xl"><span className="text-shimmer">ClaimPilot</span></h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
                A claim arrives on WhatsApp. Seven AI agents read it, check the policy, price the damage, hunt for fraud and pay the customer, <b className="text-white">in under two minutes</b>, with humans in control.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {["7 agents", "6 MCP tools", "4 models behind 1 gateway", "RAG over policy", "guardrails", "LLM-judge evals", "canary + rollback", "FinOps"].map((x) => (
                  <span key={x} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">{x}</span>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-1.5">{Object.keys(LENS).map((m) => <ModChip key={m} m={m} />)}</div>
              <p className="mt-3 text-sm text-slate-400">Everything on the next screen is something you built today.</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <GlowBtn hex="#22d3ee" active onClick={launch} className="!px-7 !py-3.5 text-base"><Rocket size={18} /> Launch mission control</GlowBtn>
                <button type="button" onClick={() => { setIntro(false); setTab("studio"); }} className="rounded-xl px-4 py-3 text-sm text-slate-400 hover:text-white">or open Claim Studio →</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LensCtx.Provider>
  );
}
