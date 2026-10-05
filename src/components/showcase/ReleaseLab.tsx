"use client";
import { useRef, useState } from "react";
import { Boxes, CheckCircle2, CircleDashed, FlaskConical, GitPullRequest, Loader2, Rocket, ShieldX, Swords, XCircle } from "lucide-react";
import { cx } from "@/components/ui";
import { rng, sleep } from "@/lib/sim";
import { GlowBtn, ModChip, Panel, Spark, Tag } from "./ui";

type Cand = "safe" | "risky";
type StageStatus = "pending" | "running" | "pass" | "fail" | "skipped";

const STAGES = [
  { id: "pr", label: "Pull request", icon: "🔀", detail: "prompt + config diff" },
  { id: "unit", label: "Prompt unit tests", icon: "🧪", detail: "24 assertions" },
  { id: "golden", label: "Golden-set eval", icon: "🏅", detail: "240 labelled claims" },
  { id: "redteam", label: "Red-team suite", icon: "🦹", detail: "150 attacks" },
  { id: "budget", label: "Cost & latency", icon: "💰", detail: "budget gate" },
  { id: "shadow", label: "Shadow traffic", icon: "👥", detail: "1,000 replays" },
  { id: "canary", label: "Canary 10%", icon: "🐤", detail: "online judge" },
  { id: "rollout", label: "Rollout 100%", icon: "🚀", detail: "progressive" },
];

const GATES = [
  { k: "faith", label: "Faithfulness", th: 0.9, op: "≥", base: 0.94, safe: 0.95, risky: 0.84, fmt: (v: number) => v.toFixed(2) },
  { k: "ground", label: "Groundedness", th: 0.88, op: "≥", base: 0.92, safe: 0.93, risky: 0.9, fmt: (v: number) => v.toFixed(2) },
  { k: "policy", label: "Policy compliance", th: 0.95, op: "≥", base: 0.97, safe: 0.98, risky: 0.81, fmt: (v: number) => v.toFixed(2) },
  { k: "over", label: "Over-payment rate", th: 1, op: "≤", base: 0.4, safe: 0.3, risky: 6.2, fmt: (v: number) => v.toFixed(1) + "%" },
  { k: "inj", label: "Injection resistance", th: 100, op: "≥", base: 100, safe: 100, risky: 100, fmt: (v: number) => v + "%" },
  { k: "p95", label: "p95 latency", th: 8, op: "≤", base: 6.8, safe: 6.9, risky: 6.6, fmt: (v: number) => v.toFixed(1) + "s" },
  { k: "cost", label: "Cost / claim", th: 6, op: "≤", base: 4.6, safe: 4.8, risky: 4.5, fmt: (v: number) => "₹" + v.toFixed(2) },
] as const;

const RED_TEAM = [
  { cat: "Direct prompt injection", n: 40 },
  { cat: "Indirect injection (in PDFs)", n: 30 },
  { cat: "PII exfiltration", n: 25 },
  { cat: "Over-payment manipulation", n: 30 },
  { cat: "Jailbreak / role-play", n: 25 },
];

const DIFF: Record<Cand, { minus: string[]; plus: string[] }> = {
  safe: {
    minus: ["Cite the clause that applies."],
    plus: ["Cite every clause id you rely on, e.g. [HEALTH-5.4].", "If a limit or cap applies, show the arithmetic."],
  },
  risky: {
    minus: ["Apply all limits, caps and deductibles exactly as written."],
    plus: ["Be generous to customers. When in doubt,", "approve the full claimed amount to maximise CSAT."],
  },
};

export function ReleaseLab() {
  const [cand, setCand] = useState<Cand>("risky");
  const [bypass, setBypass] = useState(false);
  const [status, setStatus] = useState<StageStatus[]>(STAGES.map(() => "pending"));
  const [cells, setCells] = useState<number[]>([]); // 0 pass, 1 borderline, 2 fail
  const [red, setRed] = useState<number[]>(RED_TEAM.map(() => 0));
  const [canary, setCanary] = useState<{ base: number[]; cand: number[] }>({ base: [], cand: [] });
  const [verdict, setVerdict] = useState<null | { ok: boolean; text: string }>(null);
  const [gatesShown, setGatesShown] = useState(false);
  const [running, setRunning] = useState(false);
  const runRef = useRef(0);

  const set = (i: number, s: StageStatus) => setStatus((p) => p.map((x, j) => (j === i ? s : x)));

  const ship = async () => {
    const my = ++runRef.current;
    const alive = () => my === runRef.current;
    setRunning(true);
    setVerdict(null);
    setGatesShown(false);
    setCells([]);
    setRed(RED_TEAM.map(() => 0));
    setCanary({ base: [], cand: [] });
    setStatus(STAGES.map(() => "pending"));
    const risky = cand === "risky";

    for (let i = 0; i < STAGES.length; i++) {
      if (!alive()) return;
      set(i, "running");
      const id = STAGES[i].id;
      if (id === "golden") {
        const r = rng(risky ? 7 : 3);
        const arr: number[] = [];
        for (let c = 0; c < 240; c++) {
          const healthCluster = c % 12 >= 8; // the room-rent / cap cases
          const x = r();
          arr.push(risky && healthCluster ? (x < 0.55 ? 2 : x < 0.8 ? 1 : 0) : x < 0.03 ? 1 : x < 0.04 ? 2 : 0);
          if (c % 8 === 7) { setCells([...arr]); await sleep(28); }
        }
        setCells(arr);
        setGatesShown(true);
        await sleep(500);
        if (risky && !bypass) {
          set(i, "fail");
          for (let j = i + 1; j < STAGES.length; j++) set(j, "skipped");
          setVerdict({ ok: false, text: "Blocked by the eval gate. Policy compliance 0.81 < 0.95 and over-payment 6.2% > 1%. The bad prompt never reached a customer." });
          setRunning(false);
          return;
        }
        set(i, risky ? "skipped" : "pass");
        continue;
      }
      if (id === "redteam") {
        for (let k = 1; k <= 10; k++) { setRed(RED_TEAM.map((t) => Math.round((t.n * k) / 10))); await sleep(110); }
        set(i, "pass");
        continue;
      }
      if (id === "canary") {
        const r = rng(11);
        const base: number[] = [], c: number[] = [];
        for (let t = 0; t < 30; t++) {
          base.push(0.93 + r() * 0.03);
          c.push(risky ? Math.max(0.7, 0.93 - t * 0.006 - r() * 0.03) : 0.94 + r() * 0.03);
          setCanary({ base: [...base], cand: [...c] });
          await sleep(90);
        }
        if (risky) {
          set(i, "fail");
          set(i + 1, "skipped");
          setVerdict({ ok: false, text: "Gate bypassed, but the online judge caught it: canary faithfulness fell to 0.78, so the platform auto-rolled back to v3.2 in 40s. Failing traces were added to the golden set." });
          setRunning(false);
          return;
        }
        set(i, "pass");
        continue;
      }
      await sleep(id === "pr" ? 500 : id === "rollout" ? 1200 : 700);
      set(i, "pass");
    }
    setVerdict({ ok: true, text: "coverage-prompt v3.3 is live on 100% of traffic. Every gate is green, the release BOM is signed, and rollback is one click away." });
    setRunning(false);
  };

  const failCount = cells.filter((c) => c === 2).length;

  return (
    <div className="space-y-4">
      <Panel title="Ship a prompt change like software" icon={<Rocket size={15} />} modules={["m3", "m4"]}
        right={<GlowBtn hex="#34d399" onClick={ship} disabled={running}>{running ? <><Loader2 size={15} className="animate-spin" /> Pipeline running…</> : <><Rocket size={15} /> Ship coverage-prompt v3.3</>}</GlowBtn>}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-400">Candidate:</span>
          <GlowBtn hex="#4ade80" active={cand === "safe"} onClick={() => !running && setCand("safe")} className="!py-1.5 text-xs">✅ v3.3-safe · stricter citations</GlowBtn>
          <GlowBtn hex="#f43f5e" active={cand === "risky"} onClick={() => !running && setCand("risky")} className="!py-1.5 text-xs">🧨 v3.3-generous · &quot;be generous&quot;</GlowBtn>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={bypass} onChange={(e) => setBypass(e.target.checked)} disabled={running} className="accent-rose-500" />
            Bypass the offline eval gate (cowboy mode 🤠)
          </label>
        </div>

        {/* pipeline */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {STAGES.map((s, i) => {
            const st = status[i];
            const hex = { pending: "#475569", running: "#60a5fa", pass: "#4ade80", fail: "#f43f5e", skipped: "#64748b" }[st];
            return (
              <div key={s.id} className="relative">
                <div className={cx("h-full rounded-xl border p-2.5 transition-all duration-300", st === "running" && "scale-[1.03]", st === "skipped" && "opacity-40")}
                  style={{ borderColor: hex + "88", background: hex + "14", boxShadow: st === "running" || st === "fail" ? `0 0 22px ${hex}66` : undefined }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{s.icon}</span>
                    {st === "running" ? <Loader2 size={15} className="animate-spin text-sky-300" /> : st === "pass" ? <CheckCircle2 size={15} className="text-emerald-400" /> : st === "fail" ? <XCircle size={15} className="text-rose-400" /> : <CircleDashed size={15} className="text-slate-600" />}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-100">{s.label}</div>
                  <div className="text-[10px] text-slate-500">{st === "skipped" ? (i === 2 ? "bypassed!" : "skipped") : s.detail}</div>
                </div>
                {i < STAGES.length - 1 && <div className="absolute top-1/2 -right-2 hidden h-0.5 w-2 xl:block" style={{ background: st === "pass" ? "#4ade80" : "#334155" }} />}
              </div>
            );
          })}
        </div>

        {verdict && (
          <div className={cx("mt-4 flex items-start gap-3 rounded-2xl border p-4 animate-[fadeUp_.4s_ease]", verdict.ok ? "border-emerald-400/50 bg-emerald-500/10" : "border-rose-400/50 bg-rose-500/10")}>
            <span className="text-3xl">{verdict.ok ? "🎉" : "✋"}</span>
            <div>
              <div className={cx("text-lg font-bold", verdict.ok ? "text-emerald-300" : "text-rose-300")}>{verdict.ok ? "Released safely" : "Release stopped"}</div>
              <div className="text-sm text-slate-300">{verdict.text}</div>
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Prompt diff (registry)" icon={<GitPullRequest size={15} />} modules={["m2", "m3"]} right={<Tag hex="#94a3b8">prompts/coverage.yaml</Tag>}>
          <pre className="overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed">
            <div className="text-slate-500">@@ system_prompt @@</div>
            <div className="text-slate-400">  You are the Coverage agent for Acme Assure.</div>
            <div className="text-slate-400">  Use ONLY the retrieved policy clauses.</div>
            {DIFF[cand].minus.map((l) => <div key={l} className="bg-rose-500/10 text-rose-300">- {l}</div>)}
            {DIFF[cand].plus.map((l) => <div key={l} className="bg-emerald-500/10 text-emerald-300">+ {l}</div>)}
          </pre>
          <div className="mt-3 text-[11px] font-semibold text-slate-400">Release bill of materials <ModChip m="m3" /></div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px]">
            {[["Model", "balanced-m@2026-08"], ["Prompt", `coverage@v3.3-${cand}`], ["Index", "policy-idx@v41"], ["Guardrails", "guard-policy@v12"], ["Tools", "mcp-manifest@v7"], ["Eval set", "golden@v19 (240)"]].map(([k, v]) => (
              <div key={k} className="rounded-md bg-white/5 px-2 py-1"><span className="text-slate-500">{k}</span> <span className="font-mono text-slate-200">{v}</span></div>
            ))}
          </div>
        </Panel>

        <Panel title="Golden-set evaluation" icon={<FlaskConical size={15} />} modules={["m4"]} right={cells.length ? <Tag hex={failCount > 10 ? "#f43f5e" : "#4ade80"}>{cells.length}/240 · {failCount} failing</Tag> : null}>
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
            {Array.from({ length: 240 }, (_, i) => {
              const c = cells[i];
              const bg = c === undefined ? "rgba(255,255,255,.05)" : c === 0 ? "#22c55e" : c === 1 ? "#fbbf24" : "#f43f5e";
              return <div key={i} className="aspect-square rounded-[3px] transition-colors duration-300" style={{ background: bg, boxShadow: c === 2 ? "0 0 6px #f43f5e" : undefined }} />;
            })}
          </div>
          <div className="mt-2 flex gap-3 text-[10.5px] text-slate-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-500" />pass</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" />borderline</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-500" />fail</span>
            <span className="ml-auto">LLM-judge ↔ human agreement κ = 0.82</span>
          </div>
          {cand === "risky" && failCount > 10 && <div className="mt-2 rounded-lg bg-rose-500/10 p-2 text-[11px] text-rose-200">Failures cluster in health claims with room-rent caps: the &quot;be generous&quot; wording overrides HEALTH-5.4.</div>}
        </Panel>

        <Panel title="Eval gates" icon={<ShieldX size={15} />} modules={["m3", "m4"]}>
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="pb-1">Metric</th><th>Gate</th><th className="text-right">v3.2</th><th className="text-right">v3.3</th><th /></tr></thead>
            <tbody>
              {GATES.map((g) => {
                const v = g[cand];
                const ok = g.op === "≥" ? v >= g.th : v <= g.th;
                return (
                  <tr key={g.k} className="border-t border-white/5">
                    <td className="py-1.5 text-slate-300">{g.label}</td>
                    <td className="font-mono text-slate-500">{g.op} {g.fmt(g.th)}</td>
                    <td className="text-right font-mono text-slate-400">{g.fmt(g.base)}</td>
                    <td className={cx("text-right font-mono font-bold", !gatesShown ? "text-slate-600" : ok ? "text-emerald-300" : "text-rose-300")}>{gatesShown ? g.fmt(v) : "…"}</td>
                    <td className="pl-2 text-right">{gatesShown && (ok ? "✅" : "❌")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="Red-team arena" icon={<Swords size={15} />} modules={["m5"]}>
          <div className="space-y-2">
            {RED_TEAM.map((t, i) => (
              <div key={t.cat} className="text-[11px]">
                <div className="flex justify-between text-slate-300"><span>{t.cat}</span><span className="font-mono">{red[i]}/{t.n} blocked</span></div>
                <div className="h-1.5 overflow-hidden rounded bg-white/5"><div className="h-full rounded bg-gradient-to-r from-rose-500 to-fuchsia-400 transition-all duration-200" style={{ width: `${(red[i] / t.n) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Canary: candidate vs baseline (online judge)" icon={<Boxes size={15} />} modules={["m3", "m4", "m5"]} className="xl:col-span-2">
          {canary.cand.length ? (
            <div className="relative">
              <div className="absolute inset-0"><Spark values={canary.base} color="#94a3b8" min={0.7} max={1} fill={false} height={130} /></div>
              <Spark values={canary.cand} color={cand === "risky" ? "#f43f5e" : "#4ade80"} min={0.7} max={1} threshold={{ v: 0.9, label: "SLO" }} height={130} />
              <div className="mt-1 flex gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-slate-400" />v3.2 baseline (90%)</span>
                <span className="flex items-center gap-1"><span className="h-0.5 w-3" style={{ background: cand === "risky" ? "#f43f5e" : "#4ade80" }} />v3.3 canary (10%)</span>
                <span className="flex items-center gap-1"><span className="h-0.5 w-3 border-t border-dashed border-rose-400" />SLO 0.90</span>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-slate-500">The canary chart appears when the release reaches 10% of real traffic.</div>
          )}
        </Panel>
      </div>
    </div>
  );
}
