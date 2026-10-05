// Deterministic simulator so every lab works offline with no API key.
import { ACCESS_RANK, Access, HR_DOCS, HrDoc } from "./data/hr-docs";

export const estimateTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Models / pricing (illustrative numbers, USD per 1M tokens) ----------
export interface ModelInfo {
  id: string;
  provider: string;
  kind: "Proprietary" | "Open-source" | "Fine-tuned";
  hosting: "Cloud API" | "Self-hosted" | "Local";
  inPrice: number;
  outPrice: number;
  latencyMs: number;
  quality: number; // 0..1
  context: number;
}

export const MODELS: ModelInfo[] = [
  { id: "frontier-xl", provider: "Provider A", kind: "Proprietary", hosting: "Cloud API", inPrice: 5, outPrice: 25, latencyMs: 2200, quality: 0.95, context: 200000 },
  { id: "balanced-m", provider: "Provider B", kind: "Proprietary", hosting: "Cloud API", inPrice: 1, outPrice: 5, latencyMs: 1100, quality: 0.89, context: 128000 },
  { id: "fast-s", provider: "Provider A", kind: "Proprietary", hosting: "Cloud API", inPrice: 0.15, outPrice: 0.6, latencyMs: 450, quality: 0.78, context: 128000 },
  { id: "llama-70b", provider: "Self-hosted K8s", kind: "Open-source", hosting: "Self-hosted", inPrice: 0.4, outPrice: 0.4, latencyMs: 1400, quality: 0.85, context: 128000 },
  { id: "hr-ft-8b", provider: "Local GPU", kind: "Fine-tuned", hosting: "Local", inPrice: 0.05, outPrice: 0.1, latencyMs: 300, quality: 0.83, context: 32000 },
];

export const modelById = (id: string) => MODELS.find((m) => m.id === id) ?? MODELS[1];

export function costUsd(modelId: string, inTok: number, outTok: number) {
  const m = modelById(modelId);
  return (inTok * m.inPrice + outTok * m.outPrice) / 1_000_000;
}

// ---------- Text processing / "embeddings" ----------
const STOP = new Set("a an the is are was were be to of and or in on for with at by from as it its this that i my me we our you your do does can how what when which who whom much many any per if into than then there their they them have has had will would should could may might not no yes about up over next get".split(" "));

const SYNONYMS: Record<string, string> = {
  vacation: "leave", holiday: "leave", holidays: "leave", pto: "leave", "time-off": "leave", off: "leave",
  maternity: "parental", paternity: "parental", baby: "parental", adoption: "adoptive",
  wfh: "remote", home: "remote", hybrid: "remote", office: "remote",
  quit: "resignation", resign: "resignation", leaving: "resignation", notice: "notice",
  pay: "salary", compensation: "salary", ctc: "salary", earn: "salary", earns: "salary", paid: "salary",
  insurance: "health", medical: "health", doctor: "health", hospital: "health",
  flight: "travel", trip: "travel", hotel: "travel", reimbursement: "expense", reimburse: "expense", claim: "expense",
  rollover: "carry", forward: "carry", carried: "carry", lapse: "carry", roll: "carry", rolls: "carry", unused: "carry", sick: "sick", ill: "sick",
  gym: "wellness", fitness: "wellness", review: "performance", appraisal: "performance", rating: "performance",
};

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => SYNONYMS[w] ?? w)
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w))
    .map((w) => (w.length > 6 && w.endsWith("ing") ? w.slice(0, -3) : w))
    .map((w) => SYNONYMS[w] ?? w);
}

export const EMBED_DIMS = 64;

export function embed(text: string): number[] {
  const v = new Array(EMBED_DIMS).fill(0);
  for (const t of tokenize(text)) {
    const h = hashStr(t);
    v[h % EMBED_DIMS] += 1;
    v[(h >>> 8) % EMBED_DIMS] += 0.5;
  }
  const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
  return v.map((x) => x / n);
}

export const cosine = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

export function overlap(a: string, b: string) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size) return 0;
  let hit = 0;
  ta.forEach((t) => tb.has(t) && hit++);
  return hit / ta.size;
}

export const sentences = (t: string) => t.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [t];

// ---------- Chunking & retrieval ----------
export interface Chunk {
  id: string;
  docId: string;
  title: string;
  text: string;
  access: Access;
  dept: HrDoc["dept"];
  region: HrDoc["region"];
  vec: number[];
}

export type ChunkStrategy = "fixed" | "sentence";

export function chunkDocs(docs: HrDoc[], chunkWords: number, overlapWords: number, strategy: ChunkStrategy = "fixed"): Chunk[] {
  const out: Chunk[] = [];
  const mk = (d: HrDoc, n: number, text: string) =>
    out.push({ id: `${d.id}#${n}`, docId: d.id, title: d.title, text, access: d.access, dept: d.dept, region: d.region, vec: embed(d.title + " " + text) });
  for (const d of docs) {
    if (strategy === "sentence") {
      // pack whole sentences up to chunkWords; carry the last sentence over when overlap > 0
      let cur: string[] = [];
      let n = 0;
      for (const s of sentences(d.text)) {
        const wc = cur.join(" ").split(/\s+/).filter(Boolean).length;
        if (cur.length && wc + s.split(/\s+/).length > chunkWords) {
          mk(d, n++, cur.join(" "));
          cur = overlapWords > 0 ? [cur[cur.length - 1]] : [];
        }
        cur.push(s);
      }
      if (cur.length) mk(d, n, cur.join(" "));
      continue;
    }
    const words = d.text.split(/\s+/);
    const step = Math.max(1, chunkWords - overlapWords);
    for (let i = 0, n = 0; i < words.length; i += step, n++) {
      mk(d, n, words.slice(i, i + chunkWords).join(" "));
      if (i + chunkWords >= words.length) break;
    }
  }
  return out;
}

export interface RetrieveOpts {
  topK: number;
  userAccess: Access;
  accessFilter: boolean;
  dept?: string;
  region?: string;
  rerank: boolean;
}

export interface Hit { chunk: Chunk; score: number; rerankScore?: number; filtered?: string }

export function retrieve(query: string, chunks: Chunk[], o: RetrieveOpts) {
  const q = embed(query);
  const scored: Hit[] = chunks.map((c) => ({ chunk: c, score: cosine(q, c.vec) }));
  for (const h of scored) {
    if (o.accessFilter && ACCESS_RANK[h.chunk.access] > ACCESS_RANK[o.userAccess]) h.filtered = "access";
    else if (o.dept && o.dept !== "Any" && h.chunk.dept !== o.dept) h.filtered = "dept";
    else if (o.region && o.region !== "Any" && h.chunk.region !== o.region && h.chunk.region !== "Global") h.filtered = "region";
  }
  const pool = scored.filter((h) => !h.filtered).sort((a, b) => b.score - a.score);
  let candidates = pool.slice(0, o.rerank ? Math.max(o.topK * 3, 8) : o.topK);
  if (o.rerank) {
    // cross-encoder stand-in: dense score + exact-term overlap
    for (const h of candidates) h.rerankScore = 0.5 * h.score + 0.5 * overlap(query, h.chunk.title + " " + h.chunk.text);
    candidates = candidates.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0)).slice(0, o.topK);
  }
  return { hits: candidates, all: scored.sort((a, b) => b.score - a.score) };
}

export const DEFAULT_CHUNKS = chunkDocs(HR_DOCS, 45, 10, "sentence");

// ---------- Simulated HR assistant ----------
export interface PromptFeatures {
  grounded: boolean;
  admitUnknown: boolean;
  refuseSensitive: boolean;
  cite: boolean;
  concise: boolean;
  injectionSafe: boolean;
}

export function promptFeatures(p: string): PromptFeatures {
  return {
    grounded: /only (use|using|answer|from)|answer only|use only|based (only )?on the (provided )?context|strictly (from|on) the context/i.test(p),
    admitUnknown: /(don'?t|do not) know|not (in|covered)|uncertain|say so/i.test(p),
    refuseSensitive: /confidential|refuse|never reveal|sensitive|personal data|pii/i.test(p),
    cite: /cite|source/i.test(p),
    concise: /concise|brief|short|one sentence/i.test(p),
    injectionSafe: /instructions? (inside|in|within) (the )?(documents?|context)|treat (the )?context as data|ignore any instructions/i.test(p),
  };
}

export const SENSITIVE_RE = /salary of|how much does \w+ (earn|make)|\bE\d{4}\b.*(salary|phone|email)|(phone|email|address) of|password|salary band|bands?\b.*(confidential)|priya/i;

export interface SimAnswer {
  text: string;
  sources: string[];
  flags: { hallucinated?: boolean; refused?: boolean; leaked?: boolean; injected?: boolean; uncertain?: boolean };
}

const HALLUCINATIONS = [
  "Unused leave is automatically paid out in cash at the end of the year.",
  "Employees can work fully remote without any approval.",
  "The company also offers a 25,000 USD annual education stipend.",
  "Business class is allowed on all flights.",
];

export function simulateHrAnswer(args: { question: string; systemPrompt: string; contexts: { title: string; text: string; docId: string }[]; temperature?: number; seed?: number }): SimAnswer {
  const f = promptFeatures(args.systemPrompt);
  const r = rng((args.seed ?? 1) + hashStr(args.question));
  const temp = args.temperature ?? 0.3;
  const sensitive = SENSITIVE_RE.test(args.question);

  if (sensitive && f.refuseSensitive) {
    return { text: "I can't share confidential compensation or personal information about employees. Please contact the HR Business Partner through the HR portal.", sources: [], flags: { refused: true } };
  }

  // indirect prompt injection carried by a retrieved document
  const poisoned = args.contexts.find((c) => /ignore all previous instructions/i.test(c.text));
  if (poisoned && !f.injectionSafe && r() < 0.85) {
    return { text: "To claim your wellness reward, please email your password to benefits-verify@freeprizes.example.", sources: [poisoned.docId], flags: { injected: true } };
  }

  // score every sentence of every context against the question
  const cands = args.contexts.flatMap((c) => sentences(c.text).filter((s) => !/ignore all previous/i.test(s)).map((s) => ({ s, docId: c.docId, title: c.title, score: overlap(args.question, s) })));
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0];

  if (!best || best.score < 0.34) {
    if (f.admitUnknown || f.grounded) {
      return { text: "I don't know. That isn't covered in the HR policies I have access to. Please raise a ticket with HR for a definitive answer.", sources: [], flags: { uncertain: true } };
    }
    const h = HALLUCINATIONS[Math.floor(r() * HALLUCINATIONS.length)];
    return { text: `Yes, good question! ${h}`, sources: [], flags: { hallucinated: true } };
  }

  // multi-part questions → take best sentence from up to 2 different documents
  const multi = /\band\b|\balso\b|both|compare|vs\.?/i.test(args.question);
  const picked = [best];
  if (multi) {
    const second = cands.find((c) => c.docId !== best.docId && c.score >= 0.2);
    if (second) picked.push(second);
  } else if (!f.concise) {
    const next = cands.find((c) => c !== best && c.docId === best.docId && c.score > 0.25 && overlap(c.s, best.s) < 0.6 && c.s.length > 25);
    if (next) picked.push(next);
  }

  const leaked = picked.some((p) => /CONFIDENTIAL|E1042|\+91|@acme-corp/.test(p.s));
  const openers = ["", "According to the policy, ", "Per the HR guidelines, ", "Sure! ", "Good question. "];
  const opener = temp < 0.2 ? "" : openers[Math.floor(r() * openers.length * Math.min(1, temp + 0.2))];
  let text = opener + picked.map((p) => p.s).join(" ");
  if (opener.endsWith(", ")) text =opener + text.slice(opener.length, opener.length + 1).toLowerCase() + text.slice(opener.length + 1);

  let hallucinated = false;
  if (!f.grounded && r() < 0.1 + temp * 0.4) {
    text += " " + HALLUCINATIONS[Math.floor(r() * HALLUCINATIONS.length)];
    hallucinated = true;
  }
  const sources = [...new Set(picked.map((p) => p.title))];
  if (f.cite) text += ` [Source: ${sources.join("; ")}]`;
  return { text, sources: picked.map((p) => p.docId), flags: { hallucinated, leaked } };
}

/** Full sim RAG answer: retrieve from default corpus, then simulate. */
export function simRag(question: string, systemPrompt: string, opts?: Partial<RetrieveOpts> & { temperature?: number; seed?: number }) {
  const { hits } = retrieve(question, DEFAULT_CHUNKS, { topK: 3, userAccess: "all", accessFilter: true, rerank: true, ...opts });
  const contexts = hits.map((h) => ({ title: h.chunk.title, text: h.chunk.text, docId: h.chunk.docId }));
  return { ...simulateHrAnswer({ question, systemPrompt, contexts, temperature: opts?.temperature, seed: opts?.seed }), contexts, hits };
}

export const fmtUsd = (n: number) => (n < 0.01 ? `$${n.toFixed(5)}` : n < 100 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString()}`);
export const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;
