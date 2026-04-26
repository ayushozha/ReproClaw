<div align="center">

<img src="./apps/api/app/static/logos/reproclaw.svg" alt="ReproClaw" width="420" />

# ReproClaw

### Email a paper and a repo. Get a reproducibility audit back.

**An email-native AI research auditor that turns paper claims into code-backed evidence, scores reproducibility, and drafts a reviewer-grade report.**

[![OpenClaw Hackathon](https://img.shields.io/badge/OpenClaw-Hackathon-orange)](https://github.com/ayushozha/ReproClaw)
[![AgentMail](https://img.shields.io/badge/Powered%20by-AgentMail-155EEF)](https://docs.agentmail.to)
[![Nozomio Nia](https://img.shields.io/badge/Code%20memory-Nozomio%20Nia-1B4ED8)](https://trynia.ai)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688)](https://fastapi.tiangolo.com)
[![No frontend framework](https://img.shields.io/badge/Frontend-Plain%20HTML%20CSS%20JS-11131A)](#design-system)

</div>

---

## The Problem

AI research has a reproducibility bottleneck.

Every week, new ML papers claim better accuracy, cleaner training recipes, stronger baselines, and faster inference. Those claims often depend on details buried across PDFs, READMEs, config files, notebooks, training scripts, and evaluation code.

A reviewer who wants to verify one paper has to:

- read the paper and extract concrete claims,
- clone the repository,
- find the relevant configs and scripts,
- compare paper text against implementation evidence,
- decide what is verified, missing, or contradicted,
- write a defensible report with file paths and reasoning.

That is hours of manual work. ReproClaw makes the first pass take minutes.

---

## What ReproClaw Does

ReproClaw introduces a simple primitive:

```text
paper claim -> code evidence -> reproducibility verdict
```

Send or enter an arXiv paper and a GitHub repository. ReproClaw:

1. Resolves the paper from an arXiv URL, arXiv ID, PDF URL, PDF upload, or title.
2. Finds a likely matching GitHub repository when one is not provided.
3. Extracts auditable claims from the paper.
4. Indexes and searches the repository with Nia and local fallbacks.
5. Checks claims against configs, scripts, README evidence, and stored snippets.
6. Scores reproducibility on a transparent 0-100 scale.
7. Generates an email-style report with verified, flagged, and needs-review findings.
8. Lets the user inspect every audit stage in the dashboard.
9. Drafts an AgentMail report email for the author when the audit is complete.

```text
Audit request
  -> find paper
  -> find repo
  -> parse paper
  -> extract claims
  -> clone/index repo
  -> search evidence with Nia
  -> check claims
  -> generate report
  -> optional AgentMail delivery
```

---

## Why It Matters

Reproducibility is not a nice-to-have. It is how research becomes science.

ReproClaw helps catch issues like:

- paper says `epochs: 100`, repo default config says `epochs: 50`;
- paper reports a metric that does not appear in the evaluation script;
- paper claims multi-seed aggregation, repo only documents one run;
- paper cites a dataset split that is missing from the code;
- repo supports the method, but key evidence is scattered across files.

The goal is not to replace reviewers. The goal is to put the highest-risk claims and the exact evidence paths in front of them immediately.

---

## Sponsor Integrations

### AgentMail: the product surface

AgentMail lets ReproClaw live where researchers already work: email.

ReproClaw uses AgentMail for:

- inbound audit requests,
- webhook-driven intake,
- thread-aware report replies,
- follow-up explanations like `explain claim 3`,
- optional outbound author report delivery.

The email thread becomes the audit interface.

### Nozomio Nia: the code memory layer

Nia gives ReproClaw persistent codebase memory and semantic retrieval.

ReproClaw uses Nia for:

- project-wide indexed context,
- repository search during claim checking,
- evidence retrieval from claim text,
- durable code memory across agent sessions,
- local fallback when remote retrieval is unavailable.

This is what turns an unsupported natural-language claim into a concrete evidence path.

### OpenClaw x Eragon: agents that act

ReproClaw is not just a chatbot. It receives a real request, searches real artifacts, produces a structured audit, and can defend the result in a live thread.

---

## Current Product Surfaces

| Surface | What it does |
| --- | --- |
| Landing page | Explains the paper-to-audit workflow and shows the product story. |
| Live audit dashboard | Starts audits, follows progress, shows completed scores, and inspects every pipeline stage. |
| Stage inspector | Click any progress stage to see event messages, timestamps, inputs, claim counts, score, and retrieval context. |
| Research chat | Streaming Claude Sonnet 4.6 chat with arXiv and GitHub tools for finding papers and repos. |
| Search | Application-wide search over audits, claims, reports, evidence, and Nia-indexed context. |
| Claims | Evidence-backed claim table. |
| Evidence | Claim evidence detail view. |
| AgentMail | Report and thread surface for email-native flows. |
| Reports | Completed audit report library. |
| Repositories | Repository context and audit sources. |

---

## Demo Flow

### 1. Start an audit

Use the dashboard or send an AgentMail request containing a paper and optionally a repo.

```text
Paper: Semi-Supervised Classification with Graph Convolutional Networks
Repo:  https://github.com/tkipf/pygcn

Please check whether the reported setup and implementation evidence line up.
```

### 2. Watch the pipeline

The dashboard moves through:

```text
Audit request received
Finding the paper
Paper found
Finding the GitHub repo
GitHub repo found
Parsing the paper
Paper parsed
Finding the claims
Claims extracted
Cloning the repo
Repo cloned
Searching evidence with Nozomio
Evidence searched
Checking claims against code
Claims checked
Generating the report
Report generated
Email decision
```

Every stage is clickable and inspectable.

### 3. Review the result

The completed audit shows:

- reproducibility score,
- verified / flagged / needs-review counts,
- claim table,
- evidence snippets,
- generated report,
- editable author email draft.

---

## Quick Start

### Prerequisites

- Python 3.12+
- `uv`
- AgentMail API key and inbox ID
- Nia API key or local Nia source
- Anthropic API key for the research chat

### Configure

Create `.env` from `.env.example`:

```text
AGENTMAIL_API_KEY=
AGENTMAIL_INBOX_ID=
AGENTMAIL_WEBHOOK_SECRET=

NIA_API_KEY=
NIA_PROJECT_ID=
NIA_SOURCE_IDS=

ANTHROPIC_API_KEY=

DATABASE_URL=sqlite:///./reproclaw.db
REPO_CACHE_DIR=.cache/repos
PDF_CACHE_DIR=.cache/papers
PUBLIC_APP_URL=
API_BASE_URL=http://localhost:8000
AUDIT_STEP_DELAY_S=0.6
```

### Run

```powershell
cd apps/api
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Open:

- Landing page: <http://localhost:8000>
- Dashboard: <http://localhost:8000/dashboard>
- Health check: <http://localhost:8000/health>

---

## Demo Audits

Both demo audits run against local fixtures in `demo_data/`.

```powershell
# Case A: flags epochs mismatch
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/audits" `
  -ContentType "application/json" `
  -Body '{"paper_url":"demo:case_a","repo_url":"demo:case_a","question":"Check accuracy and training setup."}'

# Case B: flags missing multi-seed aggregation
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/audits" `
  -ContentType "application/json" `
  -Body '{"paper_url":"demo:case_b","repo_url":"demo:case_b","question":"Check seed aggregation."}'
```

Then open <http://localhost:8000/dashboard> and inspect the live progress timeline, claims, evidence, and generated report.

---

## API Surface

```text
POST /audits                              Create an audit
POST /audits/discover                     Resolve paper and GitHub candidates
POST /audits/upload-paper                 Upload PDF and cache parsed text
GET  /audits                              List audits
GET  /audits/{id}                         Get audit detail
GET  /audits/{id}/events                  Stream pipeline events
POST /audits/{id}/claims/{cid}/explain    Explain a claim with evidence
POST /audits/{id}/followups               Handle AgentMail follow-up questions
POST /audits/{id}/email-report            Send a completed report through AgentMail

POST /webhooks/agentmail                  AgentMail webhook intake

POST /chat/conversations                  Create research chat conversation
GET  /chat/conversations                  List conversations
GET  /chat/conversations/{id}             Conversation history
POST /chat/conversations/{id}/messages    Non-streaming send
POST /chat/conversations/{id}/messages/stream
                                            Streaming send over SSE

GET  /search                              App-wide search over SQLite and Nia
GET  /                                    Landing page
GET  /dashboard                           Single-page dashboard
GET  /health                              Service ping
```

---

## Reproducibility Score

The score is intentionally transparent:

```text
score = 100
score -= 18 * high_severity_flags
score -= 10 * medium_severity_flags
score -=  5 * low_severity_flags
score -=  4 * unsupported_claims
score +=  2 * verified_claims
score = clamp(score, 0, 100)
```

| Score | Verdict |
| --- | --- |
| 85-100 | Strongly reproducible |
| 70-84 | Mostly reproducible with concerns |
| 50-69 | Significant reproducibility concerns |
| 0-49 | Not reproducible from available evidence |

---

## Stack

```text
Backend  : FastAPI, uvicorn, httpx, pypdf, python-multipart
Storage  : sqlite3 stdlib
Frontend : plain HTML, plain CSS, plain JavaScript, inline SVG
Search   : SQLite + Nia + deterministic local repository fallback
Email    : AgentMail webhook, threaded replies, report send
LLM      : Claude Sonnet 4.6 for streaming research chat
Fonts    : Instrument Serif, IBM Plex Sans, IBM Plex Mono
```

No React. No Next.js. No Tailwind. No shadcn. No charting library. No animation library. No frontend build step.

---

## Project Structure

```text
apps/api/
  app/
    main.py                  FastAPI routes and static views
    audit_pipeline.py        Audit event pipeline
    agentmail_client.py      AgentMail replies and report sending
    chat.py                  Streaming Claude research chat
    claim_extractor.py       Claim extraction heuristics
    config.py                .env loader and settings
    discover.py              arXiv/OpenAlex/GitHub discovery
    email_parser.py          Email request parsing
    followup.py              "explain claim N" handling
    nia_client.py            Nia interface and local fallback
    paper_parser.py          PDF parsing
    reporter.py              Email-style report generation
    scoring.py               Transparent score formula
    search.py                App-wide search
    static_checker.py        Deterministic claim checks
    storage.py               SQLite schema and CRUD
    static/
      index.html             Landing page
      dashboard.html         Dashboard shell
      app.js                 Dashboard, audit polling, chat, search
      styles.css             Shared dashboard design system
      favicon.svg            ReproClaw favicon
      site.webmanifest       App manifest
      logos/                 Brand and integration assets
      pages/                 Claims, Evidence, AgentMail, Reports, Repos, Settings

demo_data/
  case_a/                    Epoch mismatch fixture
  case_b/                    Multi-seed aggregation fixture

docs/
  CLAUDE.md                  Claude implementation scope
  codex.md                   Codex implementation scope
  demo_script.md             3-minute demo script
  nia.md                     Nia codebase memory notes
  prompts.md                 Prompt drafts

design-guide.md              Canonical ReproClaw design system
```

---

## Design System

ReproClaw follows a refined editorial-minimalism system:

- warm paper background,
- pure white panels,
- deep ink type,
- hairline rules,
- mono small-caps labels,
- one signal-blue accent,
- inline SVG icons,
- Instrument Serif for display,
- IBM Plex Sans and IBM Plex Mono for UI and metadata.

The contract lives in [`design-guide.md`](./design-guide.md).

---

## Acceptance Criteria

- [x] Accept audit requests from dashboard or AgentMail.
- [x] Resolve arXiv papers by URL, ID, PDF URL, upload, or title.
- [x] Suggest matching GitHub repositories.
- [x] Index and search code context with Nia/local fallback.
- [x] Extract claims and check static evidence.
- [x] Generate transparent reproducibility scores.
- [x] Stream live audit progress.
- [x] Make each pipeline stage inspectable.
- [x] Render completed audit reports.
- [x] Draft and send report emails through AgentMail.
- [x] Provide streaming research chat with arXiv and GitHub tools.
- [x] Search across audits, claims, evidence, reports, and Nia context.

---

## Roadmap

**Now:** static reproducibility audits with evidence paths, email-native delivery, stage inspection, and research search.

**Next:** richer claim extraction, stronger repo-to-paper matching, dynamic execution in a sandbox, reviewer-ready PDF export, and batch audit mode.

**Later:** GitHub PR comments, conference-scale reproducibility queues, author-facing fix suggestions, and a public registry of audit outcomes.

---

## Credits

Built for the OpenClaw Hackathon: Eragon x Nozomio x AgentMail.

Powered by AgentMail, Nozomio Nia, FastAPI, Anthropic Claude, and a dependency-light plain-web dashboard.

See [`spec.md`](./spec.md) for the original technical specification.
