"use client";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, Lightbulb, MessageCircleQuestion, Pause, Play, RotateCcw, Target } from "lucide-react";
import { COLORS, getModule, Lab, MODULES } from "@/lib/curriculum";
import { useApp } from "@/lib/store";
import { cx } from "@/components/ui";

export function ModulePage({ moduleId, labs }: { moduleId: string; labs: Record<string, ReactNode> }) {
  const m = getModule(moduleId);
  const c = COLORS[m.color];
  const { facilitator, done } = useApp();
  const [active, setActive] = useState(m.labs[0].id);

  useEffect(() => {
    const sync = () => {
      const fromHash = decodeURIComponent(window.location.hash.slice(1));
      if (m.labs.some((l) => l.id === fromHash)) setActive(fromHash);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [m.labs]);

  const select = (id: string) => {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
  };

  const idx = MODULES.findIndex((x) => x.id === m.id);
  const lab = m.labs.find((l) => l.id === active)!;
  const labIdx = m.labs.indexOf(lab);

  return (
    <div>
      <header className={cx("border-b px-8 pt-6 pb-0", c.soft, c.border)}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className={cx("text-xs font-bold uppercase tracking-wider", c.text)}>Module {m.num} · {m.minutes} minutes</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{m.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">{m.outcome}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            {idx > 0 && <Link href={`/${MODULES[idx - 1].id}`} className="rounded-lg p-2 text-slate-500 hover:bg-white" title="Previous module"><ChevronLeft size={18} /></Link>}
            {idx < MODULES.length - 1 && <Link href={`/${MODULES[idx + 1].id}`} className="rounded-lg p-2 text-slate-500 hover:bg-white" title="Next module"><ChevronRight size={18} /></Link>}
          </div>
        </div>
        {facilitator && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <MessageCircleQuestion size={16} className="mt-0.5 shrink-0" />
            <div><b>Opening hook:</b> {m.hook}</div>
          </div>
        )}
        <div className="mt-4 flex gap-1 overflow-x-auto">
          {m.labs.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => select(l.id)}
              className={cx(
                "flex shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-sm transition",
                l.id === active ? "border-slate-200 bg-white font-semibold text-slate-900" : "border-transparent text-slate-600 hover:bg-white/60",
              )}
            >
              {done.has(l.id) ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Circle size={14} className="text-slate-300" />}
              <span className="text-slate-400">{l.id}</span> {l.title}
              <span className="text-[11px] text-slate-400">{l.minutes}m</span>
            </button>
          ))}
        </div>
      </header>
      <div className="px-8 py-6">
        <LabFrame key={lab.id} lab={lab} color={m.color}>{labs[lab.id]}</LabFrame>
        <div className="mt-8 flex justify-between border-t border-slate-200 pt-4 text-sm">
          {labIdx > 0 ? <button type="button" onClick={() => select(m.labs[labIdx - 1].id)} className="text-slate-600 hover:text-slate-900">← {m.labs[labIdx - 1].id} {m.labs[labIdx - 1].title}</button> : <span />}
          {labIdx < m.labs.length - 1 ? (
            <button type="button" onClick={() => select(m.labs[labIdx + 1].id)} className="font-medium text-indigo-700">Next: {m.labs[labIdx + 1].id} {m.labs[labIdx + 1].title} →</button>
          ) : idx < MODULES.length - 1 ? (
            <Link href={`/${MODULES[idx + 1].id}`} className="font-medium text-indigo-700">Next module: {MODULES[idx + 1].title} →</Link>
          ) : <span />}
        </div>
      </div>
    </div>
  );
}

function LabFrame({ lab, color, children }: { lab: Lab; color: keyof typeof COLORS; children: ReactNode }) {
  const { facilitator, done, toggleDone } = useApp();
  const c = COLORS[color];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className={cx("rounded-xl border bg-white p-4", c.border)}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><Target size={14} className={c.text} /> Your task</div>
          <p className="mt-1 text-[15px] text-slate-800">{lab.task}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {lab.agenda.map((a) => (
              <span key={a} className={cx("rounded-md px-2 py-0.5 text-[11px]", c.soft, c.text)}>{a}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-row gap-2 lg:flex-col">
          <LabTimer minutes={lab.minutes} />
          <button
            type="button"
            onClick={() => toggleDone(lab.id)}
            className={cx("flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold", done.has(lab.id) ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}
          >
            {done.has(lab.id) ? <CheckCircle2 size={16} /> : <Circle size={16} />} {done.has(lab.id) ? "Completed" : "Mark complete"}
          </button>
        </div>
      </div>
      {facilitator && (
        <div className="grid gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 md:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center gap-1.5 font-bold"><MessageCircleQuestion size={15} /> Ask the room</div>
            <ul className="list-disc space-y-1 pl-5">{lab.facilitator.ask.map((q) => <li key={q}>{q}</li>)}</ul>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 font-bold"><Lightbulb size={15} /> Listen for</div>
            <ul className="list-disc space-y-1 pl-5">{lab.facilitator.lookFor.map((q) => <li key={q}>{q}</li>)}</ul>
            {lab.facilitator.tip && <div className="mt-2 rounded bg-amber-100 px-2 py-1 text-xs"><b>Facilitation tip:</b> {lab.facilitator.tip}</div>}
          </div>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

function LabTimer({ minutes }: { minutes: number }) {
  const [left, setLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => (l <= 0 ? 0 : l - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);
  const mm = Math.floor(Math.abs(left) / 60).toString().padStart(2, "0");
  const ss = (Math.abs(left) % 60).toString().padStart(2, "0");
  const warn = left < 60;
  return (
    <div className={cx("flex items-center gap-2 rounded-xl border px-3 py-2", warn ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white")}>
      <Clock size={16} className={warn ? "text-rose-600" : "text-slate-400"} />
      <span className={cx("font-mono text-lg font-bold tabular-nums", warn ? "text-rose-700" : "text-slate-800")}>{mm}:{ss}</span>
      <button type="button" onClick={() => setRunning(!running)} className="rounded p-1 text-slate-600 hover:bg-slate-100" title={running ? "Pause" : "Start lab timer"}>
        {running ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <button type="button" onClick={() => { setRunning(false); setLeft(minutes * 60); }} className="rounded p-1 text-slate-400 hover:bg-slate-100" title="Reset">
        <RotateCcw size={14} />
      </button>
    </div>
  );
}
