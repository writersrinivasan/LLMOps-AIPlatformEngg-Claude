"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge, Background, Connection, Controls, Edge, Handle, MarkerType, Node, NodeProps, Position,
  ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CheckCircle2, Circle, Eye, RotateCcw, Trash2 } from "lucide-react";
import { Btn, cx } from "@/components/ui";

export interface PaletteItem { type: string; label: string; group: string; color: string }

export interface Graph {
  has: (type: string) => boolean;
  count: (type: string) => number;
  linked: (a: string, b: string) => boolean; // any path between a node of type a and a node of type b
  edge: (a: string, b: string) => boolean; // direct edge either direction
}

export interface Requirement { id: string; label: string; hint: string; check: (g: Graph) => boolean }

type ArchNodeData = { label: string; color: string; type: string };

function ArchNode({ data, selected }: NodeProps<Node<ArchNodeData>>) {
  return (
    <div className={cx("rounded-lg border-2 bg-white px-3 py-2 text-xs font-semibold shadow-sm", selected && "ring-2 ring-indigo-400")} style={{ borderColor: data.color, minWidth: 120 }}>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-slate-400" />
      <Handle type="target" position={Position.Left} id="l" className="!h-2 !w-2 !bg-slate-400" />
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: data.color }} />
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-slate-600" />
      <Handle type="source" position={Position.Right} id="r" className="!h-2 !w-2 !bg-slate-600" />
    </div>
  );
}

const nodeTypes = { arch: ArchNode };
const edgeDefaults = { type: "smoothstep", animated: true, markerEnd: { type: MarkerType.ArrowClosed } };

function buildGraph(nodes: Node<ArchNodeData>[], edges: Edge[]): Graph {
  const typeOf = new Map(nodes.map((n) => [n.id, n.data.type]));
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    adj.set(e.source, [...(adj.get(e.source) ?? []), e.target]);
    adj.set(e.target, [...(adj.get(e.target) ?? []), e.source]);
  }
  const reach = (start: string) => {
    const seen = new Set([start]);
    const q = [start];
    while (q.length) for (const nb of adj.get(q.shift()!) ?? []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
    return seen;
  };
  return {
    has: (t) => nodes.some((n) => n.data.type === t),
    count: (t) => nodes.filter((n) => n.data.type === t).length,
    linked: (a, b) => nodes.filter((n) => n.data.type === a).some((n) => [...reach(n.id)].some((id) => id !== n.id && typeOf.get(id) === b)),
    edge: (a, b) => edges.some((e) => (typeOf.get(e.source) === a && typeOf.get(e.target) === b) || (typeOf.get(e.source) === b && typeOf.get(e.target) === a)),
  };
}

export interface Solution { nodes: { type: string; x: number; y: number }[]; edges: [number, number][] }

function Inner({ palette, requirements, solution, storageKey, height }: { palette: PaletteItem[]; requirements: Requirement[]; solution?: Solution; storageKey: string; height: number }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ArchNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loaded, setLoaded] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  const byType = useMemo(() => new Map(palette.map((p) => [p.type, p])), [palette]);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (s) { setNodes(s.nodes); setEdges(s.edges); }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(true);
  }, [storageKey, setNodes, setEdges]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ nodes, edges })); } catch { /* ignore */ }
  }, [nodes, edges, loaded, storageKey]);

  const addNode = useCallback((type: string, pos?: { x: number; y: number }) => {
    const p = byType.get(type)!;
    setNodes((ns) => [...ns, { id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: "arch", position: pos ?? { x: 80 + (ns.length % 4) * 170, y: 40 + Math.floor(ns.length / 4) * 90 }, data: { label: p.label, color: p.color, type } }]);
  }, [byType, setNodes]);

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, ...edgeDefaults }, es)), [setEdges]);

  const loadSolution = () => {
    if (!solution) return;
    const ns = solution.nodes.map((n, i) => {
      const p = byType.get(n.type)!;
      return { id: `sol-${i}`, type: "arch", position: { x: n.x, y: n.y }, data: { label: p.label, color: p.color, type: n.type } };
    });
    setNodes(ns);
    setEdges(solution.edges.map(([a, b], i) => ({ id: `se-${i}`, source: `sol-${a}`, target: `sol-${b}`, ...edgeDefaults })));
  };

  const g = buildGraph(nodes, edges);
  const results = requirements.map((r) => ({ ...r, ok: r.check(g) }));
  const score = results.filter((r) => r.ok).length / results.length;
  const groups = [...new Set(palette.map((p) => p.group))];

  return (
    <div className="grid gap-3 xl:grid-cols-[200px_1fr_280px]">
      <div className="scrollbar-thin space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3" style={{ maxHeight: height }}>
        <div className="text-[11px] text-slate-500">Drag onto the canvas or click to add. Connect handles to draw data flow. Select a node and press Backspace to delete it.</div>
        {groups.map((gname) => (
          <div key={gname}>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{gname}</div>
            <div className="space-y-1">
              {palette.filter((p) => p.group === gname).map((p) => (
                <div
                  key={p.type}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("application/arch", p.type)}
                  onClick={() => addNode(p.type)}
                  className="flex cursor-grab items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 active:cursor-grabbing"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                  {p.label}
                  {g.has(p.type) && <CheckCircle2 size={11} className="ml-auto text-emerald-500" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ height }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
        e.preventDefault();
        const t = e.dataTransfer.getData("application/arch");
        if (t) addNode(t, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
      }}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} fitView defaultEdgeOptions={edgeDefaults} deleteKeyCode={["Backspace", "Delete"]}>
          <Background gap={16} color="#e2e8f0" />
          <Controls />
        </ReactFlow>
      </div>
      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Requirement checker</span>
            <span className={cx("text-lg font-bold", score === 1 ? "text-emerald-600" : score > 0.6 ? "text-amber-600" : "text-slate-500")}>{Math.round(score * 100)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className={cx("h-full transition-all", score === 1 ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: `${score * 100}%` }} /></div>
          <ul className="mt-3 space-y-2">
            {results.map((r) => (
              <li key={r.id} className="flex gap-2 text-xs">
                {r.ok ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600" /> : <Circle size={15} className="shrink-0 text-slate-300" />}
                <span>
                  <span className={cx("font-medium", r.ok ? "text-slate-800" : "text-slate-600")}>{r.label}</span>
                  {!r.ok && <span className="block text-slate-400">{r.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" variant="secondary" onClick={() => { setNodes([]); setEdges([]); }}><RotateCcw size={13} />Reset</Btn>
          <Btn size="sm" variant="secondary" onClick={() => setEdges([])}><Trash2 size={13} />Clear links</Btn>
          {solution && <Btn size="sm" variant="ghost" onClick={loadSolution}><Eye size={13} />Reference design</Btn>}
        </div>
      </div>
    </div>
  );
}

export function ArchCanvas(props: { palette: PaletteItem[]; requirements: Requirement[]; solution?: Solution; storageKey: string; height?: number }) {
  return (
    <ReactFlowProvider>
      <Inner {...props} height={props.height ?? 520} />
    </ReactFlowProvider>
  );
}
