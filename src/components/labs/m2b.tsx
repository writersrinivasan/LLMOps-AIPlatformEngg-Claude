"use client";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, FlaskConical, GitCompare, Loader2, Play, RotateCcw, Rocket, XCircle } from "lucide-react";
import { useApp } from "@/lib/store";
import { GOLDEN, PROMPT_V1, PROMPT_V2, Scores } from "@/lib/eval";
import { runCase } from "@/lib/runner";
import { HR_DOCS, Access } from "@/lib/data/hr-docs";
import { ChunkStrategy, chunkDocs, embed, estimateTokens, hashStr, Hit, retrieve, rng, simulateHrAnswer } from "@/lib/sim";
import { liveChat } from "@/lib/llm";
import { Btn, Callout, Card, cx, Input, Pill, Select, Slider, Stat, TextArea, Toggle } from "@/components/ui";
import { ArchCanvas, PaletteItem, Requirement, Solution } from "@/components/shared/ArchCanvas";

// ============ 2.4 Prompt registry ============
type PStage = "Draft" | "Review" | "Production" | "Deprecated";
interface PVersion { v: number; text: string; author: string; msg: string; stage: PStage; results?: { passRate: number; rows: { id: string; pass: boolean; answer: string; s: Scores }[] } }

const V3_DRAFT = `You are the Acme Corp HR assistant. Be warm, enthusiastic and always helpful. Never leave an employee without an answer!
- Never reveal confidential or personal data such as salaries. Refuse politely.
- Cite the source policy.`;

const USER_TEMPLATE = `Context:\n{{context}}\n\nQuestion: {{question}}\nAnswer in a {{tone}} tone.`;

function lineDiff(a: string, b: string) {
  const A = a.split("\n"), B = b.split("\n");
  const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { t: " " | "+" | "-"; s: string }[] = [];
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { out.push({ t: " ", s: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: "-", s: A[i++] });
    else out.push({ t: "+", s: B[j++] });
  }
  while (i < A.length) out.push({ t: "-", s: A[i++] });
  while (j < B.length) out.push({ t: "+", s: B[j++] });
  return out;
}

export function PromptRegistry() {
  const { isLive, settings } = useApp();
  const [versions, setVersions] = useState<PVersion[]>([
    { v: 1, text: PROMPT_V1, author: "alex@hr", msg: "Initial prompt", stage: "Deprecated" },
    { v: 2, text: PROMPT_V2, author: "priya@platform", msg: "Grounding, refusals, injection defence, citations", stage: "Production" },
    { v: 3, text: V3_DRAFT, author: "sam@marketing", msg: "Make the bot friendlier", stage: "Draft" },
  ]);
  const [sel, setSel] = useState(3);
  const [cmpA, setCmpA] = useState(2);
  const [cmpB, setCmpB] = useState(3);
  const [running, setRunning] = useState<number | null>(null);
  const [audit, setAudit] = useState<string[]>(["v2 promoted to Production by priya@platform", "v1 created by alex@hr"]);
  const [vars, setVars] = useState({ question: "How many leave days can I carry forward?", tone: "friendly" });
  const [split, setSplit] = useState(20);
  const [exp, setExp] = useState<{ a: number; b: number } | null>(null);

  const cur = versions.find((v) => v.v === sel)!;
  const prod = versions.find((v) => v.stage === "Production");
  const update = (v: number, patch: Partial<PVersion>) => setVersions((vs) => vs.map((x) => (x.v === v ? { ...x, ...patch } : x)));
  const log = (s: string) => setAudit((a) => [s, ...a]);

  const runTests = async (v: number) => {
    setRunning(v);
    const text = versions.find((x) => x.v === v)!.text;
    const rows = [];
    for (const tc of GOLDEN) {
      const { run, scores } = await runCase(tc, text, { live: isLive, settings, seed: 7 });
      rows.push({ id: tc.id, pass: scores.pass, answer: run.answer, s: scores });
    }
    update(v, { results: { passRate: rows.filter((r) => r.pass).length / rows.length, rows } });
    log(`Tests run on v${v}: ${rows.filter((r) => r.pass).length}/${rows.length} passed${isLive ? " (LIVE)" : ""}`);
    setRunning(null);
  };

  const promote = (v: PVersion) => {
    if (v.stage === "Draft") {
      if (!v.results) return log(`✗ v${v.v}: run the tests before requesting review`);
      update(v.v, { stage: "Review" });
      return log(`v${v.v} submitted for review`);
    }
    if (v.stage === "Review") {
      if (prod?.results && v.results && v.results.passRate < prod.results.passRate) return log(`✗ v${v.v} BLOCKED: pass rate ${Math.round(v.results.passRate * 100)}% < production v${prod.v} ${Math.round(prod.results.passRate * 100)}%`);
      if (!prod?.results) return log(`✗ Run tests on production v${prod?.v} too, so there is a baseline to compare against`);
      setVersions((vs) => vs.map((x) => (x.v === v.v ? { ...x, stage: "Production" } : x.stage === "Production" ? { ...x, stage: "Deprecated" } : x)));
      return log(`✓ v${v.v} promoted to Production`);
    }
  };

  const rollback = () => {
    if (!prod) return;
    const prev = [...versions].filter((x) => x.v < prod.v && x.stage === "Deprecated").sort((a, b) => b.v - a.v)[0];
    if (!prev) return;
    setVersions((vs) => vs.map((x) => (x.v === prev.v ? { ...x, stage: "Production" } : x.v === prod.v ? { ...x, stage: "Deprecated" } : x)));
    log(`↺ Rolled back Production from v${prod.v} to v${prev.v}`);
  };

  const newVersion = () => {
    const v = Math.max(...versions.map((x) => x.v)) + 1;
    setVersions([...versions, { v, text: cur.text, author: "you", msg: `Fork of v${cur.v}`, stage: "Draft" }]);
    setSel(v);
    log(`v${v} created from v${cur.v}`);
  };

  const runExperiment = () => {
    const A = versions.find((x) => x.v === cmpA)?.results?.passRate ?? 0.7;
    const B = versions.find((x) => x.v === cmpB)?.results?.passRate ?? 0.7;
    const r = rng(split + cmpA * 7 + cmpB * 13);
    const n = 1000;
    let aUp = 0, aN = 0, bUp = 0, bN = 0;
    for (let i = 0; i < n; i++) {
      if (r() * 100 < split) { bN++; if (r() < 0.35 + B * 0.55) bUp++; } else { aN++; if (r() < 0.35 + A * 0.55) aUp++; }
    }
    setExp({ a: aN ? aUp / aN : 0, b: bN ? bUp / bN : 0 });
  };

  const stageColor: Record<PStage, "slate" | "amber" | "green" | "red"> = { Draft: "slate", Review: "amber", Production: "green", Deprecated: "red" };
  const diff = lineDiff(versions.find((x) => x.v === cmpA)?.text ?? "", versions.find((x) => x.v === cmpB)?.text ?? "");
  const rendered = USER_TEMPLATE.replace("{{context}}", "[1] Annual Leave Policy: Up to 5 unused leave days can be carried forward…").replace("{{question}}", vars.question).replace("{{tone}}", vars.tone);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <Card title="hr-assistant/system" right={<Btn size="sm" variant="secondary" onClick={newVersion}>+ New version</Btn>} pad={false}>
          <div className="divide-y divide-slate-100">
            {[...versions].reverse().map((v) => (
              <button type="button" key={v.v} onClick={() => setSel(v.v)} className={cx("block w-full px-3 py-2 text-left", sel === v.v && "bg-blue-50")}>
                <div className="flex items-center justify-between"><span className="font-mono text-sm font-bold">v{v.v}</span><Pill color={stageColor[v.stage]}>{v.stage}</Pill></div>
                <div className="truncate text-xs text-slate-600">{v.msg}</div>
                <div className="flex justify-between text-[11px] text-slate-400"><span>{v.author}</span>{v.results && <span className={v.results.passRate >= 0.99 ? "text-emerald-600" : "text-rose-600"}>tests {Math.round(v.results.passRate * 100)}%</span>}</div>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 p-3">
            <div className="mb-1 text-[10px] font-bold uppercase text-slate-400">Lifecycle</div>
            <div className="flex items-center gap-1 text-[10px]">{(["Draft", "Review", "Production", "Deprecated"] as PStage[]).map((s, i) => <span key={s} className="flex items-center gap-1"><Pill color={cur.stage === s ? stageColor[s] : "slate"} className={cur.stage === s ? "" : "opacity-40"}>{s}</Pill>{i < 3 && <ArrowRight size={10} className="text-slate-300" />}</span>)}</div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card title={`Editing v${cur.v} · ${cur.stage}`} right={
            <div className="flex gap-1.5">
              <Btn size="sm" variant="secondary" onClick={() => runTests(cur.v)} disabled={running !== null}>{running === cur.v ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />}Run {GOLDEN.length} tests{isLive && " (LIVE)"}</Btn>
              {(cur.stage === "Draft" || cur.stage === "Review") && <Btn size="sm" onClick={() => promote(cur)}><Rocket size={13} />{cur.stage === "Draft" ? "Submit for review" : "Promote to Prod"}</Btn>}
              {cur.stage === "Production" && <Btn size="sm" variant="danger" onClick={rollback}><RotateCcw size={13} />Roll back</Btn>}
            </div>
          }>
            <TextArea value={cur.text} onChange={(t) => update(cur.v, { text: t, results: undefined })} rows={7} mono className={cur.stage !== "Draft" ? "bg-slate-50" : ""} />
            {cur.stage !== "Draft" && <div className="mt-1 text-[11px] text-amber-700">Versions past Draft are immutable in real registries. Create a new version to change them.</div>}
            {cur.results && (
              <div className="mt-3 grid gap-1.5 md:grid-cols-2">
                {cur.results.rows.map((r) => {
                  const tc = GOLDEN.find((g) => g.id === r.id)!;
                  return (
                    <div key={r.id} className={cx("rounded-md border px-2 py-1.5 text-[11px]", r.pass ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50")} title={r.answer}>
                      <div className="flex items-center gap-1 font-semibold">{r.pass ? <CheckCircle2 size={12} className="text-emerald-600" /> : <XCircle size={12} className="text-rose-600" />}{tc.query}</div>
                      <div className="text-slate-600">{r.pass ? `expected: ${tc.behavior} ✓` : r.s.reasons[0]}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Prompt template: variables & rendered preview">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <pre className="rounded bg-slate-900 p-2 font-mono text-[11px] text-emerald-300">{USER_TEMPLATE}</pre>
                <Input value={vars.question} onChange={(v) => setVars({ ...vars, question: v })} className="text-xs" />
                <Select label="{{tone}}" value={vars.tone} options={["friendly", "formal", "concise"]} onChange={(v) => setVars({ ...vars, tone: v })} />
              </div>
              <pre className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 font-mono text-[11px]">{`SYSTEM (v${cur.v}):\n${cur.text}\n\nUSER:\n${rendered}`}</pre>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-1.5"><GitCompare size={14} />Diff</span>} right={<div className="flex items-center gap-1 text-xs"><VersionPick vs={versions} v={cmpA} set={setCmpA} />→<VersionPick vs={versions} v={cmpB} set={setCmpB} /></div>}>
          <pre className="max-h-56 overflow-auto font-mono text-[11px]">
            {diff.map((d, i) => <div key={i} className={d.t === "+" ? "bg-emerald-50 text-emerald-800" : d.t === "-" ? "bg-rose-50 text-rose-800" : "text-slate-500"}>{d.t} {d.s}</div>)}
          </pre>
        </Card>
        <Card title="A/B experiment (simulated 1,000 users)">
          <Slider label={`Traffic to v${cmpB}`} value={split} min={0} max={100} step={5} onChange={setSplit} fmt={(v) => `${v}%`} />
          <Btn className="mt-2" size="sm" onClick={runExperiment}><Play size={13} />Run experiment</Btn>
          {exp && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label={`v${cmpA} 👍 rate`} value={`${Math.round(exp.a * 100)}%`} />
              <Stat label={`v${cmpB} 👍 rate`} value={`${Math.round(exp.b * 100)}%`} tone={exp.b < exp.a ? "red" : "green"} />
            </div>
          )}
          <div className="mt-2 text-[11px] text-slate-500">The thumbs-up rate follows each version&apos;s test pass rate. Run the tests for both versions first.</div>
        </Card>
      </div>
      <Card title="Audit trail"><div className="max-h-32 space-y-0.5 overflow-y-auto font-mono text-[11px] text-slate-600">{audit.map((a, i) => <div key={i}>{a}</div>)}</div></Card>
    </div>
  );
}

function VersionPick({ vs, v, set }: { vs: PVersion[]; v: number; set: (n: number) => void }) {
  return <select value={v} onChange={(e) => set(+e.target.value)} className="rounded border border-slate-300 px-1 py-0.5 text-xs">{vs.map((x) => <option key={x.v} value={x.v}>v{x.v}</option>)}</select>;
}

// ============ 2.5 RAG playground ============
const SAMPLE_Q = ["How many unused leave days can I carry forward?", "What is the meal allowance for international trips?", "How long is paternity leave?", "What are the salary bands for L5?", "Can I work from another country?"];
const DOC_COLORS = ["#2563eb", "#059669", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#65a30d", "#dc2626", "#4f46e5", "#be123c", "#64748b"];

export function RagPlayground() {
  const { isLive, settings } = useApp();
  const [strategy, setStrategy] = useState<ChunkStrategy>("fixed");
  const [size, setSize] = useState(40);
  const [ov, setOv] = useState(8);
  const [topK, setTopK] = useState(3);
  const [rerank, setRerank] = useState(false);
  const [accessFilter, setAccessFilter] = useState(false);
  const [role, setRole] = useState<Access>("all");
  const [dept, setDept] = useState("Any");
  const [region, setRegion] = useState("Any");
  const [q, setQ] = useState(SAMPLE_Q[0]);
  const [viewDoc, setViewDoc] = useState("leave");
  const [answer, setAnswer] = useState<{ text: string; live: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const chunks = useMemo(() => chunkDocs(HR_DOCS, size, Math.min(ov, size - 1), strategy), [size, ov, strategy]);
  const res = useMemo(() => retrieve(q, chunks, { topK, rerank, accessFilter, userAccess: role, dept, region }), [q, chunks, topK, rerank, accessFilter, role, dept, region]);
  const denseOrder = useMemo(() => res.all.filter((h) => !h.filtered).map((h) => h.chunk.id), [res]);
  const ctx = res.hits.map((h, i) => `[${i + 1}] ${h.chunk.title}: ${h.chunk.text}`).join("\n");
  const ctxTokens = estimateTokens(ctx);
  const leaked = res.hits.some((h) => h.chunk.access !== "all" && role === "all");

  // 2D projection of the embedding space
  const proj = useMemo(() => {
    const r = rng(42);
    const p1 = Array.from({ length: 64 }, () => r() - 0.5), p2 = Array.from({ length: 64 }, () => r() - 0.5);
    const pts = chunks.map((c) => ({ c, x: c.vec.reduce((a, v, i) => a + v * p1[i], 0), y: c.vec.reduce((a, v, i) => a + v * p2[i], 0) }));
    const qv = embed(q);
    const qp = { x: qv.reduce((a, v, i) => a + v * p1[i], 0), y: qv.reduce((a, v, i) => a + v * p2[i], 0) };
    const xs = [...pts.map((p) => p.x), qp.x], ys = [...pts.map((p) => p.y), qp.y];
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const nx = (x: number) => 20 + ((x - x0) / (x1 - x0 || 1)) * 360, ny = (y: number) => 15 + ((y - y0) / (y1 - y0 || 1)) * 190;
    return { pts: pts.map((p) => ({ ...p, x: nx(p.x), y: ny(p.y) })), q: { x: nx(qp.x), y: ny(qp.y) } };
  }, [chunks, q]);
  const hitIds = new Set(res.hits.map((h) => h.chunk.id));
  const docIdx = (id: string) => HR_DOCS.findIndex((d) => d.id === id);

  const generate = async () => {
    setBusy(true);
    const contexts = res.hits.map((h) => ({ title: h.chunk.title, text: h.chunk.text, docId: h.chunk.docId }));
    if (isLive) {
      const r = await liveChat(settings, { messages: [{ role: "system", content: PROMPT_V2 }, { role: "user", content: `Context:\n${ctx}\n\nQuestion: ${q}` }], max_tokens: 250 });
      setAnswer({ text: r.error ? `ERROR: ${r.error}` : r.content, live: true });
    } else {
      const sys = PROMPT_V2.replace("- Never reveal confidential or personal data such as salaries, phone numbers or emails. Refuse politely.\n", "");
      await new Promise((r) => setTimeout(r, 400));
      setAnswer({ text: simulateHrAnswer({ question: q, systemPrompt: sys, contexts, seed: hashStr(q) }).text, live: false });
    }
    setBusy(false);
  };

  const stages = [
    { n: "Documents", v: `${HR_DOCS.length} docs` },
    { n: "Chunker", v: `${chunks.length} chunks` },
    { n: "Embeddings", v: "64-dim" },
    { n: "Vector DB", v: `${chunks.length} vectors` },
    { n: "Filter", v: accessFilter || dept !== "Any" || region !== "Any" ? `${res.all.filter((h) => h.filtered).length} removed` : "off" },
    { n: "Retriever", v: `top-${topK}` },
    { n: "Reranker", v: rerank ? "on" : "off" },
    { n: "Context", v: `${ctxTokens} tok` },
    { n: "LLM", v: isLive ? "LIVE" : "sim" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
        {stages.map((s, i) => (
          <div key={s.n} className="flex items-center gap-1">
            <div className="min-w-[88px] rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-center">
              <div className="text-[11px] font-semibold text-blue-900">{s.n}</div>
              <div className="font-mono text-[10px] text-blue-600">{s.v}</div>
            </div>
            {i < stages.length - 1 && <ArrowRight size={14} className="shrink-0 text-blue-300" />}
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr_1fr]">
        <Card title="Pipeline settings">
          <div className="space-y-3">
            <Select<ChunkStrategy> label="Chunking strategy" value={strategy} onChange={setStrategy} options={[{ value: "fixed", label: "Fixed-size (words)" }, { value: "sentence", label: "Sentence-aware" }]} />
            <Slider label="Chunk size" value={size} min={8} max={120} onChange={setSize} fmt={(v) => `${v} words`} />
            <Slider label="Overlap" value={ov} min={0} max={30} onChange={setOv} fmt={(v) => `${v} words`} />
            <Slider label="Top-k" value={topK} min={1} max={8} onChange={setTopK} />
            <Toggle label="Reranker" hint="Cross-encoder re-scores 3×k candidates" checked={rerank} onChange={setRerank} />
            <div className="border-t border-slate-100 pt-3">
              <div className="mb-2 text-xs font-semibold text-slate-700">Metadata filtering</div>
              <Toggle label="Enforce document access level" checked={accessFilter} onChange={setAccessFilter} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Select<Access> label="User role" value={role} onChange={setRole} options={[{ value: "all", label: "Employee" }, { value: "manager", label: "Manager" }, { value: "hr", label: "HR admin" }]} />
                <Select label="Dept" value={dept} onChange={setDept} options={["Any", "HR", "Finance", "Legal"]} />
                <Select label="Region" value={region} onChange={setRegion} options={["Any", "India", "US"]} />
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card title="Query">
            <div className="flex gap-2"><Input value={q} onChange={setQ} /><Btn onClick={generate} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}Ask</Btn></div>
            <div className="mt-2 flex flex-wrap gap-1">{SAMPLE_Q.map((s) => <button type="button" key={s} onClick={() => setQ(s)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200">{s}</button>)}</div>
          </Card>
          <Card title={`Retrieved chunks (top-${topK})`}>
            <div className="space-y-1.5">
              {res.hits.map((h: Hit, i) => {
                const before = denseOrder.indexOf(h.chunk.id);
                return (
                  <div key={h.chunk.id} className={cx("rounded-md border p-2 text-xs", h.chunk.access !== "all" ? "border-rose-300 bg-rose-50" : "border-slate-200")}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: DOC_COLORS[docIdx(h.chunk.docId)] }} />
                      <b>#{i + 1}</b><span className="font-semibold">{h.chunk.title}</span>
                      {h.chunk.access !== "all" && <Pill color="red">{h.chunk.access}-only</Pill>}
                      {rerank && before !== i && <Pill color="violet">was #{before + 1}</Pill>}
                      <span className="ml-auto font-mono text-slate-500">{(h.rerankScore ?? h.score).toFixed(3)}</span>
                    </div>
                    <div className="mt-1 text-slate-600">{h.chunk.text}</div>
                  </div>
                );
              })}
            </div>
            {leaked && <div className="mt-2"><Callout tone="bad" title="Insecure RAG">An <b>Employee</b> just retrieved restricted content. Turn on access-level filtering.</Callout></div>}
          </Card>
          <Card title="Answer" right={answer && <Pill color={answer.live ? "green" : "slate"}>{answer.live ? "LIVE" : "simulated"}</Pill>}>
            <div className="text-sm text-slate-800">{answer?.text ?? <span className="text-slate-400">Click Ask to generate from the retrieved context.</span>}</div>
          </Card>
        </div>

        <div className="space-y-3">
          <Card title="Embedding space (2D projection)">
            <svg viewBox="0 0 400 220" className="w-full rounded bg-slate-50">
              {proj.pts.filter((p) => hitIds.has(p.c.id)).map((p) => <line key={"l" + p.c.id} x1={proj.q.x} y1={proj.q.y} x2={p.x} y2={p.y} stroke="#2563eb" strokeWidth={1} strokeDasharray="3 2" />)}
              {proj.pts.map((p) => {
                const filtered = res.all.find((h) => h.chunk.id === p.c.id)?.filtered;
                return <circle key={p.c.id} cx={p.x} cy={p.y} r={hitIds.has(p.c.id) ? 6 : 3.5} fill={DOC_COLORS[docIdx(p.c.docId)]} opacity={filtered ? 0.15 : hitIds.has(p.c.id) ? 1 : 0.55} stroke={hitIds.has(p.c.id) ? "#0f172a" : "none"}><title>{p.c.title}: {p.c.text.slice(0, 80)}</title></circle>;
              })}
              <g transform={`translate(${proj.q.x},${proj.q.y})`}><polygon points="0,-9 8,6 -8,6" fill="#0f172a" /><text y={18} textAnchor="middle" fontSize={9} fontWeight={700}>query</text></g>
            </svg>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-500">{HR_DOCS.map((d, i) => <span key={d.id} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: DOC_COLORS[i] }} />{d.title.replace(/ \(.*\)/, "")}</span>)}</div>
          </Card>
          <Card title="Chunk boundaries" right={<select value={viewDoc} onChange={(e) => setViewDoc(e.target.value)} className="rounded border border-slate-300 px-1 text-xs">{HR_DOCS.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select>}>
            <div className="space-y-1 text-[11px] leading-relaxed">
              {chunks.filter((c) => c.docId === viewDoc).map((c, i) => (
                <div key={c.id} className={cx("rounded px-1.5 py-1", i % 2 ? "bg-amber-50" : "bg-sky-50", hitIds.has(c.id) && "ring-2 ring-blue-500")}>
                  <span className="mr-1 font-mono text-[10px] text-slate-400">#{i}</span>{c.text}
                </div>
              ))}
            </div>
          </Card>
          <Card title="Context construction">
            <div className="mb-1 flex justify-between text-xs"><span>Context tokens</span><span className="font-mono">{ctxTokens} / 1,000 budget</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={cx("h-full", ctxTokens > 1000 ? "bg-rose-500" : "bg-blue-500")} style={{ width: `${Math.min(100, ctxTokens / 10)}%` }} /></div>
            <pre className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap rounded bg-slate-900 p-2 font-mono text-[10px] text-slate-100">{ctx}</pre>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============ 2.6 HR architecture exercise ============
const HR_PALETTE: PaletteItem[] = [
  { type: "ui", label: "Employee UI (Web/Slack)", group: "Clients", color: "#64748b" },
  { type: "sso", label: "SSO / Identity Provider", group: "Security", color: "#e11d48" },
  { type: "guard", label: "Guardrails", group: "Security", color: "#be123c" },
  { type: "gateway", label: "AI Gateway", group: "Core", color: "#2563eb" },
  { type: "prompts", label: "Prompt Registry", group: "Core", color: "#4f46e5" },
  { type: "docs", label: "HR Document Store", group: "Knowledge", color: "#059669" },
  { type: "ingest", label: "Ingestion & Chunking", group: "Knowledge", color: "#10b981" },
  { type: "embed", label: "Embedding Model", group: "Knowledge", color: "#14b8a6" },
  { type: "vectordb", label: "Vector DB", group: "Knowledge", color: "#0d9488" },
  { type: "retriever", label: "Retriever + Reranker", group: "Knowledge", color: "#0f766e" },
  { type: "llmA", label: "LLM: Cloud Provider", group: "Models", color: "#7c3aed" },
  { type: "llmB", label: "LLM: Self-hosted", group: "Models", color: "#9333ea" },
  { type: "obs", label: "Tracing & Monitoring", group: "Operations", color: "#d97706" },
  { type: "eval", label: "Evaluation Service", group: "Operations", color: "#ca8a04" },
  { type: "cost", label: "Cost Tracker", group: "Operations", color: "#ea580c" },
];

const HR_REQS: Requirement[] = [
  { id: "docs", label: "Internal documents ingested", hint: "Docs → Ingestion → Embedding → Vector DB", check: (g) => g.has("ingest") && g.has("embed") && g.linked("docs", "vectordb") },
  { id: "rag", label: "RAG: retrieval feeds the LLM", hint: "Connect Retriever to Vector DB and to the Gateway/LLM path", check: (g) => g.edge("retriever", "vectordb") && (g.linked("retriever", "llmA") || g.linked("retriever", "llmB")) },
  { id: "multi", label: "Multiple LLMs behind the gateway", hint: "Gateway → both LLM nodes", check: (g) => g.edge("gateway", "llmA") && g.edge("gateway", "llmB") },
  { id: "auth", label: "Authentication", hint: "UI or Gateway connected to SSO", check: (g) => g.has("sso") && (g.edge("ui", "sso") || g.edge("gateway", "sso")) },
  { id: "direct", label: "No direct UI → LLM calls", hint: "UI must go through the Gateway", check: (g) => g.edge("ui", "gateway") && !g.edge("ui", "llmA") && !g.edge("ui", "llmB") },
  { id: "mon", label: "Monitoring", hint: "Tracing connected to the Gateway", check: (g) => g.edge("obs", "gateway") },
  { id: "eval", label: "Evaluation", hint: "Eval service linked to tracing or the gateway", check: (g) => g.edge("eval", "obs") || g.edge("eval", "gateway") },
  { id: "cost", label: "Cost tracking", hint: "Cost tracker fed by the gateway", check: (g) => g.edge("cost", "gateway") || g.edge("cost", "obs") },
];

const HR_SOLUTION: Solution = {
  nodes: [
    { type: "ui", x: 0, y: 0 }, { type: "sso", x: 230, y: -90 }, { type: "gateway", x: 230, y: 40 }, { type: "guard", x: 460, y: -90 },
    { type: "prompts", x: 460, y: 40 }, { type: "llmA", x: 120, y: 190 }, { type: "llmB", x: 330, y: 190 },
    { type: "retriever", x: 560, y: 190 }, { type: "vectordb", x: 560, y: 320 }, { type: "embed", x: 360, y: 320 }, { type: "ingest", x: 160, y: 320 }, { type: "docs", x: -40, y: 320 },
    { type: "obs", x: 700, y: 40 }, { type: "eval", x: 900, y: 0 }, { type: "cost", x: 900, y: 100 },
  ],
  edges: [[0, 2], [0, 1], [2, 1], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [7, 8], [9, 8], [10, 9], [11, 10], [2, 12], [12, 13], [12, 14]],
};

export function HrArchitecture() {
  return <ArchCanvas palette={HR_PALETTE} requirements={HR_REQS} solution={HR_SOLUTION} storageKey="arch.hr" />;
}
