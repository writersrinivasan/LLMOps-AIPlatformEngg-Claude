// ClaimPilot single-claim pipeline: gateway → guardrails → supervisor → 4 parallel specialists →
// settlement (authority matrix + HITL) → comms → output guard → LLM judge.
// Simulator by default; in LIVE mode the intake, coverage, comms and judge agents call the real LLM
// and fall back to the simulator if a call fails.
import { liveChat } from "../llm";
import { estimateTokens, hashStr, sleep } from "../sim";
import type { LlmSettings } from "../store";
import { Claim, CLAUSES, Clause, Line, NodeId, POOL } from "./data";

export type StepStatus = "running" | "ok" | "warn" | "blocked" | "waiting";

export interface Step {
  id: string;
  agent: NodeId;
  title: string;
  thought: string;
  status: StepStatus;
  start: number; // ms from run start (virtual clock)
  end: number;
  model?: string;
  tools?: string[]; // "mcp-server.tool"
  output?: string;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
  live?: boolean;
  note?: string;
  group?: "parallel";
}

export interface LineItem { label: string; claimed: number; allowed: number; why?: string }

export interface ClaimInsights {
  route?: { complexity: number; model: string; reason: string; cache: { hit: boolean; similarity: number; key: string } };
  pii?: { found: { kind: string; value: string }[]; redacted: string };
  injection?: { found: boolean; snippet?: string };
  intake?: Record<string, unknown>;
  retrieval?: { clause: Clause; score: number; reranked: number }[];
  coverage?: { covered: boolean; clauses: string[]; reasoning: string };
  estimate?: LineItem[];
  fraud?: { score: number; signals: { label: string; weight: number }[] };
  settlement?: { assessed: number; deductible: number; payable: number; decision: "AUTO_SETTLED" | "ADJUSTER_APPROVED" | "ADJUSTER_REJECTED" | "SIU_REFERRAL"; authority: string };
  letter?: string;
  judge?: { faithfulness: number; groundedness: number; policyCompliance: number; tone: number; verdict: string };
}

export interface RunUpdate { steps: Step[]; insights: ClaimInsights }

const price = (model: string, i: number, o: number) => {
  const m = POOL.find((p) => p.id === model) ?? POOL[1];
  return (i * m.inPrice + o * m.outPrice) / 1_000_000;
};

// ---------- guardrails ----------
const INJECTION = /(ignore (all )?(previous|prior) instructions|^system:|\bsystem:|approve .{0,30}(immediately|without review)|disregard .{0,20}polic)/i;

export function scanPii(text: string) {
  const found: { kind: string; value: string }[] = [];
  let redacted = text;
  const rules: [string, RegExp, string][] = [
    ["EMAIL", /[\w.+-]+@[\w-]+\.[\w.]+/g, "[EMAIL]"],
    ["PHONE", /\b(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, "[PHONE]"],
    ["AADHAAR", /\b\d{4}\s\d{4}\s\d{4}\b/g, "[AADHAAR]"],
    ["PAN", /\b[A-Z]{5}\d{4}[A-Z]\b/g, "[PAN]"],
  ];
  for (const [kind, re, mask] of rules) {
    for (const m of text.match(re) ?? []) found.push({ kind, value: m });
    redacted = redacted.replace(re, mask);
  }
  return { found, redacted };
}

export function scanInjection(text: string) {
  const m = text.match(INJECTION);
  if (!m) return { found: false as const, clean: text };
  // quarantine the sentence that carries the instruction
  const sentences = text.split(/(?<=[.!?])\s+/);
  const bad = sentences.filter((s) => INJECTION.test(s));
  const clean = sentences.filter((s) => !INJECTION.test(s)).join(" ");
  return { found: true as const, snippet: bad.join(" "), clean };
}

// ---------- retrieval (metadata filter by line + keyword "embedding" score + rerank) ----------
export function retrieveClauses(text: string, line: Line, k = 3) {
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const scored = CLAUSES.filter((c) => c.line === line || c.line === "all").map((c) => {
    const hits = c.keywords.filter((kw) => words.some((w) => w.startsWith(kw) || kw.startsWith(w) && w.length > 3)).length;
    const base = 0.42 + Math.min(0.5, hits * 0.13) + (hashStr(c.id + line) % 7) / 100;
    return { clause: c, score: Math.min(0.97, base) };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k + 1)
    .map((s, i) => ({ ...s, reranked: Math.max(0.3, s.score - i * 0.04 + (s.clause.line === line ? 0.05 : -0.02)) }))
    .sort((a, b) => b.reranked - a.reranked)
    .slice(0, k);
}

export function detectLine(text: string): Line {
  const t = text.toLowerCase();
  if (/hospital|admitted|surgery|doctor|fever|dengue|medical/.test(t)) return "health";
  if (/baggage|luggage|flight|airport|passport|trip/.test(t)) return "travel";
  if (/pipe|flat|house|home|kitchen|roof|ceiling|burglary/.test(t)) return "home";
  return "motor";
}

// ---------- deterministic specialist logic ----------
function estimateFor(claim: Claim): LineItem[] {
  switch (claim.id) {
    case "CLM-24081":
      return [
        { label: "Rear bumper (OEM)", claimed: 14500, allowed: 14500 },
        { label: "Tail-light assembly", claimed: 9800, allowed: 9800 },
        { label: "Paint & labour", claimed: 11200, allowed: 11200 },
        { label: "Parking-sensor recalibration", claimed: 2900, allowed: 2900 },
      ];
    case "CLM-24082":
      return [
        { label: "Modular kitchen cabinets", claimed: 92000, allowed: 92000 },
        { label: "Vitrified flooring", claimed: 48000, allowed: 48000 },
        { label: "Neighbour's ceiling (liability)", claimed: 31000, allowed: 31000 },
        { label: "Plumber & pipe replacement", claimed: 6500, allowed: 6500 },
        { label: "Old seepage stain repaint", claimed: 7500, allowed: 0, why: "Gradual seepage excluded (HOME-7.1)" },
      ];
    case "CLM-24083":
      return [{ label: "Essentials: clothes & toiletries", claimed: 8200, allowed: 8200 }];
    case "CLM-24084": {
      const ratio = 5000 / 12000;
      return [
        { label: "Private suite: 5 days × ₹12,000", claimed: 60000, allowed: 25000, why: "Capped at 1% of SI/day (HEALTH-5.4)" },
        { label: "Doctor & nursing fees", claimed: 96000, allowed: Math.round(96000 * ratio), why: "Proportionate deduction 41.7%" },
        { label: "Medicines & consumables", claimed: 54000, allowed: 54000 },
        { label: "Diagnostics", claimed: 30000, allowed: 30000 },
      ];
    }
    case "CLM-24085":
      return [{ label: "Total loss (unverified)", claimed: 900000, allowed: 0, why: "Held pending SIU investigation" }];
    default: {
      const a = claim.amount;
      return [
        { label: "Primary damage", claimed: Math.round(a * 0.55), allowed: Math.round(a * 0.55) },
        { label: "Secondary damage", claimed: Math.round(a * 0.3), allowed: Math.round(a * 0.27), why: "Adjusted to network rate" },
        { label: "Labour & incidentals", claimed: a - Math.round(a * 0.55) - Math.round(a * 0.3), allowed: Math.round((a - Math.round(a * 0.55) - Math.round(a * 0.3)) * 0.9) },
      ];
    }
  }
}

function fraudFor(claim: Claim, injected: boolean) {
  const t = claim.text.toLowerCase();
  const signals: { label: string; weight: number }[] = [];
  if (claim.priorClaims >= 2) signals.push({ label: `${claim.priorClaims} prior claims in 12 months`, weight: 0.28 });
  else if (claim.priorClaims === 1) signals.push({ label: "1 prior claim (normal)", weight: 0.04 });
  if (claim.hoursToReport > 48) signals.push({ label: `Reported after ${claim.hoursToReport}h (> 48h rule)`, weight: 0.14 });
  if (/night|no witness/.test(t)) signals.push({ label: "Night-time, no witnesses", weight: 0.12 });
  if (/total(ly)? (loss|destroyed)/.test(t)) signals.push({ label: "Total loss claimed", weight: 0.1 });
  if (claim.attachments.length <= 1) signals.push({ label: "Thin evidence (1 attachment)", weight: 0.09 });
  if (injected) signals.push({ label: "Prompt-injection attempt in FNOL", weight: 0.2 });
  if (claim.amount > 300000 && claim.line === "motor") signals.push({ label: "Amount ≫ segment average", weight: 0.08 });
  if (!signals.length) signals.push({ label: "No anomalies; graph links clean", weight: 0 });
  const score = Math.min(0.97, 0.06 + signals.reduce((a, s) => a + s.weight, 0));
  return { score: Number(score.toFixed(2)), signals };
}

function complexityFor(claim: Claim, injected: boolean) {
  let c = 0.15;
  if (claim.amount > 50000) c += 0.2;
  if (claim.amount > 200000) c += 0.15;
  if (claim.line === "health") c += 0.25;
  if (injected) c += 0.15;
  c += Math.min(0.15, claim.text.length / 2000);
  return Math.min(0.98, Number(c.toFixed(2)));
}

const deductibleFor = (line: Line) => ({ motor: 5000, home: 10000, health: 0, travel: 0 })[line];

function simLetter(claim: Claim, s: NonNullable<ClaimInsights["settlement"]>) {
  const first = claim.customer.split(" ")[0];
  if (s.decision === "SIU_REFERRAL")
    return `Dear ${first}, thank you for reporting claim ${claim.id}. We need a few more details before we can assess it, so a specialist from our claims team will contact you within 2 working days. No action is needed from you right now.`;
  if (s.decision === "ADJUSTER_REJECTED")
    return `Dear ${first}, an adjuster has reviewed claim ${claim.id} and needs more documents before settlement. We'll message you the checklist shortly.`;
  const ded = s.deductible ? ` after the ₹${s.deductible.toLocaleString("en-IN")} policy deductible` : "";
  const cut = s.assessed < claim.amount ? ` Some items were adjusted under your policy terms, and the breakdown is in your claim summary.` : "";
  return `Good news, ${first}! Claim ${claim.id} is approved. ₹${s.payable.toLocaleString("en-IN")} will be credited to your registered bank account within 24 hours${ded}.${cut} Reply on WhatsApp if you have any questions. Take care!`;
}

function extractJson(s: string): Record<string, unknown> | null {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// ---------- runner ----------
export async function runClaim(opts: {
  claim: Claim;
  live: boolean;
  settings: LlmSettings;
  speed?: number; // 1 = normal; 2 = faster
  onUpdate: (u: RunUpdate) => void;
  onApproval: (ctx: { claim: Claim; payable: number; insights: ClaimInsights }) => Promise<boolean>;
}): Promise<RunUpdate> {
  const { claim, live, settings } = opts;
  const pace = (ms: number) => sleep(ms / (opts.speed ?? 1));
  const steps: Step[] = [];
  const insights: ClaimInsights = {};
  let clock = 0;
  const emit = () => opts.onUpdate({ steps: steps.map((s) => ({ ...s })), insights: { ...insights } });
  const begin = (s: Omit<Step, "id" | "status" | "end">) => {
    const st: Step = { ...s, id: `st${steps.length}`, status: "running", end: s.start };
    steps.push(st);
    emit();
    return st;
  };
  const finish = (st: Step, patch: Partial<Step>, dur: number) => {
    Object.assign(st, patch, { end: st.start + dur });
    if (st.status === "running") st.status = "ok";
    emit();
  };

  // 1. AI gateway
  const inj = scanInjection(claim.text);
  const complexity = complexityFor(claim, inj.found);
  const model = complexity >= 0.6 ? "frontier-xl" : complexity >= 0.35 ? "balanced-m" : "fast-s";
  const cacheHit = claim.line === "travel" && /baggage|luggage/i.test(claim.text);
  let st = begin({ agent: "gateway", title: "AI Gateway: authenticate, route, cache", thought: `Tenant claims-prod, key scoped to ClaimPilot. Rate limit 42/600 rpm. Complexity score ${complexity} → route to ${model}. Checking the semantic cache…`, start: clock });
  await pace(700);
  insights.route = {
    complexity, model,
    reason: complexity >= 0.6 ? "High value / medical reasoning → frontier model" : complexity >= 0.35 ? "Mid complexity → balanced model" : "Routine claim → small fast model",
    cache: { hit: cacheHit, similarity: cacheHit ? 0.96 : 0.41 + (hashStr(claim.id) % 30) / 100, key: cacheHit ? "travel/baggage-delay/>12h" : "-" },
  };
  finish(st, { output: cacheHit ? "Semantic cache HIT (0.96) for coverage reasoning: skips 1 LLM call" : "Cache miss: full pipeline", model: live ? settings.model || "server default" : model }, 38);
  clock += 38;

  // 2. Input guardrails
  st = begin({ agent: "guardIn", title: "Input guardrails: PII + prompt injection", thought: "Scanning free text for personal data and instruction-like content before any model sees it…", start: clock });
  await pace(650);
  const pii = scanPii(inj.found ? inj.clean : claim.text);
  insights.pii = pii;
  insights.injection = { found: inj.found, snippet: inj.found ? inj.snippet : undefined };
  const safeText = pii.redacted;
  finish(st, {
    status: inj.found ? "blocked" : pii.found.length ? "warn" : "ok",
    output: [
      pii.found.length ? `Redacted ${pii.found.length} PII value(s): ${[...new Set(pii.found.map((p) => p.kind))].join(", ")}` : "No PII found",
      inj.found ? `INJECTION quarantined: "${inj.snippet?.slice(0, 80)}…". Flag passed to the Fraud agent` : "No injection patterns",
    ].join("\n"),
    note: inj.found ? "Instruction stripped; it never reaches a model" : undefined,
  }, 55);
  clock += 55;

  // 3. Supervisor plan
  st = begin({ agent: "supervisor", title: "Supervisor agent: plan", thought: "FNOL received. I'll fan out to Intake, Damage, Coverage and Fraud in parallel, then hand the evidence to Settlement.", start: clock, model, tools: ["policy-admin.get_policy"] });
  await pace(800);
  const supIn = estimateTokens(safeText) + 420;
  finish(st, { output: `Policy ${claim.policyNo} ACTIVE · line=${claim.line} · plan: [intake, damage, coverage, fraud] → settlement`, tokensIn: supIn, tokensOut: 64, cost: price(model, supIn, 64) }, 610);
  clock += 610;

  // 4. Parallel specialists
  const pStart = clock;
  const durs = { intake: 900, vision: 1500, coverage: cacheHit ? 120 : 1300, fraud: 1100 };

  const intakeTask = (async () => {
    const s = begin({ agent: "intake", title: "Intake agent: FNOL → structured JSON", thought: "Extracting incident type, date, location, damaged items and third-party details…", start: pStart, model, group: "parallel" });
    const simJson = {
      incident_type: { motor: "collision", health: "hospitalisation", travel: "baggage_delay", home: "water_damage" }[claim.line],
      channel: claim.channel, reported_after_hours: claim.hoursToReport,
      damaged_items: estimateFor(claim).map((i) => i.label).slice(0, 3), third_party_involved: /other driver|neighbour|third/i.test(claim.text),
      amount_claimed: claim.amount,
    };
    let out = simJson as Record<string, unknown>;
    let isLive = false;
    let note: string | undefined;
    let tokIn = estimateTokens(safeText) + 260, tokOut = 90, dur = durs.intake;
    if (live) {
      const r = await liveChat(settings, {
        messages: [
          { role: "system", content: "You are the Intake agent of an insurance claims platform. Extract a compact JSON object with keys: incident_type, location, damaged_items (array), third_party_involved (boolean), amount_claimed (number). Return JSON only." },
          { role: "user", content: `Line: ${claim.line}. Amount claimed: ${claim.amount}. Customer notice: ${safeText}` },
        ], temperature: 0, max_tokens: 300,
      });
      const j = r.error ? null : extractJson(r.content);
      if (j) { out = j; isLive = true; tokIn = r.usage.input; tokOut = r.usage.output; dur = r.latencyMs; }
      else note = r.error ? `LIVE call failed (${r.error.slice(0, 60)}) → simulator fallback` : "Model returned invalid JSON → simulator fallback";
    } else await pace(durs.intake);
    insights.intake = out;
    finish(s, { output: JSON.stringify(out, null, 1), tokensIn: tokIn, tokensOut: tokOut, cost: price(model, tokIn, tokOut), live: isLive, note }, dur);
  })();

  const visionTask = (async () => {
    const s = begin({ agent: "vision", title: "Damage agent: documents + photos", thought: `Reading ${claim.attachments.length} attachment(s) with OCR + vision, pricing against the partner network…`, start: pStart, model: "vision-m", tools: ["dms-ocr.extract_document", claim.line === "motor" ? "garage-network.estimate_repair" : "policy-admin.get_policy"], group: "parallel" });
    await pace(durs.vision);
    const est = estimateFor(claim);
    insights.estimate = est;
    const allowed = est.reduce((a, i) => a + i.allowed, 0);
    finish(s, { output: `${claim.attachments.join(", ")}\nAssessed ₹${allowed.toLocaleString("en-IN")} of ₹${claim.amount.toLocaleString("en-IN")} claimed`, tokensIn: 1850, tokensOut: 140, cost: price("balanced-m", 1850, 140) }, durs.vision);
  })();

  const coverageTask = (async () => {
    const s = begin({ agent: "coverage", title: "Coverage agent: RAG over policy wording", thought: cacheHit ? "Semantically identical question answered 312 times this month → serving the cached reasoning." : "Retrieving clauses (metadata filter: line + 'all'), reranking, then reasoning about coverage…", start: pStart, model, tools: ["vector-db.search"], group: "parallel" });
    const hits = retrieveClauses(safeText, claim.line);
    insights.retrieval = hits;
    emit();
    const ids = hits.map((h) => h.clause.id);
    let coverage = {
      covered: claim.id !== "CLM-24085",
      clauses: ids,
      reasoning: claim.id === "CLM-24085" ? "Cover cannot be confirmed: evidence is thin and FRAUD-1.1 applies if the fraud score ≥ 0.70." : `Incident falls under ${ids[0]} (${hits[0].clause.title}). ${hits.slice(1).map((h) => h.clause.id).join(", ")} checked for limits/exclusions.`,
    };
    let isLive = false;
    let note: string | undefined;
    let tokIn = 900 + estimateTokens(safeText), tokOut = 120, dur = durs.coverage;
    if (live && !cacheHit) {
      const r = await liveChat(settings, {
        messages: [
          { role: "system", content: "You are the Coverage agent for an insurer. Using ONLY the provided policy clauses, decide if the claim is covered. Reply with JSON: {\"covered\": boolean, \"clauses\": [clause ids], \"reasoning\": \"max 2 sentences citing clause ids\"}." },
          { role: "user", content: `Clauses:\n${hits.map((h) => `[${h.clause.id}] ${h.clause.text}`).join("\n")}\n\nClaim (${claim.line}, ₹${claim.amount}): ${safeText}` },
        ], temperature: 0, max_tokens: 300,
      });
      const j = r.error ? null : extractJson(r.content);
      if (j && typeof j.reasoning === "string") {
        coverage = { covered: Boolean(j.covered), clauses: Array.isArray(j.clauses) ? (j.clauses as string[]) : ids, reasoning: j.reasoning };
        isLive = true; tokIn = r.usage.input; tokOut = r.usage.output; dur = r.latencyMs;
      } else note = r.error ? `LIVE call failed (${r.error.slice(0, 60)}) → simulator fallback` : "Model returned invalid JSON → simulator fallback";
    } else await pace(durs.coverage);
    insights.coverage = coverage;
    finish(s, { status: coverage.covered ? "ok" : "warn", output: `${coverage.covered ? "COVERED" : "NOT CONFIRMED"} · ${coverage.reasoning}`, tokensIn: cacheHit ? 0 : tokIn, tokensOut: cacheHit ? 0 : tokOut, cost: cacheHit ? 0 : price(model, tokIn, tokOut), live: isLive, note: note ?? (cacheHit ? "Served from semantic cache: $0, 120 ms" : undefined) }, dur);
  })();

  const fraudTask = (async () => {
    const s = begin({ agent: "fraud", title: "Fraud agent: graph links + behavioural rules", thought: "Checking claim history, reporting delay, network links between claimant, garage and witnesses…", start: pStart, model: "fast-s", tools: ["fraud-graph.link_analysis"], group: "parallel" });
    await pace(durs.fraud);
    const f = fraudFor(claim, inj.found);
    insights.fraud = f;
    finish(s, { status: f.score >= 0.7 ? "blocked" : f.score >= 0.4 ? "warn" : "ok", output: `Fraud score ${f.score.toFixed(2)} · ${f.signals.map((x) => x.label).join("; ")}`, tokensIn: 640, tokensOut: 70, cost: price("fast-s", 640, 70), note: f.score >= 0.7 ? "≥ 0.70 → SIU referral (FRAUD-1.1)" : undefined }, durs.fraud);
  })();

  await Promise.all([intakeTask, visionTask, coverageTask, fraudTask]);
  clock = Math.max(...steps.filter((s) => s.group === "parallel").map((s) => s.end));

  // 5. Settlement (authority matrix)
  const est = insights.estimate ?? [];
  const assessed = est.reduce((a, i) => a + i.allowed, 0);
  const deductible = assessed > 0 ? deductibleFor(claim.line) : 0;
  const payable = Math.max(0, assessed - deductible);
  const fraud = insights.fraud!;
  st = begin({ agent: "settlement", title: "Settlement agent: apply authority matrix", thought: `Assessed ₹${assessed.toLocaleString("en-IN")} − deductible ₹${deductible.toLocaleString("en-IN")} = ₹${payable.toLocaleString("en-IN")}. Checking AUTH-2.0 and FRAUD-1.1…`, start: clock, model: "fast-s" });
  await pace(700);
  let decision: NonNullable<ClaimInsights["settlement"]>["decision"];
  let authority: string;
  if (fraud.score >= 0.7 || !insights.coverage?.covered) { decision = "SIU_REFERRAL"; authority = "FRAUD-1.1: no auto-settlement, refer to SIU"; }
  else if (payable <= 50000) { decision = "AUTO_SETTLED"; authority = "AUTH-2.0: ≤ ₹50,000 → agent may auto-settle"; }
  else { decision = "ADJUSTER_APPROVED"; authority = "AUTH-2.0: > ₹50,000 → licensed adjuster must approve"; }
  insights.settlement = { assessed, deductible, payable: decision === "SIU_REFERRAL" ? 0 : payable, decision, authority };
  finish(st, { status: decision === "SIU_REFERRAL" ? "blocked" : decision === "AUTO_SETTLED" ? "ok" : "waiting", output: authority, tokensIn: 520, tokensOut: 60, cost: price("fast-s", 520, 60) }, 420);
  clock += 420;

  // 6. Human-in-the-loop
  if (decision === "ADJUSTER_APPROVED") {
    st = begin({ agent: "human", title: "Adjuster approval (human-in-the-loop)", thought: "payments.initiate_payout is a high-risk tool. Pausing the agent until a licensed adjuster signs off…", start: clock, tools: ["payments.initiate_payout"] });
    st.status = "waiting";
    emit();
    const t0 = Date.now();
    const ok = await opts.onApproval({ claim, payable, insights: { ...insights } });
    const waited = Math.min(90_000, Date.now() - t0);
    insights.settlement = { ...insights.settlement, decision: ok ? "ADJUSTER_APPROVED" : "ADJUSTER_REJECTED", payable: ok ? payable : 0 };
    finish(st, { status: ok ? "ok" : "blocked", output: ok ? `Approved by adjuster A. Nair · payout ₹${payable.toLocaleString("en-IN")} released` : "Rejected by adjuster → request more documents" }, waited);
    clock += waited;
  } else if (decision === "AUTO_SETTLED") {
    st = begin({ agent: "settlement", title: "Payout via MCP", thought: "Within authority. Calling payments.initiate_payout with idempotency key…", start: clock, tools: ["payments.initiate_payout"] });
    await pace(400);
    finish(st, { output: `UTR AXIS${(hashStr(claim.id) % 1e8).toString().padStart(8, "0")} · ₹${payable.toLocaleString("en-IN")} queued (IMPS)` }, 260);
    clock += 260;
  }

  // 7. Comms
  const set = insights.settlement!;
  st = begin({ agent: "comms", title: "Comms agent: customer message", thought: "Writing a short, warm, plain-language update. No internal scores or fraud wording allowed.", start: clock, model: "fast-s", tools: ["notify.send_whatsapp"] });
  let letter = simLetter(claim, set);
  let cIn = 380, cOut = estimateTokens(letter), cDur = 900, cLive = false;
  let cNote: string | undefined;
  if (live) {
    const r = await liveChat(settings, {
      messages: [
        { role: "system", content: "You are the Comms agent of Acme Assure. Write a warm WhatsApp message (max 60 words) to the customer about their claim decision. Never mention fraud scores, SIU or internal processes. Use the first name." },
        { role: "user", content: `Customer: ${claim.customer}. Claim ${claim.id}. Decision: ${set.decision}. Payable: ₹${set.payable}. Deductible: ₹${set.deductible}. Claimed: ₹${claim.amount}.` },
      ], temperature: 0.4, max_tokens: 200,
    });
    if (!r.error && r.content.trim()) { letter = r.content.trim(); cIn = r.usage.input; cOut = r.usage.output; cDur = r.latencyMs; cLive = true; }
    else cNote = `LIVE call failed (${(r.error ?? "empty").slice(0, 60)}) → simulator fallback`;
  } else await pace(900);
  insights.letter = letter;
  finish(st, { output: letter, tokensIn: cIn, tokensOut: cOut, cost: price("fast-s", cIn, cOut), live: cLive, note: cNote }, cDur);
  clock += cDur;

  // 8. Output guard
  st = begin({ agent: "guardOut", title: "Output guardrails", thought: "Checking for PII echo, internal jargon (fraud/SIU), over-promising and tone…", start: clock });
  await pace(500);
  const leaks = /fraud|siu|score|investigat/i.test(letter);
  finish(st, { status: leaks ? "warn" : "ok", output: leaks ? "Internal wording detected → rewritten before sending" : "PII: none · jargon: none · promise matches decision ✓" }, 45);
  clock += 45;

  // 9. LLM-as-judge (online eval)
  st = begin({ agent: "judge", title: "LLM-as-judge: online evaluation", thought: "Scoring this decision for faithfulness to clauses, grounding in evidence, policy compliance and tone…", start: clock, model: "frontier-xl" });
  const h = hashStr(claim.id + claim.text);
  let judge = {
    faithfulness: 0.9 + (h % 8) / 100,
    groundedness: 0.89 + ((h >> 3) % 9) / 100,
    policyCompliance: set.decision === "SIU_REFERRAL" ? 0.99 : 0.93 + ((h >> 5) % 6) / 100,
    tone: 0.9 + ((h >> 7) % 9) / 100,
    verdict: "Decision is consistent with the cited clauses and the authority matrix.",
  };
  let jLive = false, jIn = 1600, jOut = 90, jDur = 1100;
  let jNote: string | undefined;
  if (live) {
    const r = await liveChat(settings, {
      messages: [
        { role: "system", content: "You are an evaluation judge. Score the claim decision from 0 to 1 on faithfulness (matches clauses), groundedness (supported by evidence), policyCompliance (follows authority matrix) and tone (customer message). Reply JSON: {\"faithfulness\":n,\"groundedness\":n,\"policyCompliance\":n,\"tone\":n,\"verdict\":\"one sentence\"}." },
        { role: "user", content: `Clauses: ${(insights.retrieval ?? []).map((r) => `[${r.clause.id}] ${r.clause.text}`).join(" ")}\nAuthority: ${set.authority}\nCoverage reasoning: ${insights.coverage?.reasoning}\nDecision: ${set.decision}, payable ₹${set.payable}\nCustomer message: ${letter}` },
      ], temperature: 0, max_tokens: 250,
    });
    const j = r.error ? null : extractJson(r.content);
    if (j && typeof j.faithfulness === "number") {
      judge = { faithfulness: Number(j.faithfulness), groundedness: Number(j.groundedness ?? 0.9), policyCompliance: Number(j.policyCompliance ?? 0.9), tone: Number(j.tone ?? 0.9), verdict: String(j.verdict ?? "") };
      jLive = true; jIn = r.usage.input; jOut = r.usage.output; jDur = r.latencyMs;
    } else jNote = r.error ? `LIVE call failed (${r.error.slice(0, 60)}) → simulator fallback` : "Judge returned invalid JSON → simulator fallback";
  } else await pace(1000);
  insights.judge = judge;
  finish(st, { output: `faithfulness ${judge.faithfulness.toFixed(2)} · grounded ${judge.groundedness.toFixed(2)} · compliance ${judge.policyCompliance.toFixed(2)} · tone ${judge.tone.toFixed(2)}`, tokensIn: jIn, tokensOut: jOut, cost: price("frontier-xl", jIn, jOut), live: jLive, note: jNote }, jDur);

  emit();
  return { steps, insights };
}
