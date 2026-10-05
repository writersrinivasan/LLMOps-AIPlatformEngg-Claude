// Single source of truth for the 5-hour session: modules, labs, timings, facilitator notes.

export type ColorKey = "violet" | "blue" | "emerald" | "amber" | "rose" | "cyan" | "indigo";

export interface Lab {
  id: string; // "2.3"
  title: string;
  minutes: number;
  agenda: string[]; // bullet points from the official agenda this lab covers
  task: string; // what participants do
  facilitator: {
    ask: string[]; // questions to put to the room
    lookFor: string[]; // what good answers / outcomes look like
    tip?: string;
  };
}

export interface Module {
  id: string; // "m1"
  num: number;
  title: string;
  tagline: string;
  minutes: number;
  color: ColorKey;
  outcome: string;
  hook: string; // opening provocation for the facilitator
  labs: Lab[];
}

export const MODULES: Module[] = [
  {
    id: "m1",
    num: 1,
    title: "From MLOps to LLMOps to AI Platform Engineering",
    tagline: "Why LLM apps need a new operating model",
    minutes: 30,
    color: "violet",
    outcome: "Participants can explain what changes from SDLC → MLOps → LLMOps → AI Platform Engineering, and map the components an enterprise AI platform needs.",
    hook: "Ask: 'Who has shipped an LLM feature that worked in the demo and broke in production? What broke?' Collect 3 answers on the whiteboard. You'll map each one to a lifecycle stage in lab 1.2.",
    labs: [
      {
        id: "1.1",
        title: "Evolution Timeline & Sorting Game",
        minutes: 10,
        agenda: [
          "Traditional Software Development Lifecycle",
          "ML Engineering and MLOps",
          "Why LLM applications require a different operational model",
          "LLMOps vs MLOps",
          "From LLMOps to AI Platform Engineering",
          "AI Engineering vs AI Platform Engineering",
        ],
        task: "Click through the four eras and compare what gets versioned, what fails and who owns it. Then sort the 12 cards into 'AI Engineering' or 'AI Platform Engineering'.",
        facilitator: {
          ask: [
            "In MLOps the model was the artifact. What is the artifact in an LLM app?",
            "Why is a prompt change riskier than a code change of the same size?",
          ],
          lookFor: [
            "The artifact becomes a bundle: prompt + model + context + tools + config.",
            "Non-determinism, so you can't rely on exact-match tests.",
            "Platform engineering = building it once for many teams.",
          ],
          tip: "Run the sorting game as a 2-minute team race. Debrief only the cards people got wrong.",
        },
      },
      {
        id: "1.2",
        title: "LLM Application Lifecycle Loop",
        minutes: 10,
        agenda: ["Data → Model Selection → Prompt/Context → RAG/Tools → App Dev → Evaluation → Deployment → Observability → Feedback → Continuous Improvement"],
        task: "Explore each lifecycle stage, then play 'Incident Detective': for each production incident, pick the stage that should have caught it.",
        facilitator: {
          ask: ["Which stage do most teams skip? Why?", "Where does feedback re-enter the loop?"],
          lookFor: ["Evaluation and observability are the most-skipped stages.", "Feedback flows back into data, prompts and eval sets, not just models."],
          tip: "Map the 3 'broke in production' stories from your opening hook onto the loop.",
        },
      },
      {
        id: "1.3",
        title: "Platform Component Builder",
        minutes: 10,
        agenda: [
          "Model Gateway", "Model Registry", "Prompt Registry", "Vector Database", "Feature / Knowledge Store", "RAG Pipeline",
          "Agent Runtime", "Evaluation Framework", "Observability Layer", "Security & Governance", "CI/CD and AI Release Management",
          "1.4 Enterprise Use Case: multiple teams build RAG apps, assistants, coding agents, CS agents, document intelligence",
        ],
        task: "You have a budget of 6 platform components. Choose which ones to build first and watch which of the 5 team use cases you unblock.",
        facilitator: {
          ask: ["Which component did every team pick first? Why?", "What did you leave out, and what risk does that create?"],
          lookFor: ["Gateway + Observability + Eval are almost always first.", "Leaving out Security/Governance blocks customer-facing agents."],
        },
      },
    ],
  },
  {
    id: "m2",
    num: 2,
    title: "LLMOps Architecture & Core Components",
    tagline: "Gateway, registries, prompts, and knowledge",
    minutes: 50,
    color: "blue",
    outcome: "Participants run the core LLMOps components hands-on (gateway routing and fallback, model and prompt registries, a RAG pipeline) and then design the HR Knowledge Assistant.",
    hook: "Say: 'Today every team calls OpenAI directly with its own key. Tomorrow the CFO asks how much we spend on AI and which apps send PII to which provider. Can you answer?'",
    labs: [
      {
        id: "2.1",
        title: "Reference Architecture: Follow a Request",
        minutes: 6,
        agenda: ["Users/Apps → API/AI Gateway → LLMs | Agents | RAG → AI Platform Layer (Eval, Observability, Security, Registry, Governance) → Infrastructure"],
        task: "Send different request types through the reference architecture and watch which layers each one touches.",
        facilitator: { ask: ["Which layer is touched by every single request?"], lookFor: ["The gateway, which is why it is the control point for auth, cost and logging."] },
      },
      {
        id: "2.2",
        title: "Model Registry",
        minutes: 7,
        agenda: ["Foundation models", "Open-source models", "Proprietary models", "Fine-tuned models", "Local vs cloud-hosted", "Model versioning", "Model metadata", "Model registry"],
        task: "Register a new fine-tuned model version with complete metadata, then promote it Dev → Staging → Prod. The registry blocks promotion unless the eval and approval metadata are present.",
        facilitator: { ask: ["What metadata would an auditor ask for?", "When would you choose a local model over a cloud one?"], lookFor: ["Lineage, eval scores, data residency, license, owner, cost.", "Data sensitivity, latency, cost at scale, offline needs."] },
      },
      {
        id: "2.3",
        title: "Model Gateway Simulator",
        minutes: 12,
        agenda: ["Unified interface to multiple providers", "Routing", "Authentication", "Rate limiting", "Retry mechanisms", "Fallback models", "Cost controls", "Provider abstraction"],
        task: "Configure the routing policy, rate limits, retries and fallback chain. Then cause a provider outage and a traffic spike. Your goal is to keep the success rate above 99% while staying under budget.",
        facilitator: {
          ask: ["What happened to cost when the primary provider failed?", "Should every app get the same rate limit?"],
          lookFor: ["Fallback keeps availability up but can change cost and quality, so it needs monitoring.", "Per-app/per-team quotas tied to API keys."],
          tip: "In LIVE mode, one participant can send a real request through the gateway while the room watches the log.",
        },
      },
      {
        id: "2.4",
        title: "Prompt Registry & Experiments",
        minutes: 10,
        agenda: ["Prompt versioning", "Prompt templates", "Prompt experimentation", "Prompt testing", "Prompt rollback", "Prompt lifecycle management"],
        task: "Edit the HR assistant prompt to create v3, run it against the test cases, compare it with v2 side by side, promote it, and roll back if it regresses.",
        facilitator: { ask: ["Who should be allowed to promote a prompt to production?", "Why version prompts separately from code?"], lookFor: ["Prompts change more often than code and are often owned by non-engineers, so they need their own lifecycle and approvals."] },
      },
      {
        id: "2.5",
        title: "RAG Pipeline Playground",
        minutes: 10,
        agenda: ["Embeddings", "Vector databases", "Chunking", "Retrieval", "Reranking", "Metadata filtering", "Context construction", "RAG pipelines"],
        task: "Tune chunk size, overlap, top-k, reranking and metadata filters on the HR corpus. See how the retrieved context, and the answer, change.",
        facilitator: { ask: ["What happened with very small chunks? With very large ones?", "What does the access-level filter protect against?"], lookFor: ["Small chunks lose context; large ones dilute relevance and cost tokens.", "Users retrieving documents they shouldn't see (insecure RAG)."] },
      },
      {
        id: "2.6",
        title: "Design: Enterprise HR Knowledge Assistant",
        minutes: 5,
        agenda: ["Internal documents", "RAG", "Multiple LLMs", "Authentication", "Monitoring", "Evaluation", "Cost tracking"],
        task: "In teams, drag components onto the canvas and connect them. The requirement checker turns green as your design covers each requirement.",
        facilitator: { ask: ["Where did you put authentication: at the gateway, the retriever, or both?"], lookFor: ["Both: identity at the gateway, and document-level access control enforced at retrieval."], tip: "Give teams 4 minutes. Pick 1 team to screen-share and defend their design." },
      },
    ],
  },
  {
    id: "m3",
    num: 3,
    title: "AI Application CI/CD & Deployment Engineering",
    tagline: "Shipping prompts, models and context safely",
    minutes: 60,
    color: "emerald",
    outcome: "Participants build an AI release pipeline with evaluation gates, choose deployment strategies, and size the infrastructure.",
    hook: "Ask: 'If someone changes one word in a production prompt, does it go through code review? Through tests? Through a canary?' Usually the answer is no, no and no.",
    labs: [
      {
        id: "3.1",
        title: "AI Release Bill of Materials",
        minutes: 6,
        agenda: ["Traditional: Code → Build → Test → Deploy", "AI release: Code + Prompt + Model + Data + Context + Tools + Evaluation"],
        task: "Change one ingredient of the AI release (prompt, model, data, and so on) and see what must be re-tested and re-deployed.",
        facilitator: { ask: ["Which change looks small but has the biggest blast radius?"], lookFor: ["Model version bumps and embedding model changes, which force a full re-index and re-eval."] },
      },
      {
        id: "3.2",
        title: "Git-Based AI Development",
        minutes: 10,
        agenda: ["Source control", "Prompt versioning", "Configuration management", "Model configuration", "Git for prompts / configuration / eval datasets / code", "Environment-specific configurations"],
        task: "Explore the AI repo layout. Edit the prod config, diff dev vs prod, and open a pull request that triggers the pipeline.",
        facilitator: { ask: ["Should the eval dataset live in the same repo as the app?"], lookFor: ["Yes, versioned together, so you know which dataset gated which release."] },
      },
      {
        id: "3.3",
        title: "Evaluation Gates",
        minutes: 10,
        agenda: ["Answer correctness", "Relevance", "Groundedness", "Hallucination", "Toxicity", "PII leakage", "Tool-call accuracy", "Structured output correctness"],
        task: "Set a threshold for each gate. Run 3 candidate releases through the gates and decide which ones ship.",
        facilitator: { ask: ["Which gates should block a release, and which only warn?"], lookFor: ["Safety gates (PII, toxicity) block hard. Quality gates can allow small tolerances."] },
      },
      {
        id: "3.4",
        title: "Deployment Strategy Simulator",
        minutes: 12,
        agenda: ["Blue/Green", "Canary", "Shadow", "A/B testing", "Model rollout", "Prompt rollout", "Feature flags"],
        task: "Roll out v2 of the assistant using each strategy. v2 has a hidden quality regression. Which strategy catches it with the least user impact?",
        facilitator: { ask: ["Why is shadow deployment especially useful for LLMs?", "What metric would you auto-rollback on?"], lookFor: ["Shadow lets you evaluate on real traffic with zero user impact.", "Eval score or groundedness, not just error rate."] },
      },
      {
        id: "3.5",
        title: "Infrastructure & Autoscaling",
        minutes: 8,
        agenda: ["Containers", "Kubernetes", "GPU infrastructure", "Serverless inference", "Managed model endpoints", "Autoscaling", "Load balancing"],
        task: "Pick a hosting option, set autoscaling rules, and run a day of traffic. Balance p95 latency against cost.",
        facilitator: { ask: ["When does self-hosting on GPUs beat paying per token?"], lookFor: ["High, steady volume, data residency needs, or fine-tuned open models."] },
      },
      {
        id: "3.6",
        title: "Build the AI CI/CD Pipeline",
        minutes: 14,
        agenda: ["GitHub → CI → Unit Tests → LLM Evaluation → Security Checks → Container Build → Deployment → Observability"],
        task: "Arrange the stages in the right order, then push 4 different commits (including a leaked API key and a prompt regression) and see which stage catches each one.",
        facilitator: { ask: ["Why run the cheap checks before the LLM eval?"], lookFor: ["LLM evals cost money and time, so fail fast on the cheap checks first."] },
      },
    ],
  },
  {
    id: "m4",
    num: 4,
    title: "LLM Evaluation, Testing & Quality Engineering",
    tagline: "Testing probabilistic systems",
    minutes: 45,
    color: "amber",
    outcome: "Participants understand why exact-match tests fail, know the 4 evaluation layers, build a golden dataset and run a working evaluation pipeline.",
    hook: "Run the same question 5 times live. Ask: 'Which of these 5 answers is the correct one?'",
    labs: [
      {
        id: "4.1",
        title: "Non-Determinism Lab",
        minutes: 7,
        agenda: ["Input → Expected Output vs Input → Probabilistic Output", "Exact-match testing is insufficient", "Semantic evaluation becomes important", "Evaluation datasets become critical"],
        task: "Generate 5 answers at different temperatures. Compare the exact-match score with the semantic similarity score.",
        facilitator: { ask: ["If exact match fails, what do we assert on instead?"], lookFor: ["Semantic similarity, required facts, rubric scores, structure, and behaviour."] },
      },
      {
        id: "4.2",
        title: "The 4 Evaluation Layers",
        minutes: 8,
        agenda: ["Model eval: accuracy, capability, context handling, latency, token usage", "Prompt eval: instruction following, consistency, quality", "RAG eval: retrieval precision/recall, context relevance, faithfulness, groundedness", "Agent eval: planning, tool selection, tool-call correctness, task completion, multi-step"],
        task: "Inspect one agent run and score it at each of the 4 layers. Find the layer where it actually failed.",
        facilitator: { ask: ["The final answer was wrong, but which layer was the root cause?"], lookFor: ["Retrieval missed the right doc, so the model faithfully answered from the wrong context."] },
      },
      {
        id: "4.3",
        title: "LLM-as-a-Judge vs Humans",
        minutes: 10,
        agenda: ["Human evaluation", "Automated evaluation", "LLM-as-a-judge", "Golden datasets", "Regression testing", "Benchmarking", "Red-team evaluation"],
        task: "Score 6 responses yourself (human eval), then run the LLM judge. Tune the rubric until the judge agrees with you on at least 5 of 6.",
        facilitator: { ask: ["Can you trust the judge? How would you know?"], lookFor: ["Calibrate the judge against human labels and track the agreement rate over time."] },
      },
      {
        id: "4.4",
        title: "Build the Golden Dataset",
        minutes: 8,
        agenda: ["Query / Expected Context / Expected Behavior", "HR Policy → Correct answer", "Unknown → Admit uncertainty", "Sensitive → Refuse", "Multi-step → Synthesize"],
        task: "Add at least 2 test cases of your own, covering all 4 behaviour types. The coverage meter shows any gaps.",
        facilitator: { ask: ["Where do the best test cases come from?"], lookFor: ["Production failures, user feedback, red-team findings, and edge cases from SMEs."] },
      },
      {
        id: "4.5",
        title: "Mini Evaluation Pipeline",
        minutes: 12,
        agenda: ["Test Dataset → LLM Application → Generated Response → Evaluator → Score → Pass/Fail"],
        task: "Run your golden dataset through the HR assistant using prompt v1, then v2. Find the regression and explain it.",
        facilitator: { ask: ["What would you wire this into?"], lookFor: ["The CI gate from 3.3, a nightly regression run, and a pre-promotion check in the prompt registry."], tip: "In LIVE mode the app under test and the judge make real LLM calls." },
      },
    ],
  },
  {
    id: "m5",
    num: 5,
    title: "LLM Observability, Security & Cost Engineering",
    tagline: "Run it, protect it, pay less for it",
    minutes: 55,
    color: "rose",
    outcome: "Participants trace a real agent run, find incidents on a metrics dashboard, red-team a guarded assistant and cut platform cost by half without losing quality.",
    hook: "Show a trace of an agent that made 14 LLM calls to answer 'what is my leave balance'. Ask: 'Would your current monitoring show you this?'",
    labs: [
      {
        id: "5.1",
        title: "Agent Trace Explorer",
        minutes: 12,
        agenda: ["Prompt, Response, Tokens, Model, Retrieval, Tool calls, Agent steps, Latency per step, Cost, Evaluation score", "Distributed tracing: trace the entire execution graph"],
        task: "Run the HR agent on a task and explore its trace waterfall. Find the slowest span and the most expensive span.",
        facilitator: { ask: ["What would a traditional APM tool have shown for this request?"], lookFor: ["One slow HTTP call. None of the steps, prompts, tokens or tool calls inside it."] },
      },
      {
        id: "5.2",
        title: "LLM Metrics Dashboard",
        minutes: 10,
        agenda: ["Quality: faithfulness, relevance, groundedness, task completion", "Performance: TTFT, E2E latency, tokens/sec, throughput", "Cost: input/output tokens, cost per request/user/app", "Reliability: error, timeout, model/tool/retrieval failure"],
        task: "The facilitator injects incidents. Spot each one on the dashboard and name its root cause.",
        facilitator: { ask: ["Which incident was invisible to the CPU/memory/error-rate metrics?"], lookFor: ["Quality drift. Groundedness dropped while every infra metric stayed green."], tip: "Inject incidents one at a time while participants are looking at the dashboard." },
      },
      {
        id: "5.3",
        title: "Red Team Arena",
        minutes: 15,
        agenda: ["Prompt injection", "Indirect prompt injection", "Data leakage", "PII exposure", "Excessive agency", "Tool abuse", "Model extraction", "Jailbreaking", "Insecure RAG", "Supply-chain risks", "Security architecture: Identity → Gateway → Guardrails → Agent/LLM → Tool Authorization → Enterprise Systems"],
        task: "Launch attacks against the HR agent. Turn on defences one layer at a time until all attacks are blocked, while keeping legitimate requests working.",
        facilitator: { ask: ["Which single layer blocked the most attacks?", "What did over-blocking break?"], lookFor: ["Defence in depth: no single layer stops everything.", "Too-strict guardrails cause false positives on legitimate requests."] },
      },
      {
        id: "5.4",
        title: "Cost Optimization Challenge",
        minutes: 18,
        agenda: ["Token optimization", "Model routing", "Smaller-model selection", "Context compression", "Semantic caching", "Response caching", "Batch inference", "Rate limiting", "Budget controls", "Scenario: expensive calls, excessive context, repeated requests, agent loops, inefficient retrieval"],
        task: "The platform costs $84k a month. Use the optimization levers to cut it by at least 50% while keeping quality at 90% or above. Try the live semantic cache too.",
        facilitator: { ask: ["Which lever gave the most savings for the least quality loss?"], lookFor: ["Usually model routing plus caching. Context compression is the hidden gem."], tip: "Make it a team competition: lowest cost with quality ≥ 90% wins." },
      },
    ],
  },
  {
    id: "m6",
    num: 6,
    title: "Building the Enterprise AI Platform",
    tagline: "Reusable capabilities for 100 teams",
    minutes: 40,
    color: "cyan",
    outcome: "Participants adopt the platform mindset, run an agent on the platform's agent runtime with a governed tool registry (MCP-style), and experience the developer golden path.",
    hook: "Say: 'Don't build another AI app. Build the thing that lets 100 teams build AI apps.'",
    labs: [
      {
        id: "6.1",
        title: "The 100-Teams Calculator",
        minutes: 6,
        agenda: ["Instead of 'build another AI application', think 'build reusable capabilities that allow 100 teams to build AI applications'"],
        task: "Slide the number of teams. Compare duplicated effort with platform-shared effort and find the break-even point.",
        facilitator: { ask: ["At how many teams does a platform pay off at your company?"], lookFor: ["Usually 3–5 teams. Governance pressure makes it happen sooner."] },
      },
      {
        id: "6.2",
        title: "Agent Runtime & Tool Registry (MCP)",
        minutes: 16,
        agenda: ["Agent runtime", "Tool registry", "MCP integration", "Workflow orchestration"],
        task: "Register tools in the platform tool registry with scopes and approval policies, then run the HR agent. Watch it plan, call tools and get blocked by policy.",
        facilitator: { ask: ["Who decides which tools an agent may call?", "Which tool calls need a human in the loop?"], lookFor: ["The platform enforces it through scopes and policies, not the prompt.", "Irreversible or high-impact writes: payments, salary changes, external emails."] },
      },
      {
        id: "6.3",
        title: "Developer Golden Path",
        minutes: 10,
        agenda: ["Developer Experience: AI SDK, APIs, Templates, CLI, Developer portal"],
        task: "Use the developer portal to create a new AI app from a template. See which platform capabilities it inherits automatically.",
        facilitator: { ask: ["What should be impossible to forget when a team starts a new AI app?"], lookFor: ["Tracing, eval suite, gateway key with a budget, and guardrails, all on by default."] },
      },
      {
        id: "6.4",
        title: "Platform Capability Maturity",
        minutes: 8,
        agenda: ["Model layer", "Knowledge layer", "Agent layer", "Evaluation layer", "Operations layer", "Governance layer"],
        task: "Rate your own organisation on each capability. The radar shows your gaps and the suggested next 3 investments.",
        facilitator: { ask: ["What is your biggest gap, and who would own fixing it?"], lookFor: ["Concrete owners and a 90-day next step."] },
      },
    ],
  },
  {
    id: "m7",
    num: 7,
    title: "Capstone Architecture Challenge",
    tagline: "Design the whole platform",
    minutes: 20,
    color: "indigo",
    outcome: "Teams design an end-to-end Enterprise AI Platform, score it against requirements and defend it.",
    hook: "Set up teams of 3–5 and start the 12-minute timer. Then give each team 2 minutes to present.",
    labs: [
      {
        id: "7.1",
        title: "Capstone: Enterprise AI Platform",
        minutes: 20,
        agenda: ["100+ AI applications", "Multiple LLM providers", "RAG applications", "Agentic AI applications", "Internal enterprise data", "Production monitoring", "AI evaluation", "Security", "Cost governance"],
        task: "Build the platform on the canvas: apps → gateway → model/knowledge/agent layers → platform services → evaluation/observability/governance → cloud/K8s. Hit 100% on the scorecard, then present it.",
        facilitator: { ask: ["What would you build in the first 90 days?", "What's the single point of failure in your design?"], lookFor: ["Gateway + observability + eval first; the gateway is a SPOF, so it needs HA/multi-region."] },
      },
    ],
  },
];

export const TOTAL_MINUTES = MODULES.reduce((a, m) => a + m.minutes, 0);

export function getModule(id: string) {
  return MODULES.find((m) => m.id === id)!;
}

// Static class maps (Tailwind needs literal class names)
export const COLORS: Record<ColorKey, { bg: string; soft: string; text: string; border: string; ring: string; hex: string }> = {
  violet: { bg: "bg-violet-600", soft: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", ring: "ring-violet-400", hex: "#7c3aed" },
  blue: { bg: "bg-blue-600", soft: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", ring: "ring-blue-400", hex: "#2563eb" },
  emerald: { bg: "bg-emerald-600", soft: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", ring: "ring-emerald-400", hex: "#059669" },
  amber: { bg: "bg-amber-500", soft: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", ring: "ring-amber-400", hex: "#d97706" },
  rose: { bg: "bg-rose-600", soft: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", ring: "ring-rose-400", hex: "#e11d48" },
  cyan: { bg: "bg-cyan-600", soft: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", ring: "ring-cyan-400", hex: "#0891b2" },
  indigo: { bg: "bg-indigo-600", soft: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", ring: "ring-indigo-400", hex: "#4f46e5" },
};
