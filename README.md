# ReproClaw

Email a paper and repo. Get a reproducibility audit.

ReproClaw is an email-native reproducibility auditor for ML papers. A researcher forwards a paper + GitHub repo to an AgentMail inbox; ReproClaw extracts every auditable claim, uses Nia to align each claim to concrete code evidence, scores the repo on a transparent 0–100 scale, and replies in-thread with a reviewer-grade report citing exact file paths and line ranges.

Built for **OpenClaw Hackathon · Eragon × Nozomio × AgentMail**.

## What it does

```text
Email received → Paper parsed → Claims extracted → Repository indexed (Nia)
              → Claims aligned to code evidence → Reproducibility score
              → AgentMail reply in-thread with the report
```

Plus a streaming research chat (Claude Sonnet 4.6, with arXiv + GitHub search tools) for finding the right paper and its code in one place, and a per-page dashboard surface for Claims, Evidence, AgentMail, Reports, Repositories, and Settings.

## Co-host integrations

- **AgentMail** — webhook intake, thread-aware reply for both audit reports and follow-up explanations, dedup by `message_id`.
- **Nia (Nozomio)** — repo indexing on audit start, semantic code search via `ContextSearchClient.search` / `read`, deterministic local fallback when the API isn't reachable.

## Run API

```powershell
cd apps/api
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Open <http://localhost:8000> for the landing page or <http://localhost:8000/dashboard> for the live audit dashboard.

## Demo audits

Both demos run end-to-end against fixtures in `demo_data/` — no network required.

```powershell
# Case A — flags `epochs: 100 (paper) vs 50 (config)`
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/audits" `
  -ContentType "application/json" `
  -Body '{"paper_url":"demo:case_a","repo_url":"demo:case_a","question":"Check accuracy and training setup."}'

# Case B — flags undocumented multi-seed aggregation
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/audits" `
  -ContentType "application/json" `
  -Body '{"paper_url":"demo:case_b","repo_url":"demo:case_b","question":"Check seed aggregation."}'
```

Watch the dashboard's Live Audit view populate the timeline, claim table, and evidence panel as the pipeline runs. Both completed audits also appear under Reports, AgentMail (as threads), and Repositories.

## Live Audit start flow

The dashboard's audit-start panel accepts paper input as **arXiv URL / arXiv ID / PDF URL** or a **drag-and-drop PDF upload** (extracted via `pypdf`). The repo field is optional — `Find for me` resolves the paper through the arXiv Atom API and proposes the top 3 GitHub repos via the Search API (no LLM round-trip).

```text
arXiv lookup → GitHub search → Nia index → Audit running
```

## Research chat (streaming)

Click `Chat` in the sidebar (or press `/`). The chat panel runs a Claude Sonnet 4.6 agent with two tools:

- `search_arxiv(query, max_results)` — arXiv Atom API, throttled to 3.2 s and Retry-After-aware.
- `search_github(query, max_results)` — anonymous GitHub search.

Responses stream over Server-Sent Events. The right-side **Search activity** rail visualizes the agent live: arXiv / GitHub satellites pulse as their tool fires, particles travel along the arc to the active tool, result ripples emit on the satellite, the counter ticks `papers · repos`, and a charge meter glows the central paw mark brighter as findings accumulate. The assistant bubble streams token-by-token under a blinking caret.

## Stack

```text
Backend  : FastAPI · uvicorn · httpx · anthropic · pypdf · python-multipart
Storage  : sqlite3 (stdlib) — audits, audit_events, claims, evidence, messages, chat_*
Frontend : plain HTML · plain CSS · plain JS (ES2020+) · inline SVG icons
Fonts    : Instrument Serif (display) · IBM Plex Sans (body) · IBM Plex Mono (mono)
Models   : Claude Sonnet 4.6 (chat agent, prompt-cached system + tools)
```

No frontend frameworks. No CSS frameworks. No charting / markdown / animation libraries.

## Project structure

```text
apps/api/                    FastAPI service
  app/
    main.py                  routes + view switching
    audit_pipeline.py        deterministic audit pipeline
    chat.py                  streaming Claude agent loop (SSE)
    nia_client.py            Nia HTTP + local fallback (search_for_claim)
    agentmail_client.py      thread reply + send_message
    discover.py              arXiv Atom + GitHub Search (no LLM)
    paper_parser.py          pypdf wrapper (isolated PDF dep)
    claim_extractor.py       regex extraction (epochs/seeds/lr/...)
    static_checker.py        deterministic verdicts + severity
    scoring.py               transparent score formula
    reporter.py              email-style report template
    followup.py              `explain claim N` handler
    storage.py               SQLite schema + CRUD
    config.py                stdlib `.env` loader + Settings
    static/
      index.html             landing page
      dashboard.html         single-page dashboard (data-view switcher)
      app.js                 audit polling + chat SSE + view router
      styles.css             single stylesheet (sidebar + chat + audit + activity rail)
      pages/                 self-contained per-page UIs
        claims/  evidence/  agentmail/  reports/  repositories/  settings/
      logos/                 brand + integration SVGs
demo_data/
  case_a/                    epochs mismatch
  case_b/                    missing multi-seed aggregation
docs/
  CLAUDE.md                  Claude-owned scope (frontend)
  codex.md                   Codex-owned scope (backend)
  demo_script.md             3-minute live demo
  prompts.md                 LLM prompt drafts
  nia.md                     Nia local-source notes
design-guide.md              the canonical design system
```

## Configuration

`.env` keys (see `.env.example`):

```text
AGENTMAIL_API_KEY=
AGENTMAIL_INBOX_ID=
AGENTMAIL_WEBHOOK_SECRET=
NIA_API_KEY=
NIA_PROJECT_ID=
NIA_SOURCE_IDS=                # CSV; falls back to nia.json local sources
ANTHROPIC_API_KEY=
DATABASE_URL=sqlite:///./reproclaw.db
REPO_CACHE_DIR=.cache/repos
PDF_CACHE_DIR=.cache/papers
PUBLIC_APP_URL=
API_BASE_URL=http://localhost:8000
```

## API surface

```text
POST /audits                        Create an audit (also indexes the repo with Nia)
POST /audits/discover               Resolve paper → top-3 GitHub repo candidates
POST /audits/upload-paper           Multipart PDF upload → cache + page count
GET  /audits                        List audits
GET  /audits/{id}                   Audit detail (claims + evidence + events)
GET  /audits/{id}/events            SSE stream of pipeline events
POST /audits/{id}/claims/{cid}/explain   Render evidence-grounded claim explanation
POST /audits/{id}/followups         Reply to "explain claim N" inside an AgentMail thread
POST /audits/{id}/email-report      Send the report via AgentMail

POST /webhooks/agentmail            Inbound webhook (dedup by message_id)

POST /chat/conversations            Create chat conversation
GET  /chat/conversations            List conversations
GET  /chat/conversations/{id}       Get conversation history
POST /chat/conversations/{id}/messages         Non-streaming send (legacy)
POST /chat/conversations/{id}/messages/stream  Streaming send (SSE)

GET  /search                        Application-wide search (SQLite + Nia)
GET  /                              Landing page
GET  /dashboard                     Single-page dashboard
GET  /health                        Service ping
```

## Reproducibility score (transparent)

```text
score = 100
score -= 18 × high_severity_flags
score -= 10 × medium_severity_flags
score -=  5 × low_severity_flags
score -=  4 × unsupported_claims
score +=  2 × verified_claims
score = clamp(score, 0, 100)
```

Bands: ≥85 strong · ≥70 mostly w/ concerns · ≥50 significant concerns · <50 not reproducible.

## Design system

Every surface in this app inherits the same editorial-minimalism aesthetic, codified in **[`design-guide.md`](./design-guide.md)** — warm paper background (`#fbfaf6`), deep ink typography, hairline rules, mono small-caps section labels, a single signal-blue accent (`#1b4ed8`), inline SVG icons at 16 px / 1.5 px stroke. The guide is the contract every page agent followed.

## Demo script

A 3-minute live walkthrough lives at **[`docs/demo_script.md`](./docs/demo_script.md)**. The fallback if the live email path fails: click `Run Demo Audit` in the dashboard or POST `demo:case_a`.

## Submission

- **Hackathon**: OpenClaw Hackathon — Eragon × Nozomio × AgentMail
- **Co-host integrations**: AgentMail + Nia (both)
- **Models**: Anthropic Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- **Demo**: <http://localhost:8000/dashboard>
