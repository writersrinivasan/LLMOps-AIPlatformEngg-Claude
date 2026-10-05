"use client";

export interface Series { name: string; color: string; values: number[]; dashed?: boolean }

/** Minimal responsive SVG line chart. */
export function LineChart({ series, height = 140, yMax, yMin = 0, fmt = (v) => String(Math.round(v)), markers = [], xLabels }: { series: Series[]; height?: number; yMax?: number; yMin?: number; fmt?: (v: number) => string; markers?: { x: number; label: string; color?: string }[]; xLabels?: string[] }) {
  const W = 600;
  const H = height;
  const pad = { l: 40, r: 8, t: 8, b: 18 };
  const n = Math.max(2, ...series.map((s) => s.values.length));
  const max = yMax ?? Math.max(1e-9, ...series.flatMap((s) => s.values)) * 1.1;
  const x = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (max - yMin || 1)) * (H - pad.t - pad.b);
  const ticks = [yMin, (yMin + max) / 2, max];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.l - 4} y={y(t) + 3} fontSize={9} textAnchor="end" fill="#94a3b8">{fmt(t)}</text>
          </g>
        ))}
        {markers.map((m) => (
          <g key={m.label + m.x}>
            <line x1={x(m.x)} x2={x(m.x)} y1={pad.t} y2={H - pad.b} stroke={m.color ?? "#f43f5e"} strokeDasharray="3 3" />
            <text x={x(m.x) + 3} y={pad.t + 9} fontSize={9} fill={m.color ?? "#f43f5e"}>{m.label}</text>
          </g>
        ))}
        {series.map((s) => (
          <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        ))}
        {xLabels && xLabels.map((l, i) => (i % Math.ceil(xLabels.length / 8) === 0 ? <text key={i} x={x(i)} y={H - 4} fontSize={9} textAnchor="middle" fill="#94a3b8">{l}</text> : null))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-600">
        {series.map((s) => <span key={s.name} className="flex items-center gap-1"><span className="h-0.5 w-3" style={{ background: s.color }} />{s.name}</span>)}
      </div>
    </div>
  );
}

/** Radar chart for maturity assessments. */
export function Radar({ axes, values, target, size = 300 }: { axes: string[]; values: number[]; target?: number[]; size?: number }) {
  const c = size / 2;
  const R = c - 50;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return [c + Math.cos(a) * R * (v / 5), c + Math.sin(a) * R * (v / 5)];
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[340px]">
      {[1, 2, 3, 4, 5].map((l) => <polygon key={l} points={poly(axes.map(() => l))} fill="none" stroke="#e2e8f0" />)}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 5.9);
        const [lx, ly] = pt(i, 5);
        return (
          <g key={a}>
            <line x1={c} y1={c} x2={lx} y2={ly} stroke="#e2e8f0" />
            <text x={x} y={y} fontSize={10} textAnchor="middle" dominantBaseline="middle" fill="#475569">{a}</text>
          </g>
        );
      })}
      {target && <polygon points={poly(target)} fill="none" stroke="#10b981" strokeDasharray="4 3" strokeWidth={1.5} />}
      <polygon points={poly(values)} fill="rgba(99,102,241,.25)" stroke="#6366f1" strokeWidth={2} />
    </svg>
  );
}
