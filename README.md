# LLMOps Lab: a hands-on, visual workspace for a 5-hour LLMOps & AI Platform Engineering session

No slides. Every agenda item is an interactive lab: route traffic through a gateway, break a RAG pipeline,
gate releases on evals, trace and red-team an agent, cut platform cost, and design a platform for 100 teams.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
# for the room: npm run build && npm start -- -H 0.0.0.0  → participants open http://<your-ip>:3000
```

## Simulator vs LIVE mode

* **Simulator (default):** every lab works offline with no API keys. It is deterministic, so the room sees the same results.
  The simulated HR assistant follows the system prompt's instructions (grounding, "say I don't know",
  refusals, injection defence, citations), so editing a prompt changes the eval scores even offline.
* **LIVE:** any OpenAI-compatible endpoint. The gateway, RAG, prompt tests, eval pipeline,
  LLM-as-judge, red-team probe, semantic cache and the agent (real tool calling) make real calls.
  * Per participant: **LLM settings** page → base URL + key + model → toggle LIVE.
  * One key for everyone: copy `.env.example` to `.env.local` on the host machine. Participants just toggle LIVE.

## Session map (300 min)

| Module | Min | Labs |
|---|---|---|
| 1. MLOps → LLMOps → AI Platform Eng. | 30 | Evolution timeline + sorting game · Lifecycle loop + Incident Detective · Platform component builder |
| 2. LLMOps Architecture & Core Components | 50 | Reference architecture · Model registry · Gateway simulator · Prompt registry · RAG playground · HR assistant design canvas |
| 3. AI CI/CD & Deployment | 60 | Release BOM · Git-based AI dev · Eval gates · Deployment strategies · Infra & autoscaling · Pipeline builder |
| 4. Evaluation & Quality | 45 | Non-determinism · 4 eval layers · LLM-as-judge vs humans · Golden dataset · Eval pipeline |
| 5. Observability, Security & Cost | 55 | Agent trace explorer · Metrics dashboard + incidents · Red team arena · Cost optimisation |
| 6. Enterprise AI Platform | 40 | 100-teams calculator · Agent runtime + tool registry (MCP) · Developer golden path · Maturity radar |
| 7. Capstone | 20 | Full platform design canvas with scorecard and timers |

## Facilitating

* Open **Facilitator run sheet** for the minute-by-minute plan.
* Toggle **Facilitator mode** (sidebar) to show the opening hook, "ask the room" questions and
  "listen for" answers inside every lab. Turn it off when projecting a lab for participants.
* Every lab has its own countdown timer and a "Mark complete" checkbox. Progress is stored in each browser.
* Deep link to a lab: `/m2#2.3`.

## Code map

* `src/lib/curriculum.ts`: modules, labs, timings, facilitator notes (edit this to adapt the session)
* `src/lib/sim.ts`: simulator (tokens, embeddings, chunking, retrieval, simulated HR assistant)
* `src/lib/eval.ts`: golden dataset, evaluators, prompt v1/v2
* `src/lib/agent.ts`: agent runtime, tool registry, policies, tracing (sim and live tool-calling)
* `src/app/api/llm/route.ts`: proxy to any OpenAI-compatible `/chat/completions`
* `src/components/labs/m*.tsx`: the labs, one file per module
