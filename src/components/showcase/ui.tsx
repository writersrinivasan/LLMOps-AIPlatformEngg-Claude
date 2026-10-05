"use client";
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { LENS } from "@/lib/showcase/data";

// ---------- Learning lens: tag every panel with the module it came from ----------
interface LensState { lens: boolean; focus: string | null; setFocus: (m: string | null) => void }
export const LensCtx = createContext<LensState>({ lens: true, focus: null, setFocus: () => {} });

export function ModChip({ m, className }: { m: string; className?: string }) {
  const l = LENS[m];
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap", className)} style={{ color: l.hex, borderColor: l.hex + "66", background: l.hex + "1a" }}>
      {l.short}
    </span>
  );
}

export function Panel({ title, icon, modules = [], right, children, className, pad = true }: { title?: ReactNode; icon?: ReactNode; modules?: string[]; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  const { lens, focus } = useContext(LensCtx);
  const dim = focus && !modules.includes(focus);
  const hot = focus && modules.includes(focus);
  const hex = hot ? LENS[focus].hex : undefined;
  return (
    <section
      className={cx("relative min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm transition-all duration-300", dim && "opacity-25 saturate-50", className)}
      style={hot ? { boxShadow: `0 0 0 1.5px ${hex}, 0 0 32px ${hex}55` } : undefined}
    >
      {(title || right || (lens && modules.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-2.5">
          {icon && <span className="text-slate-300">{icon}</span>}
          {title && <h3 className="text-sm font-semibold text-slate-100">{title}</h3>}
          {lens && modules.map((m) => <ModChip key={m} m={m} />)}
          <div className="ml-auto flex items-center gap-2">{right}</div>
        </div>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Tag({ children, hex = "#94a3b8", className }: { children: ReactNode; hex?: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap", className)} style={{ color: hex, background: hex + "22" }}>
      {children}
    </span>
  );
}

// ---------- Count-up number ----------
export function CountUp({ value, fmt = (v) => Math.round(v).toLocaleString("en-IN"), ms = 900 }: { value: number; fmt?: (v: number) => string; ms?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const v = a + (value - a) * e;
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <span className="tabular-nums">{fmt(shown)}</span>;
}

// ---------- Dark area sparkline ----------
export function Spark({ values, color, height = 54, min, max, threshold, fill = true }: { values: number[]; color: string; height?: number; min?: number; max?: number; threshold?: { v: number; label: string; color?: string }; fill?: boolean }) {
  const W = 300;
  const H = height;
  if (values.length < 2) return <div style={{ height }} />;
  const lo = min ?? Math.min(...values) * 0.9;
  const hi = max ?? Math.max(...values, threshold?.v ?? -Infinity) * 1.1 + 1e-9;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - 2 - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo || 1)) * (H - 4);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const id = "g" + color.replace("#", "");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {threshold && (
        <>
          <line x1={0} x2={W} y1={y(threshold.v)} y2={y(threshold.v)} stroke={threshold.color ?? "#f43f5e"} strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </>
      )}
      {fill && <polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#${id})`} />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r={3} fill={color} className="animate-pulse" />
    </svg>
  );
}

// ---------- Radial gauge ----------
export function Gauge({ value, size = 92, color, label, sub, max = 1, fmt }: { value: number; size?: number; color: string; label?: string; sub?: string; max?: number; fmt?: (v: number) => string }) {
  const r = size / 2 - 8;
  const C = 2 * Math.PI * r;
  const k = Math.max(0, Math.min(1, value / max));
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth={7} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={7} fill="none" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - k)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)", filter: `drop-shadow(0 0 6px ${color}99)` }}
        />
        <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fill="#f8fafc" fontSize={size / 5} fontWeight={700}>
          {fmt ? fmt(value) : value.toFixed(2)}
        </text>
      </svg>
      {label && <div className="mt-0.5 text-[11px] font-semibold text-slate-300">{label}</div>}
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function GlowBtn({ children, onClick, hex = "#818cf8", disabled, className, active }: { children: ReactNode; onClick?: () => void; hex?: string; disabled?: boolean; className?: string; active?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx("inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40", className)}
      style={{ color: active ? "#0b1020" : hex, borderColor: hex + "88", background: active ? hex : hex + "1f", boxShadow: active ? `0 0 24px ${hex}88` : undefined }}
    >
      {children}
    </button>
  );
}

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-IN", { hour12: false });
