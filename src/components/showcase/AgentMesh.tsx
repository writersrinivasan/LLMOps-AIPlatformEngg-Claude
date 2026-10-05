"use client";
import { useEffect, useState } from "react";
import { EDGES, MeshNode, NodeId, NODES } from "@/lib/showcase/data";

export interface MeshParticle { id: number; from: NodeId; to: NodeId; t0: number; dur: number; color: string; size: number; blocked?: boolean }
export interface MeshSource { particles: MeshParticle[]; nodeHits: Partial<Record<NodeId, number>> }
export interface NodeBadge { text: string; hex: string; pulse?: boolean }

const NW = 108;
const NH = 54;
const byId = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<NodeId, MeshNode>;

function ctrl(a: MeshNode, b: MeshNode) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 30) return [a.x, a.y + dy * 0.5, b.x, b.y - dy * 0.5];
  return [a.x + dx * 0.5, a.y, b.x - dx * 0.5, b.y];
}
const pathOf = (a: MeshNode, b: MeshNode) => {
  const [c1x, c1y, c2x, c2y] = ctrl(a, b);
  return `M${a.x},${a.y} C${c1x},${c1y} ${c2x},${c2y} ${b.x},${b.y}`;
};
function pointAt(a: MeshNode, b: MeshNode, t: number) {
  const [c1x, c1y, c2x, c2y] = ctrl(a, b);
  const u = 1 - t;
  return [
    u * u * u * a.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * b.x,
    u * u * u * a.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * b.y,
  ];
}

/** Animated multi-agent topology. Reads particles from `source` every animation frame. */
export function AgentMesh({ source, badges = {}, counts = {}, active, dimIdle, height }: { source: MeshSource; badges?: Partial<Record<NodeId, NodeBadge>>; counts?: Partial<Record<NodeId, number>>; active?: Set<NodeId>; dimIdle?: boolean; height?: number }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 30) { last = t; setNow(Date.now()); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const glow = (id: NodeId) => {
    const h = source.nodeHits[id];
    if (!h || now < h) return 0;
    return Math.max(0, 1 - (now - h) / 700);
  };

  return (
    <svg viewBox="0 0 1010 470" className="w-full select-none" style={height ? { height } : undefined}>
      <defs>
        <radialGradient id="pglow">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(148,163,184,.12)" />
        </pattern>
      </defs>
      <rect width="1010" height="470" fill="url(#grid)" />

      {/* zone labels */}
      <text x={418} y={466} textAnchor="middle" fontSize={10} fill="#64748b" letterSpacing={2}>CONTROL PLANE</text>
      <text x={560} y={18} textAnchor="middle" fontSize={10} fill="#64748b" letterSpacing={2}>SPECIALIST AGENTS (PARALLEL)</text>
      <rect x={500} y={34} width={120} height={392} rx={18} fill="rgba(167,139,250,.04)" stroke="rgba(167,139,250,.15)" strokeDasharray="4 6" />

      {EDGES.map(([f, t]) => {
        const a = byId[f], b = byId[t];
        const hot = active ? active.has(f) && active.has(t) : false;
        return (
          <g key={f + t}>
            <path d={pathOf(a, b)} fill="none" stroke="rgba(148,163,184,.16)" strokeWidth={1.5} />
            <path d={pathOf(a, b)} fill="none" stroke={hot ? b.hex : "rgba(148,163,184,.22)"} strokeWidth={hot ? 2.5 : 1} className="flow-dash" style={hot ? { filter: `drop-shadow(0 0 4px ${b.hex})` } : undefined} />
          </g>
        );
      })}

      {source.particles.map((p) => {
        const k = (now - p.t0) / p.dur;
        if (k < 0 || k > 1) return null;
        const [x, y] = pointAt(byId[p.from], byId[p.to], p.blocked ? Math.min(k, 0.82) : k);
        return (
          <g key={p.id}>
            <circle cx={x} cy={y} r={p.size * 2.6} fill={p.color} opacity={0.18} />
            <circle cx={x} cy={y} r={p.size} fill={p.color} style={{ filter: `drop-shadow(0 0 5px ${p.color})` }} />
          </g>
        );
      })}

      {NODES.map((n) => {
        const g = glow(n.id);
        const isActive = active?.has(n.id);
        const badge = badges[n.id];
        const ring = badge?.hex ?? n.hex;
        const faded = dimIdle && active && !isActive;
        const intensity = Math.max(g, isActive ? 0.85 : 0);
        return (
          <g key={n.id} transform={`translate(${n.x - NW / 2},${n.y - NH / 2})`} opacity={faded ? 0.35 : 1} style={{ transition: "opacity .4s" }}>
            <rect
              width={NW} height={NH} rx={14}
              fill="#0b1224" stroke={ring} strokeOpacity={0.35 + intensity * 0.65 + (badge ? 0.4 : 0)} strokeWidth={1.5 + intensity * 1.5}
              style={{ filter: intensity > 0.05 || badge ? `drop-shadow(0 0 ${6 + intensity * 14}px ${ring})` : undefined }}
            />
            <rect width={NW} height={NH} rx={14} fill={n.hex} opacity={0.06 + intensity * 0.18} />
            {n.kind === "human" && <rect x={-3} y={-3} width={NW + 6} height={NH + 6} rx={16} fill="none" stroke={n.hex} strokeOpacity={0.4} strokeDasharray="3 4" />}
            <text x={12} y={23} fontSize={17}>{n.icon}</text>
            <text x={34} y={22} fontSize={11.5} fontWeight={700} fill="#f1f5f9">{n.label}</text>
            <text x={34} y={36} fontSize={8.5} fill="#94a3b8">{n.sub}</text>
            {counts[n.id] !== undefined && (
              <text x={NW - 8} y={48} fontSize={8.5} textAnchor="end" fill={n.hex} fontFamily="var(--font-geist-mono)">{counts[n.id]!.toLocaleString("en-IN")}</text>
            )}
            {badge && (
              <g transform={`translate(${NW / 2},${-6})`}>
                <rect x={-badge.text.length * 3.1 - 6} y={-8} width={badge.text.length * 6.2 + 12} height={15} rx={7.5} fill={badge.hex} className={badge.pulse ? "animate-pulse" : undefined} />
                <text textAnchor="middle" y={3} fontSize={8.5} fontWeight={800} fill="#0b1020">{badge.text}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
