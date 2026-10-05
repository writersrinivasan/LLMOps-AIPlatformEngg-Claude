// Synthetic production traffic for the ClaimPilot command center.
// A plain class (no React) so the mesh can read particles every animation frame while
// panels re-render once per second through subscribe()/version.
import { Line, LINE_STYLE, NodeId, POOL } from "./data";

export type IncidentId = "outage" | "injection" | "regression" | "surge";

export const INCIDENTS: Record<IncidentId, { label: string; emoji: string; desc: string; duration: number; module: string }> = {
  outage: { label: "Provider outage", emoji: "🔥", desc: "Provider A returns 5xx. Watch the gateway's circuit breaker fail over.", duration: 18000, module: "m2" },
  injection: { label: "Injection attack wave", emoji: "🦹", desc: "Bots flood the web channel with prompt-injection claims.", duration: 16000, module: "m5" },
  regression: { label: "Ship a bad prompt", emoji: "🧨", desc: "coverage-prompt v3.3 goes to a 10% canary. Online evals catch it.", duration: 17000, module: "m3" },
  surge: { label: "Hailstorm surge", emoji: "⛈️", desc: "4× motor claims after a hailstorm in Bengaluru. Autoscaling + cache.", duration: 18000, module: "m6" },
};

export interface Particle { id: number; from: NodeId; to: NodeId; t0: number; dur: number; color: string; size: number; blocked?: boolean }
export interface FeedEvent { id: number; at: number; tag: "GATEWAY" | "GUARD" | "EVAL" | "SRE" | "HITL" | "FINOPS" | "AGENT" | "DEPLOY"; text: string; tone: "info" | "ok" | "warn" | "bad" }
export interface QueueItem { id: string; line: Line; amount: number; customer: string; at: number; autoAt: number; fraud: number }

interface LiveClaim { id: string; line: Line; amount: number; model: string; injected: boolean; blocked: boolean; fraud: number; hitl: boolean; cached: boolean; canary: boolean; born: number; latency: number; cost: number; faith: number }

const NAMES = ["Ananya", "Karthik", "Meera", "Rohan", "Sana", "Dev", "Lakshmi", "Imran", "Neha", "Suresh", "Divya", "Joseph", "Tara", "Aditya", "Zoya", "Harish"];
const HOP = 560; // ms per hop

export interface Series { t: number[]; throughput: number[]; p95: number[]; cost: number[]; stp: number[]; faith: number[]; blocks: number[]; cache: number[]; errors: number[] }

export class Autopilot {
  running = false;
  rate = 48; // claims per minute (baseline)
  particles: Particle[] = [];
  nodeHits: Partial<Record<NodeId, number>> = {};
  nodeCount: Partial<Record<NodeId, number>> = {};
  feed: FeedEvent[] = [];
  queue: QueueItem[] = [];
  incidents: Partial<Record<IncidentId, number>> = {}; // id -> ends at
  series: Series = { t: [], throughput: [], p95: [], cost: [], stp: [], faith: [], blocks: [], cache: [], errors: [] };
  modelShare: Record<string, number> = Object.fromEntries(POOL.map((p) => [p.id, 0]));
  toolCalls: Record<string, number> = {};
  tenantSpend: Record<string, number> = { claims: 1120, uw: 410, cx: 980, sales: 260, legal: 120 };
  replicas = 2;
  canary: { version: string; pct: number; state: "idle" | "canary" | "rolled-back" | "promoted" } = { version: "v3.2", pct: 0, state: "idle" };
  totals = { claims: 1284, autoSettled: 871, paidOut: 3.86e7, saved: 1284 * 1145, hitl: 297, siu: 31, blocked: 85 };
  version = 0;
  private canaryStart = 0;

  private completed: LiveClaim[] = [];
  private schedule: { at: number; fn: () => void }[] = [];
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private secTimer: ReturnType<typeof setInterval> | null = null;
  private acc = 0;
  private pid = 0;
  private eid = 0;
  private cid = 24100;
  private lastTick = 0;

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  private notify() { this.version++; this.listeners.forEach((l) => l()); }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTick = Date.now();
    if (!this.series.t.length) this.seedSeries();
    this.log("SRE", "ClaimPilot autopilot online · 7 agents · 6 MCP servers · 4 models behind the gateway", "ok");
    this.timer = setInterval(() => this.tick(), 100);
    this.secTimer = setInterval(() => this.second(), 1000);
    this.notify();
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    if (this.secTimer) clearInterval(this.secTimer);
    this.timer = this.secTimer = null;
    this.notify();
  }

  setRate(r: number) { this.rate = r; this.notify(); }

  active(id: IncidentId) { return (this.incidents[id] ?? 0) > Date.now(); }

  trigger(id: IncidentId) {
    const now = Date.now();
    if (this.active(id)) return;
    this.incidents[id] = now + INCIDENTS[id].duration;
    const later = (ms: number, fn: () => void) => this.schedule.push({ at: now + ms, fn });
    if (id === "outage") {
      this.log("GATEWAY", "Provider A: 5xx error rate 38% on fast-s & frontier-xl", "bad");
      later(1500, () => this.log("GATEWAY", "Circuit breaker OPEN on Provider A → failing over to llama-70b (self-hosted) + balanced-m", "warn"));
      later(3500, () => this.log("SRE", "Error rate back to 0.0%. Customers saw no failed claims", "ok"));
      later(INCIDENTS.outage.duration, () => this.log("GATEWAY", "Provider A healthy · breaker half-open → closed · routing restored", "ok"));
    } else if (id === "injection") {
      this.log("GUARD", "Spike: 'ignore previous instructions' payloads from 14 IPs on web channel", "bad");
      later(2000, () => this.log("GUARD", "Input guard quarantining payloads · 0 reached a model · fraud flags raised", "warn"));
      later(5000, () => this.log("GATEWAY", "Adaptive rate-limit applied to web channel (60 → 20 rpm per IP)", "info"));
      later(INCIDENTS.injection.duration, () => this.log("GUARD", "Attack wave over · blocked payloads exported to red-team dataset for evals", "ok"));
    } else if (id === "regression") {
      this.canary = { version: "v3.3", pct: 10, state: "canary" };
      this.canaryStart = now;
      this.log("DEPLOY", "coverage-prompt v3.3 → canary 10% (passed offline evals on 240 golden cases)", "info");
      later(4500, () => this.log("EVAL", "Online judge: canary faithfulness 0.78 vs SLO 0.90 (baseline 0.94)", "bad"));
      later(6500, () => this.log("EVAL", "Root cause: v3.3 'be generous' wording → approvals ignore room-rent cap", "warn"));
      later(8000, () => { this.canary = { version: "v3.2", pct: 0, state: "rolled-back" }; this.log("DEPLOY", "AUTO-ROLLBACK → v3.2 · 37 canary decisions re-queued for review", "ok"); });
      later(10000, () => this.log("EVAL", "Failing canary traces added to golden dataset → the CI gate will now catch this", "ok"));
    } else if (id === "surge") {
      this.log("SRE", "Hailstorm in Bengaluru · motor FNOL volume ×4 in 3 minutes", "warn");
      later(2000, () => { this.replicas = 6; this.log("SRE", "Autoscaler: llama-70b replicas 2 → 6 (queue depth > 40)", "info"); });
      later(4000, () => this.log("FINOPS", "Semantic cache hit rate 18% → 47%: similar hail-damage claims", "ok"));
      later(INCIDENTS.surge.duration, () => { this.replicas = 2; this.log("SRE", "Surge over · scaled back to 2 replicas · cost/claim fell 31% during peak", "ok"); });
    }
    this.notify();
  }

  approve(id: string, ok: boolean, byHuman = true) {
    const q = this.queue.find((x) => x.id === id);
    if (!q) return;
    this.queue = this.queue.filter((x) => x.id !== id);
    this.log("HITL", `${byHuman ? "You" : "Adjuster A. Nair"} ${ok ? "approved" : "rejected"} ${q.id} · ₹${q.amount.toLocaleString("en-IN")}`, ok ? "ok" : "warn");
    if (ok) this.totals.paidOut += q.amount;
    const color = LINE_STYLE[q.line].hex;
    const now = Date.now();
    this.hop(now, "human", "comms", color);
    this.hop(now + HOP, "comms", "guardOut", color);
    this.hop(now + HOP, "comms", "otel", color, 3);
    this.hop(now + 2 * HOP, "guardOut", "customer", ok ? "#4ade80" : "#fbbf24", 6);
    this.hop(now + 2 * HOP, "guardOut", "judge", color, 3);
    this.notify();
  }

  // ---------- internals ----------
  private log(tag: FeedEvent["tag"], text: string, tone: FeedEvent["tone"]) {
    this.feed = [{ id: this.eid++, at: Date.now(), tag, text, tone }, ...this.feed].slice(0, 60);
  }

  private hop(at: number, from: NodeId, to: NodeId, color: string, size = 4.5, blocked = false) {
    this.schedule.push({ at, fn: () => {
      this.particles.push({ id: this.pid++, from, to, t0: Date.now(), dur: HOP, color, size, blocked });
    } });
  }

  private tick() {
    const now = Date.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    const surge = this.active("surge") ? 4 : 1;
    this.acc += (this.rate * surge * dt) / 60000;
    while (this.acc >= 1) { this.acc -= 1; this.spawn(now + Math.random() * 100); }

    const due = this.schedule.filter((s) => s.at <= now);
    if (due.length) {
      this.schedule = this.schedule.filter((s) => s.at > now);
      due.forEach((s) => s.fn());
    }
    // land particles
    const alive: Particle[] = [];
    for (const p of this.particles) {
      if (now - p.t0 >= p.dur) {
        this.nodeHits[p.to] = now;
        this.nodeCount[p.to] = (this.nodeCount[p.to] ?? 0) + 1;
      } else alive.push(p);
    }
    this.particles = alive;
    // auto-approve stale HITL items (a human adjuster elsewhere picked them up)
    for (const q of this.queue) if (q.autoAt <= now) this.approve(q.id, Math.random() > 0.08, false);
  }

  private spawn(now: number) {
    const outage = this.active("outage");
    const attack = this.active("injection");
    const surge = this.active("surge");
    const regression = this.canary.state === "canary";
    const r = Math.random();
    const line: Line = surge && Math.random() < 0.75 ? "motor" : r < 0.42 ? "motor" : r < 0.68 ? "health" : r < 0.86 ? "travel" : "home";
    const amount = Math.round(Math.exp(Math.log(line === "travel" ? 9000 : line === "health" ? 90000 : 42000) + (Math.random() - 0.5) * 2.2) / 100) * 100;
    const injected = Math.random() < (attack ? 0.45 : 0.015);
    const blocked = injected && Math.random() < 0.7;
    const fraud = injected ? 0.75 + Math.random() * 0.2 : Math.random() < 0.04 ? 0.7 + Math.random() * 0.25 : Math.random() * 0.45;
    const cached = Math.random() < (surge ? 0.47 : 0.18);
    const complexity = (amount > 200000 ? 0.4 : amount > 50000 ? 0.25 : 0.1) + (line === "health" ? 0.25 : 0) + Math.random() * 0.15;
    let model = complexity > 0.6 ? "frontier-xl" : complexity > 0.33 ? "balanced-m" : "fast-s";
    if (outage && (model === "fast-s" || model === "frontier-xl")) model = model === "fast-s" ? "llama-70b" : "balanced-m";
    const hitl = !blocked && fraud < 0.7 && amount > 50000;
    const onCanary = regression && Math.random() < 0.1;
    const m = POOL.find((p) => p.id === model)!;
    const tokens = cached ? 2200 : 5200;
    const costUsd = (tokens * 0.8 * m.inPrice + tokens * 0.2 * m.outPrice) / 1e6 + 0.0004;
    const id = `CLM-${this.cid++}`;
    const c: LiveClaim = {
      id, line, amount, model, injected, blocked, fraud, hitl, cached, canary: onCanary, born: now,
      latency: 3.6 + Math.random() * 2.4 + (model === "frontier-xl" ? 2.2 : 0) + (outage ? 2.8 : 0) + (surge && !cached ? 1.4 : 0) - (cached ? 1.2 : 0),
      cost: costUsd * 84, // INR
      faith: onCanary ? 0.66 + Math.random() * 0.2 : 0.9 + Math.random() * 0.08,
    };

    const col = LINE_STYLE[line].hex;
    const RED = "#f43f5e";
    let t = now;
    this.hop(t, "channels", "gateway", col);
    t += HOP;
    // a blocked claim turns red and is swallowed by the input guard
    this.hop(t, "gateway", "guardIn", blocked ? RED : col, blocked ? 5 : 4.5, blocked);
    t += HOP;
    if (blocked) {
      this.hop(t - HOP, "gateway", "otel", RED, 2.5);
      this.schedule.push({ at: t, fn: () => { this.totals.blocked++; } });
      this.completed.push({ ...c, latency: 0.2, cost: 0.01 });
      return;
    }
    this.hop(t, "guardIn", "supervisor", injected ? RED : col);
    t += HOP;
    this.hop(t, "supervisor", "mcp", col, 2.5);
    for (const n of ["intake", "vision", "coverage", "fraud"] as NodeId[]) this.hop(t, "supervisor", n, n === "fraud" && fraud >= 0.7 ? RED : col, 3.5);
    t += HOP;
    if (!cached) this.hop(t, "coverage", "vector", col, 2.5);
    this.hop(t, "fraud", "mcp", col, 2.5);
    for (const n of ["intake", "vision", "coverage", "fraud"] as NodeId[]) this.hop(t + 120, n, "settlement", n === "fraud" && fraud >= 0.7 ? RED : col, 3.5);
    t += HOP + 120;

    this.toolCalls["policy-admin.get_policy"] = (this.toolCalls["policy-admin.get_policy"] ?? 0) + 1;
    this.toolCalls["dms-ocr.extract_document"] = (this.toolCalls["dms-ocr.extract_document"] ?? 0) + 1;
    this.toolCalls["fraud-graph.link_analysis"] = (this.toolCalls["fraud-graph.link_analysis"] ?? 0) + 1;
    if (line === "motor") this.toolCalls["garage-network.estimate_repair"] = (this.toolCalls["garage-network.estimate_repair"] ?? 0) + 1;

    if (fraud >= 0.7) {
      this.hop(t, "settlement", "human", RED, 5);
      this.schedule.push({ at: t + HOP, fn: () => { this.totals.siu++; this.totals.claims++; if (Math.random() < 0.35) this.log("AGENT", `${id} → SIU referral (fraud ${fraud.toFixed(2)}${injected ? ", injection flag" : ""})`, "warn"); } });
      this.completed.push(c);
      return;
    }
    if (hitl) {
      this.hop(t, "settlement", "human", "#fbbf24", 5);
      this.schedule.push({ at: t + HOP, fn: () => {
        this.totals.hitl++; this.totals.claims++;
        this.queue = [...this.queue, { id, line, amount, customer: NAMES[Math.floor(Math.random() * NAMES.length)], at: Date.now(), autoAt: Date.now() + 9000 + Math.random() * 5000, fraud }].slice(-6);
      } });
      this.completed.push(c);
      return;
    }
    this.toolCalls["payments.initiate_payout"] = (this.toolCalls["payments.initiate_payout"] ?? 0) + 1;
    this.toolCalls["notify.send_whatsapp"] = (this.toolCalls["notify.send_whatsapp"] ?? 0) + 1;
    this.hop(t, "settlement", "comms", col);
    t += HOP;
    this.hop(t, "comms", "guardOut", col);
    this.hop(t, "comms", "otel", col, 2.5);
    t += HOP;
    this.hop(t, "guardOut", "customer", "#4ade80", 6);
    this.hop(t, "guardOut", "judge", col, 2.5);
    this.schedule.push({ at: t + HOP, fn: () => {
      this.totals.claims++; this.totals.autoSettled++; this.totals.paidOut += amount; this.totals.saved += 1145;
    } });
    this.completed.push(c);
  }

  private seedSeries() {
    for (let i = 0; i < 60; i++) {
      const j = () => (Math.random() - 0.5);
      this.pushSeries(Date.now() - (60 - i) * 1000, {
        throughput: this.rate + j() * 6, p95: 7.4 + j() * 0.6, cost: 4.6 + j() * 0.4, stp: 67 + j() * 4, faith: 0.94 + j() * 0.02, blocks: Math.max(0, 0.7 + j() * 1.4), cache: 18 + j() * 4, errors: 0,
      });
    }
  }

  private pushSeries(t: number, v: Record<Exclude<keyof Series, "t">, number>) {
    const s = this.series;
    s.t.push(t);
    (Object.keys(v) as (keyof typeof v)[]).forEach((k) => s[k].push(v[k]));
    if (s.t.length > 90) (Object.keys(s) as (keyof Series)[]).forEach((k) => s[k].shift());
  }

  private second() {
    const now = Date.now();
    this.completed = this.completed.filter((c) => now - c.born < 60000);
    const win = this.completed;
    const lat = win.filter((c) => !c.blocked).map((c) => c.latency).sort((a, b) => a - b);
    const p95 = lat.length ? lat[Math.floor(lat.length * 0.95)] : 7;
    const proc = win.filter((c) => !c.blocked);
    const stp = proc.length ? (proc.filter((c) => !c.hitl && c.fraud < 0.7).length / proc.length) * 100 : 67;
    const recent = win.filter((c) => now - c.born < 15000 && !c.blocked);
    // while a canary is live, the online judge reports the canary cohort (that's where regressions show up)
    const stable = recent.filter((c) => !c.canary);
    let faith = stable.length ? stable.reduce((a, c) => a + c.faith, 0) / stable.length : 0.94;
    if (this.canary.state === "canary") faith = Math.max(0.76, 0.93 - ((now - this.canaryStart) / 1000) * 0.03) + (Math.random() - 0.5) * 0.015;
    const outageFresh = this.active("outage") && (this.incidents.outage ?? 0) - now > INCIDENTS.outage.duration - 3500;
    this.pushSeries(now, {
      throughput: win.length,
      p95,
      cost: proc.length ? proc.reduce((a, c) => a + c.cost, 0) / proc.length : 4.6,
      stp,
      faith,
      blocks: win.filter((c) => c.blocked && now - c.born < 10000).length * 6,
      cache: proc.length ? (proc.filter((c) => c.cached).length / proc.length) * 100 : 18,
      errors: outageFresh ? 4 + Math.random() * 8 : 0,
    });
    const share: Record<string, number> = Object.fromEntries(POOL.map((p) => [p.id, 0]));
    for (const c of proc) share[c.model] = (share[c.model] ?? 0) + 1;
    this.modelShare = Object.fromEntries(Object.entries(share).map(([k, v]) => [k, v / Math.max(1, proc.length)]));
    // tenants spend in USD; claims spend tracks live throughput
    this.tenantSpend.claims += win.length * 0.025;
    this.tenantSpend.uw += 0.9 + Math.random();
    this.tenantSpend.cx += 1.6 + Math.random() * 2;
    this.tenantSpend.sales += 0.4 + Math.random() * 0.5;
    this.tenantSpend.legal += 0.3 + Math.random() * 0.4;
    if (this.canary.state === "rolled-back" && !this.active("regression")) this.canary = { version: "v3.2", pct: 0, state: "idle" };
    if (Math.random() < 0.12 && !Object.keys(this.incidents).some((k) => this.active(k as IncidentId))) {
      const msgs: [FeedEvent["tag"], string, FeedEvent["tone"]][] = [
        ["FINOPS", `Cost per claim ₹${this.series.cost.at(-1)!.toFixed(2)} vs ₹1,150 manual processing`, "info"],
        ["EVAL", `Online judge sampled 50 decisions · faithfulness ${faith.toFixed(2)} ✓`, "ok"],
        ["GATEWAY", `Semantic cache saved ${Math.round(win.filter((c) => c.cached).length * 1.1)} LLM calls in the last minute`, "info"],
        ["AGENT", `Supervisor p50 plan time 0.6s · 0 tool errors · 0 loops`, "ok"],
      ];
      const [tag, text, tone] = msgs[Math.floor(Math.random() * msgs.length)];
      this.log(tag, text, tone);
    }
    this.notify();
  }
}
