# Codex Today Plan

Date: April 25, 2026

## Goal

Build the smallest backend-first ReproClaw MVP that proves the core demo:

1. Receive or simulate an AgentMail audit request.
2. Extract paper and repo inputs from the email body.
3. Produce auditable claims.
4. Use Nia to retrieve likely repo or paper evidence.
5. Flag at least one static mismatch.
6. Send a threaded AgentMail audit reply.
7. Expose a minimal dashboard feed for the demo.

## Dependency Rule

Keep today's implementation to as few dependencies as possible.

Allowed first-pass dependencies:

1. `fastapi`
2. `uvicorn`
3. `httpx`

Use Python standard library for everything else:

1. `sqlite3` for persistence
2. `re` for email parsing
3. `json` and `dataclasses` for simple models
4. `pathlib`, `tempfile`, and `subprocess` for local repo handling
5. plain string templates for email reports

Avoid today unless absolutely needed:

1. Next.js, React, Tailwind, shadcn/ui
2. SQLModel or SQLAlchemy
3. GitPython
4. PyMuPDF and full PDF parsing
5. tree-sitter
6. Redis, background workers, queues
7. Docker or arbitrary code execution
8. paid deployment or production auth

If PDF extraction becomes necessary for the demo, add exactly one PDF library later and keep it isolated behind `paper_parser.py`.

## Codex-Owned Features

### 1. Backend Skeleton

Create:

```text
apps/api/
  app/
    main.py
    config.py
    storage.py
    models.py
    agentmail_client.py
    nia_client.py
    email_parser.py
    audit_pipeline.py
    claim_extractor.py
    static_checker.py
    scoring.py
    reporter.py
    followup.py
    static/
      index.html
      app.js
      styles.css
```

No separate frontend app today. Serve the dashboard as static files from FastAPI.

### 2. Configuration

Read `.env` with a tiny stdlib parser so `python-dotenv` is not required.

Required values:

```bash
AGENTMAIL_API_KEY=
NIA_API_KEY=
```

Optional values:

```bash
AGENTMAIL_INBOX_ID=
PUBLIC_APP_URL=
API_BASE_URL=http://localhost:8000
REPO_CACHE_DIR=.cache/repos
PDF_CACHE_DIR=.cache/papers
```

### 3. AgentMail Intake

Implement:

```http
POST /webhooks/agentmail
POST /audits
```

The webhook route should:

1. Accept AgentMail webhook JSON.
2. Extract `thread_id`, `message_id`, sender, subject, body, and attachments if present.
3. Deduplicate by `message_id`.
4. Create an audit job.
5. Start the audit pipeline with `asyncio.create_task`.

The manual route should support demo fallback without a live webhook:

```json
{
  "paper_url": "https://arxiv.org/pdf/2401.xxxxx",
  "repo_url": "https://github.com/example/paper-code",
  "question": "Check accuracy and training setup."
}
```

### 4. Email Parser

Extract:

1. arXiv IDs
2. PDF URLs
3. GitHub repo URLs
4. focused user question

Use regex only. Store the raw email body for traceability.

### 5. Storage

Use `sqlite3` with a single local database:

```text
reproclaw.db
```

Tables:

1. `audits`
2. `audit_events`
3. `claims`
4. `evidence`
5. `messages`

Keep schemas flat and JSON-encode nested data where needed.

### 6. Audit Pipeline

Implement a deterministic pipeline:

```text
queued
parsing_request
loading_paper
extracting_claims
searching_evidence
checking_claims
scoring
rendering_report
sending_reply
done
```

Each stage should append an `audit_events` row for the dashboard.

### 7. Claim Extraction

For today's MVP, support two paths:

1. Fixture mode for the demo paper.
2. Simple regex extraction for auditable claims.

Extract claims about:

1. epochs
2. seed counts
3. learning rate
4. batch size
5. optimizer
6. dataset
7. accuracy or F1

Do not build a full paper table parser today.

### 8. Nia Evidence Search

Wrap Nia behind one internal interface:

```python
class ContextSearchClient:
    async def index_source(self, source_type: str, source_uri: str) -> str: ...
    async def search(self, query: str, source_ids: list[str], top_k: int = 8) -> list[dict]: ...
    async def read(self, source_id: str, path: str) -> str: ...
```

If the Nia API shape blocks progress, provide a fallback search that scans cloned repo text files using stdlib file walking and regex. Keep the fallback behind the same interface.

### 9. Static Discrepancy Checker

Implement only deterministic checks:

1. paper `epochs` vs config `epochs`
2. paper `seed_count` vs script or README evidence
3. paper `learning_rate` vs config value
4. paper metric name vs code metric name
5. unsupported claim when no evidence is found

Do not execute repo code.

### 10. Scoring

Implement the spec's transparent heuristic:

```text
score = 100
score -= 18 * high_severity_flags
score -= 10 * medium_severity_flags
score -= 5 * low_severity_flags
score -= 4 * unsupported_claims
score += 2 * verified_claims
score = clamp(score, 0, 100)
```

### 11. AgentMail Reply

Render a plain text report first. HTML can be added only after the plain text path works.

Reply in-thread when `thread_id` is available. For manual demo jobs, store the report and show it in the dashboard.

### 12. Follow-Up Handling

Implement one follow-up feature:

```text
explain claim 3
```

The response should reload the stored claim, evidence snippet, and verdict reason, then reply in the same AgentMail thread.

### 13. Minimal Dashboard API

Implement:

```http
GET /
GET /audits
GET /audits/{audit_id}
GET /audits/{audit_id}/events
```

Use Server-Sent Events for `/events`.

The static dashboard only needs:

1. audit list
2. current stage
3. score
4. claim table
5. evidence snippets
6. final email preview

## Demo Fixtures

Create fallback fixtures under:

```text
demo_data/
  case_a/
    paper.txt
    repo/
      configs/cifar10.yaml
      train.py
  case_b/
    paper.txt
    repo/
      README.md
      train.py
```

Case A must flag:

```text
Paper says 100 epochs.
Config says 50 epochs.
```

Case B must flag:

```text
Paper says averaged over 5 seeds.
Repo has no seed aggregation script.
```

## Acceptance Criteria

Codex is done today when:

1. `uvicorn app.main:app --reload --port 8000` starts.
2. `POST /audits` creates an audit from a paper and repo URL or fixture.
3. The pipeline emits dashboard events.
4. At least 5 claims are created for the fallback demo.
5. At least 1 claim is flagged with a concrete evidence path.
6. A report is rendered and stored.
7. AgentMail reply works when `thread_id` is present.
8. `explain claim 3` produces a stored-evidence explanation.

## Not Today

1. Full dynamic reproduction.
2. General support for all ML papers.
3. Multi-user auth.
4. Billing.
5. Production queues.
6. Full PDF table extraction.
7. Polished Next.js UI.
