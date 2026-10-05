"use client";
import { ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, title, right, pad = true }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode; pad?: boolean }) {
  return (
    <div className={cx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          {right}
        </div>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </div>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
  secondary: "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:opacity-50",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
};

export function Btn({ children, onClick, variant = "primary", disabled, className, size = "md", title }: { children: ReactNode; onClick?: () => void; variant?: BtnVariant; disabled?: boolean; className?: string; size?: "sm" | "md"; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        BTN[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

const PILL = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-rose-100 text-rose-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  violet: "bg-violet-100 text-violet-800",
  cyan: "bg-cyan-100 text-cyan-800",
};
export type PillColor = keyof typeof PILL;

export function Pill({ children, color = "slate", className }: { children: ReactNode; color?: PillColor; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", PILL[color], className)}>{children}</span>;
}

export function Slider({ label, value, min, max, step = 1, onChange, fmt, hint }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-mono text-indigo-700">{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" className="mt-1 w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-2.5 select-none", disabled && "opacity-50")}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-indigo-600" : "bg-slate-300")}
      >
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", checked ? "left-4.5" : "left-0.5")} />
      </button>
      <span className="text-sm leading-tight">
        <span className="font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function Select<T extends string>({ label, value, options, onChange }: { label?: string; value: T; options: (T | { value: T; label: string })[]; onChange: (v: T) => void }) {
  return (
    <label className="block text-xs">
      {label && <span className="mb-1 block font-medium text-slate-700">{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cx("rounded-md px-3 py-1.5 text-sm font-medium transition", value === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, tone = "slate" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "slate" | "green" | "red" | "amber" }) {
  const t = { slate: "text-slate-900", green: "text-emerald-600", red: "text-rose-600", amber: "text-amber-600" }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cx("text-xl font-bold tabular-nums", t)}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Callout({ children, tone = "info", title }: { children: ReactNode; tone?: "info" | "warn" | "ok" | "bad"; title?: ReactNode }) {
  const t = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
    bad: "border-rose-200 bg-rose-50 text-rose-900",
  }[tone];
  return (
    <div className={cx("rounded-lg border px-3 py-2 text-sm", t)}>
      {title && <div className="font-semibold">{title}</div>}
      {children}
    </div>
  );
}

export function Bar({ value, max = 1, color = "bg-indigo-500", className }: { value: number; max?: number; color?: string; className?: string }) {
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%` }} />
    </div>
  );
}

export function TextArea({ value, onChange, rows = 4, className, mono }: { value: string; onChange: (v: string) => void; rows?: number; className?: string; mono?: boolean }) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className={cx("w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none", mono && "font-mono text-xs", className)}
    />
  );
}

export function Input({ value, onChange, placeholder, className, type = "text", onEnter }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; type?: string; onEnter?: () => void }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
      className={cx("w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none", className)}
    />
  );
}
