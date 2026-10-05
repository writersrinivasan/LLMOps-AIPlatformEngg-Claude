"use client";
import Link from "next/link";
import { COLORS, MODULES, TOTAL_MINUTES } from "@/lib/curriculum";
import { cx } from "@/components/ui";

export default function RunSheet() {
  // precompute start minute of every lab
  const labStart: Record<string, number> = {};
  let acc = 0;
  for (const m of MODULES) for (const l of m.labs) { labStart[l.id] = acc; acc += l.minutes; }
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-2xl font-bold">Facilitator run sheet</h1>
      <p className="mt-1 text-sm text-slate-600">
        {TOTAL_MINUTES} minutes of content. Your role is to <b>set the task → let teams explore → harvest observations → name the concept</b>. Turn on <b>Facilitator mode</b> in the sidebar to show the talk track inside every lab.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          ["1. Frame (1 min)", "Read the task aloud and start the lab timer."],
          ["2. Explore (60%)", "Teams work in the lab. You walk the room. Don't explain yet."],
          ["3. Harvest (25%)", "Use 'Ask the room'. Write their observations on the board."],
          ["4. Name it (15%)", "Connect their observations to the agenda terms shown on the chips."],
        ].map(([h, d]) => (
          <div key={h} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold">{h}</div>
            <div className="text-xs text-slate-600">{d}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <b>Breaks:</b> the agenda totals exactly 5 hours. If your slot includes breaks, take a 10-minute break after Module 3 and a 5-minute break after Module 5. Recover the time by shortening 3.5 (infra) and 6.4 (maturity), which work well as take-home exercises.
      </div>

      <div className="mt-6 space-y-5">
        {MODULES.map((m) => {
          const c = COLORS[m.color];
          const mStart = labStart[m.labs[0].id];
          return (
            <div key={m.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className={cx("flex items-center justify-between px-4 py-3 text-white", c.bg)}>
                <div className="font-semibold">M{m.num}. {m.title}</div>
                <div className="font-mono text-sm">{clock(mStart)} → {clock(mStart + m.minutes)}</div>
              </div>
              <div className="border-b border-slate-100 px-4 py-2 text-sm text-slate-700"><b>Hook:</b> {m.hook}</div>
              <table className="w-full text-sm">
                <tbody>
                  {m.labs.map((l) => {
                    const s = labStart[l.id];
                    const t = s + l.minutes;
                    return (
                      <tr key={l.id} className="border-b border-slate-100 align-top last:border-0">
                        <td className="w-28 px-4 py-2 font-mono text-xs text-slate-500">{clock(s)}–{clock(t)}</td>
                        <td className="w-64 px-2 py-2">
                          <Link href={`/${m.id}#${l.id}`} className={cx("font-medium hover:underline", c.text)}>{l.id} {l.title}</Link>
                          <div className="text-xs text-slate-500">{l.minutes} min</div>
                        </td>
                        <td className="px-2 py-2 text-slate-700">
                          <div>{l.task}</div>
                          <div className="mt-1 text-xs text-slate-500"><b>Ask:</b> {l.facilitator.ask.join(" · ")}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const clock = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
