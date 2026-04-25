<div align="center">

# 🦅 ReproClaw

### *Email a paper and a repo. Get a reproducibility audit back.*

**An email-native AI research auditor that connects scientific claims to code evidence — and defends its verdict in a live email thread.**

[![Built at OpenClaw Hackathon](https://img.shields.io/badge/OpenClaw-Hackathon%202026-orange)](https://github.com/ayushozha/ReproClaw)
[![Powered by AgentMail](https://img.shields.io/badge/Powered%20by-AgentMail-blue)](https://agentmail.to)
[![Context by Nozomio Nia](https://img.shields.io/badge/Context%20by-Nozomio%20Nia-purple)](https://nozom.io)
[![Theme: Eragon](https://img.shields.io/badge/Theme-Eragon-red)](https://eragon.ai)
[![Status: MVP](https://img.shields.io/badge/Status-Hackathon%20MVP-green)]()

</div>

---

## 🚨 The Problem: AI Research Has a Reproducibility Crisis

Every week, hundreds of machine learning papers land on arXiv claiming new state-of-the-art results. **Almost none of them are independently verified before being cited, deployed, or built upon.**

A typical ML paper makes dozens of quantitative claims:

- Reported accuracy, F1, AUROC, BLEU, reward, latency, cost
- Training settings: epochs, learning rate, batch size, seeds, optimizer
- Dataset sizes, filtering rules, splits
- Baseline numbers copied from prior work
- Ablation deltas and model variants

And yet, the **code defaults silently differ from paper claims** more often than the field admits. A config file that says `epochs: 50` while the paper claims `100`. An evaluation script that computes macro-F1 while the abstract reports accuracy. A "mean over 5 seeds" claim with no aggregation script in the repo.

A human reviewer can catch these — but it takes **hours per paper**: read the PDF, find every important claim, clone the repo, locate training and evaluation scripts, compare configs, and sometimes actually run the code. Reviewers don't have hours. So it doesn't get done.

The result: **a generation of AI research that the community trusts on faith, not evidence.**

---

## 💡 Why This Is Crucial

Reproducibility isn't a nice-to-have — it's the foundation of scientific progress and the *only* defense against:

- 🧪 **Wasted research effort** — labs reproducing methods that never worked as claimed
- 💰 **Wasted compute** — millions of GPU-hours chasing numbers that came from a tuned config no one published
- 🏢 **Wasted enterprise budgets** — companies productizing techniques whose paper claims don't match their actual implementation
- 📉 **Erosion of trust** — every undetected mismatch weakens the credibility of AI research as a whole
- ⚖️ **Regulatory risk** — as AI moves into healthcare, finance, and policy, "the paper said so" stops being a valid defense

The scientific method is built on independent verification. ML papers without reproducibility audits are unreviewed conjecture in a lab coat.

**ReproClaw fixes the first 80% of that audit, automatically, in minutes — by email.**

---

## 🎯 What ReproClaw Solves

ReproClaw introduces a new primitive for AI research:

```
Scientific claim  →  Code evidence  →  Reproducibility verdict
```

Email ReproClaw an arXiv ID, a PDF, and a GitHub repo. It will:

1. **Extract every auditable claim** from the paper — accuracy numbers, training hyperparameters, dataset choices, ablation deltas, baseline comparisons.
2. **Index the codebase** semantically using Nozomio Nia, so claims can be matched to the actual files that implement them.
3. **Align each claim to candidate code** — searching configs, training scripts, eval pipelines, READMEs.
4. **Run static discrepancy checks** — does the paper's `epochs=100` match the repo's `epochs=50`? Does the metric in the abstract exist in the code?
5. **Score reproducibility** on a transparent 0–100 scale with severity-weighted deductions.
6. **Reply by email** with a structured audit report: verified claims, flagged claims, evidence snippets, and limitations.
7. **Defend the verdict** — reply "why did you flag claim 3?" and ReproClaw answers in the same thread, with the exact file, line, and reasoning.

No dashboard required to use it. No API client to install. **Just email an agent and get back a reproducibility audit.**

---

## 🔧 How It Works

```
                  ┌─────────────────────────────────┐
                  │   👤  Researcher emails inbox   │
                  │   reproclaw@agentmail.to        │
                  └────────────────┬────────────────┘
                                   │
                                   ▼
                     ┌─────────────────────────┐
                     │  📬  AgentMail Webhook  │
                     │  (the agent's voice)    │
                     └────────────┬────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │  Audit Request Parser   │
                     │  arXiv ID · PDF · repo  │
                     └────────────┬────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │  Paper Fetch & Extract  │
                     │  PyMuPDF · sectioning   │
                     └────────────┬────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │  Structured Claim Extr. │
                     │  GPT-5 mini · JSON sch. │
                     └────────────┬────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │  🧠  Nia Index & Search │
                     │  (the context brain)    │
                     └────────────┬────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │  Claim ↔ Code Aligner   │
                     │  rerank · top evidence  │
                     └────────────┬────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │  Static Discrepancy Chk │
                     │  configs · metrics · ds │
                     └────────────┬────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │  Reproducibility Judge  │
                     │  GPT-5.2 · scoring      │
                     └────────────┬────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │  📨  AgentMail Reply    │
                     │  threaded · follow-ups  │
                     └─────────────────────────┘
```

The pipeline is fully asynchronous, streamed live to the dashboard via Server-Sent Events, and resilient to follow-up questions in the same email thread.

---

## 🤝 Sponsor Integrations — Why Each Is *Essential*, Not Decorative

ReproClaw is purpose-built around three sponsor capabilities. Removing any one of them collapses the product. This isn't sponsor-namedropping — it's an architecture that *requires* all three to exist.

### 📬 AgentMail — The Product Surface

> *AgentMail is not a notification channel for ReproClaw. It is the entire user interface.*

Most AI agents need a website, an API key, and a sign-up flow before a user can do anything useful. ReproClaw needs **an email address.**

AgentMail provides:

- **A dedicated inbox** (`reproclaw@agentmail.to`) that receives audit requests from anyone, anywhere — no auth, no onboarding.
- **Threaded conversations** that let the agent defend its verdict, answer "why did you flag this?", and have a real back-and-forth review with the researcher.
- **Structured extraction from unstructured emails** — pulling arXiv IDs, repo URLs, attachments, and the user's actual question out of free-form text.
- **Status labels** (`queued`, `running`, `flagged`, `verified`, `failed`) so the inbox itself becomes a job queue and dashboard.
- **Webhooks with signature verification** so the backend stays secure and idempotent.

Why this matters: peer review *already happens by email.* Authors send drafts to colleagues, reviewers send comments back, conversations span weeks. ReproClaw inserts itself into that existing workflow as just another collaborator — one that always replies in under three minutes with cited evidence. AgentMail is what makes the agent *belong in the conversation* rather than being a separate tool researchers have to remember to visit.

### 🧠 Nozomio Nia — The Context Brain

> *Nia is what turns a scientific claim into a code citation.*

The hardest engineering problem in ReproClaw isn't extracting claims (LLMs handle that). It isn't sending email (AgentMail handles that). It's **semantic alignment** — given a sentence like *"We train for 100 epochs on CIFAR-10"*, find the exact line in the repository that should implement it.

That requires understanding the paper, the codebase, and the cited prior work — across PDFs, READMEs, configs, scripts, and notebooks — as one connected graph of meaning. That is exactly what Nia is built for.

ReproClaw uses Nia to:

- **Index the paper, appendix, repo, configs, and README** as a single retrieval surface.
- **Search from claim text to candidate code paths** using semantic search, not just grep.
- **Retrieve top-k snippets** with file paths and line ranges, ready for the static checker.
- **Re-load evidence on follow-up** so the agent can answer "why did you flag claim 3?" hours later, in a new email reply, with the same grounded evidence.
- **Optionally pre-index fallback papers and repos** for resilient demos.

Why this matters: without Nia, ReproClaw would either need a brittle hand-rolled grep-and-rerank pipeline, or it would hallucinate code citations. Nia is the difference between *"I think this claim is implemented somewhere"* and *"This claim is implemented in `configs/cifar10.yaml:14`, and here is the snippet."*

### 🔥 Eragon × OpenClaw — Agents That Act in the World

ReproClaw embodies the OpenClaw theme of *agents that act in the world*, not chatbots that answer in a sandbox. It:

1. **Receives** real external requests by email — from anyone, on the open internet.
2. **Investigates** real research artifacts — actual arXiv papers, actual GitHub repos.
3. **Uses tools** to retrieve evidence: paper parsers, repo loaders, semantic search, static checkers.
4. **Makes a structured judgment** with a transparent score and severity grades.
5. **Defends that judgment** in a live conversation, in the open, with a researcher who can challenge it.

This is the Eragon thesis: an agent that ships a real artifact (an audit report) into a real channel (email), is held accountable for it (follow-up questions), and reasons about real-world objects (papers and code) — not a demo that lives forever in a Jupyter notebook.

---

## 🎬 Demo Flow

**1. The judge sends an email:**

```
To: reproclaw@agentmail.to
Subject: Audit this ML paper

Paper: arXiv:2401.xxxxx
Repo:  https://github.com/example/paper-code

Please check whether the reported accuracy and training setup match the code.
```

**2. The dashboard streams live progress:**

```
✓ Email received through AgentMail
✓ Paper parsed
✓ 12 claims extracted
✓ Repository indexed with Nia
✓ Claims aligned to candidate code files
✓ 5 claims verified
⚠ 2 claims flagged
⚠ 1 claim needs manual review
✓ Audit reply sent
```

**3. ReproClaw replies through AgentMail:**

```
Reproducibility Score: 72 / 100

⚠ Flagged Claim 3
   Paper:    "We train for 100 epochs."
   Code:     configs/cifar10.yaml sets epochs: 50.
   Verdict:  Flagged — default training config does not match the paper.

⚠ Flagged Claim 6
   Paper:    "Mean over 5 seeds."
   Code:     train.py exposes seed but README only documents one run.
   Verdict:  Needs review — multi-seed aggregation is not documented.
```

**4. The judge replies in-thread:**

```
Why did you flag claim 3?
```

**5. ReproClaw answers in the same thread:**

```
I flagged claim 3 because the paper states 100 training epochs, but
the repo default config sets epochs to 50. I also did not find a
README command that overrides this value to 100.
```

That's the entire product. No dashboard required. No CLI. Just email.

---

## 📊 Reproducibility Scoring

Transparent, deterministic, defensible:

```
score = 100
score -=  18 × high_severity_flags
score -=  10 × medium_severity_flags
score -=   5 × low_severity_flags
score -=   4 × unsupported_claims
score +=   2 × verified_claims
score  =  clamp(score, 0, 100)
```

**Verdict bands:**

| Score    | Verdict                                            |
| -------- | -------------------------------------------------- |
| 85 – 100 | Strongly reproducible (first pass)                 |
| 70 – 84  | Mostly reproducible with concerns                  |
| 50 – 69  | Significant reproducibility concerns               |
| 0 – 49   | Not reproducible from available evidence           |

The score is intentionally a heuristic — humans should still review flagged claims. ReproClaw's job is to make sure the *important things to look at* surface in seconds, not hours.

---

## 🛠️ Tech Stack

**Frontend** — Next.js (latest, App Router) · React 19.2 · TypeScript 6.0 · Tailwind · shadcn/ui · Server-Sent Events for live audit progress · Zod for schema validation.

**Backend** — Python 3.14.4 · FastAPI 0.136 · Pydantic 2.13 · uv · Uvicorn · SQLite (hackathon) → Postgres (prod) · PyMuPDF for PDF extraction · GitPython for repo cloning · tree-sitter / ripgrep for code search fallback.

**Agent & LLM Layer** — OpenAI Responses API with Structured Outputs · GPT-5.2 (final judge, hard reasoning) · GPT-5 mini (fast claim extraction) · function calling for Nia, repo fetch, AgentMail reply, and static checks.

**Sponsor SDKs** — `agentmail` (Python SDK) · Nia via `npx nia-wizard@latest` and a `ContextSearchClient` interface that wraps `index_source`, `search`, and `read`.

**Deployment** — Local FastAPI + ngrok for the hackathon demo · Vercel for the dashboard · Modal/E2B for sandboxed execution if dynamic reproduction is enabled.

---

## 📁 Repository Structure

```
reproclaw/
├── README.md
├── spec.md
├── .env.example
└── apps/
    ├── web/                    Next.js dashboard
    │   ├── app/
    │   ├── components/
    │   └── lib/
    └── api/                    FastAPI backend
        ├── app/
        │   ├── main.py
        │   ├── agentmail_client.py
        │   ├── nia_client.py
        │   ├── paper_parser.py
        │   ├── repo_loader.py
        │   ├── claim_extractor.py
        │   ├── aligner.py
        │   ├── static_checker.py
        │   ├── judge.py
        │   ├── reporter.py
        │   └── followup.py
        └── tests/
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.14+ with `uv`
- Node.js 24+ with `pnpm`
- AgentMail API key + inbox
- Nozomio Nia API key + project
- OpenAI API key (GPT-5 family)

### Environment Variables

Create `.env` from `.env.example`:

```bash
AGENTMAIL_API_KEY=
AGENTMAIL_INBOX_ID=
AGENTMAIL_WEBHOOK_SECRET=

NIA_API_KEY=
NIA_PROJECT_ID=

OPENAI_API_KEY=
OPENAI_CLAIM_MODEL=gpt-5-mini
OPENAI_JUDGE_MODEL=gpt-5.2

DATABASE_URL=sqlite:///./reproclaw.db
REPO_CACHE_DIR=/tmp/reproclaw/repos
PDF_CACHE_DIR=/tmp/reproclaw/papers
PUBLIC_APP_URL=
API_BASE_URL=http://localhost:8000
```

### Run the backend

```bash
cd apps/api
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

### Run the dashboard

```bash
cd apps/web
pnpm install
pnpm dev
```

### Expose the AgentMail webhook

```bash
ngrok http 8000
# → register the public URL with your AgentMail inbox webhook
```

### Trigger an audit by email

Send any email to your AgentMail inbox containing an arXiv link and a GitHub URL. Watch the dashboard timeline at `http://localhost:3000`.

---

## ✅ Acceptance Criteria

The MVP is successful if every one of these is true:

- [x] A user can email an audit request to an AgentMail inbox.
- [x] The backend receives and parses the request.
- [x] The system extracts at least 5 paper claims.
- [x] The system uses Nia to retrieve repo or paper evidence.
- [x] The system flags at least one meaningful mismatch.
- [x] The dashboard streams the audit process live.
- [x] The system sends a final report through AgentMail.
- [x] A user can reply with a follow-up question.
- [x] The agent answers the follow-up in the same thread with cited evidence.
- [x] The end-to-end demo completes in under 3 minutes.

---

## 🗺️ Roadmap

**Now (MVP):** static reproducibility audits over email, with semantic claim-to-code alignment and follow-up explanations.

**Next:** sandboxed *dynamic* reproduction — actually run the training script on a small subset and compare reported vs observed metrics. Author-facing mode that suggests fixes. Reviewer-facing mode that drafts conference-ready reproducibility reports. Memory of common failure patterns across papers.

**Later:** GitHub PR comment integration, IDE plugins, conference-scale batch audits, an open registry of reproducibility scores for arXiv papers.

---

## 🏆 Why ReproClaw Wins

Most agents at most hackathons answer questions. They are demos that recite information.

**ReproClaw audits whether AI research claims are supported by implementation evidence.** It produces a verifiable artifact (a reproducibility score with cited evidence), it is held accountable for it (follow-up questions in the same thread), and it slots into a workflow that already exists (email between researchers).

It introduces a new primitive that the AI research community has needed for years:

> **Every AI paper should come with a machine-generated reproducibility audit before publication.**

ReproClaw is the first credible attempt to make that audit a single email away.

---

## 📜 License & Credits

Built at the **OpenClaw Hackathon — Eragon × Nozomio × AgentMail** on April 25, 2026.

Powered by [AgentMail](https://agentmail.to), [Nozomio Nia](https://nozom.io), and the OpenAI Responses API.

See [`spec.md`](./spec.md) for the full technical specification.
