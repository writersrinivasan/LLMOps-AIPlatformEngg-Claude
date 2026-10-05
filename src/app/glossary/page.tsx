"use client";
import { useState } from "react";
import { Input } from "@/components/ui";

const TERMS: [string, string, string][] = [
  ["AI Gateway / Model Gateway", "A single entry point that sits between applications and LLM providers. It handles authentication, routing, rate limits, retries, fallback, cost tracking and logging.", "2.3"],
  ["Model Registry", "A catalog of models and versions with metadata (owner, license, eval scores, hosting, lineage) and promotion stages.", "2.2"],
  ["Prompt Registry", "Versioned storage for prompt templates with lifecycle stages, experiments and rollback, managed separately from application code.", "2.4"],
  ["Embedding", "A numeric vector that represents the meaning of text. Similar texts produce nearby vectors.", "2.5"],
  ["Vector Database", "A store optimised for finding the nearest embedding vectors, usually filtered by metadata.", "2.5"],
  ["Chunking", "Splitting documents into retrievable pieces. Size and overlap trade off precision against context.", "2.5"],
  ["Reranking", "A second, more precise scoring pass (often a cross-encoder) over the retrieved candidates.", "2.5"],
  ["RAG", "Retrieval-Augmented Generation: retrieve relevant context, then generate an answer grounded in it.", "2.5"],
  ["Groundedness / Faithfulness", "Whether every claim in the answer is supported by the retrieved context.", "4.2"],
  ["Hallucination", "A confident claim that the context or reality doesn't support.", "3.3"],
  ["Golden Dataset", "A curated set of inputs with expected context and behaviour, used for regression testing.", "4.4"],
  ["LLM-as-a-Judge", "Using an LLM with a rubric to score outputs. It must be calibrated against human labels.", "4.3"],
  ["Evaluation Gate", "A CI/CD step that blocks a release when eval metrics fall below thresholds.", "3.3"],
  ["Canary Deployment", "Route a small percentage of traffic to the new version, watch metrics, then increase it gradually.", "3.4"],
  ["Shadow Deployment", "The new version receives a copy of live traffic, but its answers are never shown to users. It is evaluated offline.", "3.4"],
  ["Blue/Green", "Two identical environments. Switch all traffic at once, and switch back to roll back.", "3.4"],
  ["Feature Flag", "A runtime switch that enables a prompt, model or feature for selected users without a redeploy.", "3.4"],
  ["TTFT", "Time To First Token: the latency the user perceives before streaming starts.", "5.2"],
  ["Trace / Span", "A trace is an entire request's execution graph. Spans are its steps: LLM calls, tools, retrieval.", "5.1"],
  ["Prompt Injection", "Input that tries to override the system's instructions. In indirect injection, it arrives through retrieved documents or tool outputs.", "5.3"],
  ["Excessive Agency", "An agent with more tool permissions or autonomy than the task requires.", "5.3"],
  ["Guardrails", "Input/output checks (PII, toxicity, injection, topic) around the model.", "5.3"],
  ["Semantic Cache", "Reuses a previous answer when a new query is semantically similar enough to an earlier one.", "5.4"],
  ["Model Routing", "Sending each request to the cheapest model that can handle it.", "5.4"],
  ["Agent Runtime", "Platform service that runs the plan → tool call → observe loop, with step limits, memory and policies.", "6.2"],
  ["Tool Registry", "A catalog of tools agents may call, with schemas, scopes, owners and approval policies.", "6.2"],
  ["MCP", "Model Context Protocol: an open standard for exposing tools and data sources to LLM applications.", "6.2"],
  ["Golden Path", "The paved, opinionated way to build a new app on the platform, with the right defaults built in.", "6.3"],
];

export default function Glossary() {
  const [q, setQ] = useState("");
  const list = TERMS.filter(([t, d]) => (t + d).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <h1 className="text-2xl font-bold">Glossary</h1>
      <div className="mt-3 max-w-sm"><Input value={q} onChange={setQ} placeholder="Search terms…" /></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {list.map(([t, d, lab]) => (
          <div key={t} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between"><span className="font-semibold">{t}</span><span className="text-[11px] text-slate-400">Lab {lab}</span></div>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
