# ReproClaw Specification

**Project:** ReproClaw  
**Event:** OpenClaw Hackathon, Eragon × Nozomio × AgentMail  
**Date:** April 25, 2026  
**Status:** Hackathon MVP specification  
**Tagline:** Email a paper and repo. Get a reproducibility audit.

## 1. Product Summary

ReproClaw is an email native research and code review agent for ML paper reproducibility.

A user emails ReproClaw an arXiv ID, paper PDF, GitHub repository, or a focused question. ReproClaw extracts the scientific claims from the paper, uses Nia to understand the paper and codebase, aligns claims to code evidence, detects mismatches, and replies through AgentMail with a structured audit report.

The product combines four official hackathon sample directions:

1. **AgentMail customer support style agent**  
   It receives inbound email, understands the request, and replies in thread.

2. **AgentMail invoice processing style extraction agent**  
   It extracts structured data from unstructured emails, papers, PDFs, and attachments.

3. **Nozomio research agent**  
   It indexes papers, docs, and cited context, then answers with grounded evidence.

4. **Nozomio coding and PR review agent**  
   It understands a codebase, finds relevant files, reviews implementation evidence, and flags risk.

## 2. Core Problem

ML papers often make quantitative claims that are hard to verify:

* Reported accuracy, F1, AUROC, BLEU, reward, latency, or cost
* Training settings such as epochs, learning rate, batch size, seeds, and optimizer
* Dataset sizes, filtering rules, and splits
* Baseline numbers copied from prior work
* Ablation deltas and model variants
* Code defaults that silently differ from paper claims

Manual reproducibility review is slow because a reviewer must read the paper, find every important claim, inspect the repo, locate training and evaluation scripts, compare configs, and sometimes run code.

ReproClaw automates the first reproducibility pass.

## 3. Demo Goal

The 3 minute demo should prove one thing:

**ReproClaw can connect a natural language scientific claim to concrete code evidence and explain the mismatch through an email thread.**

### Demo flow

1. Judge emails `reproclaw@agentmail.to`:

```text
Subject: Audit this ML paper

Paper: arXiv:2401.xxxxx
Repo: https://github.com/example/paper-code

Please check whether the reported accuracy and training setup match the code.
```

2. Dashboard streams progress:

```text
Email received through AgentMail
Paper parsed
12 claims extracted
Repository indexed with Nia
Claims aligned to candidate code files
5 claims verified
2 claims flagged
1 claim needs manual review
Audit reply sent
```

3. ReproClaw sends an AgentMail reply:

```text
Reproducibility Score: 72 / 100

Flagged Claim 3
Paper: "We train for 100 epochs."
Code evidence: configs/cifar10.yaml sets epochs: 50.
Verdict: Flagged because the default training config does not match the paper.

Flagged Claim 6
Paper: "Mean over 5 seeds."
Code evidence: train.py exposes seed but README only documents one run.
Verdict: Needs review because multi seed aggregation is not documented.
```

4. Judge replies:

```text
Why did you flag claim 3?
```

5. ReproClaw replies in the same thread:

```text
I flagged claim 3 because the paper states 100 training epochs, but the repo default config sets epochs to 50. I also did not find a README command that overrides this value to 100.
```

## 4. Sponsor Integration

### 4.1 AgentMail

AgentMail is the agent's real world voice and identity.

Required usage:

1. Create a dedicated inbox such as `reproclaw@agentmail.to`.
2. Receive audit requests through AgentMail.
3. Parse email body, attachments, and thread metadata.
4. Send the final reproducibility audit as an email reply.
5. Support follow up questions in the same thread.
6. Label threads by audit status: `queued`, `running`, `flagged`, `verified`, `failed`.

AgentMail is not just a notification tool. It is the primary product interface.

### 4.2 Nozomio Nia

Nia is the context brain.

Required usage:

1. Index or query the paper, appendix, README, repo files, configs, and cited sources.
2. Search from claim text to candidate code paths.
3. Retrieve snippets from likely files.
4. Support follow up explanations by retrieving the same evidence again.
5. Optionally index fallback papers and repos before demo.

Nia is core because the hardest problem is semantic alignment:

```text
Paper claim → relevant repo files → implementation evidence → verdict
```

### 4.3 Eragon and OpenClaw theme

The build fits the theme “agents that act in the world” because ReproClaw:

1. Receives real external requests by email.
2. Reads and investigates research artifacts.
3. Uses tools to retrieve code and paper evidence.
4. Makes a structured judgment.
5. Replies and defends the judgment in a live thread.

## 5. MVP Scope

### Must have

1. AgentMail inbox intake
2. Email parser for arXiv ID, PDF URL, GitHub repo URL, and focused user question
3. Paper text extraction
4. Structured claim extraction
5. Nia powered repo and paper search
6. Claim to code alignment
7. Static discrepancy checker
8. Reproducibility score
9. AgentMail report reply
10. Follow up explanation for one flagged claim
11. Minimal dashboard with status stream and audit table

### Should have

1. Attachment handling for PDFs
2. Nia search over cited paper abstracts or source links
3. Code snippet confidence scoring
4. HTML email report
5. Fallback demo mode for pre indexed paper and repo

### Could have

1. Sandboxed code execution for one small claim
2. GitHub issue or PR style audit export
3. Reviewer mode and author mode
4. Attack resistant prompt injection checks for README and paper content
5. Reusable memory of common reproducibility failure patterns

### Do not build today

1. Full fine tuning
2. Full paper table parser
3. General support for all ML papers
4. Full dynamic reproduction for arbitrary repos
5. Multi user auth
6. Billing
7. Production grade CI runner

## 6. Latest Recommended Technology Stack

### 6.1 Frontend

Use the latest Next.js app template.

```bash
pnpm create next-app@latest reproclaw-web --yes
cd reproclaw-web
pnpm dev
```

Recommended frontend choices:

1. **Next.js latest**
2. **React 19.2**
3. **TypeScript 6.0**
4. **Tailwind CSS latest**
5. **shadcn/ui CLI latest**
6. **shadcn/ui Luma style if time allows**
7. **Server Sent Events for live audit progress**
8. **Zod for client side schema validation**

Suggested dashboard pages:

```text
/app
  /page.tsx
  /audits/[id]/page.tsx
/components
  audit-status-timeline.tsx
  claim-table.tsx
  evidence-card.tsx
  email-thread-preview.tsx
  score-card.tsx
```

### 6.2 Backend

Use Python because paper parsing, repo analysis, and ML style claim extraction are easier.

Recommended backend choices:

1. **Python 3.14.4**
2. **FastAPI 0.136.0 or latest**
3. **Pydantic 2.13.3 or latest**
4. **uv latest**
5. **Uvicorn**
6. **SQLite for hackathon persistence**
7. **SQLModel or SQLAlchemy if persistence needs grow**
8. **PyMuPDF for PDF text extraction**
9. **GitPython for repo cloning**
10. **tree-sitter or ripgrep for code search fallback**
11. **PyYAML, TOML, JSON parsing for config inspection**

Backend setup:

```bash
mkdir reproclaw-api
cd reproclaw-api
uv init
uv python pin 3.14
uv add fastapi uvicorn pydantic python-dotenv httpx agentmail pymupdf gitpython pyyaml tomli sqlmodel
uv run uvicorn app.main:app --reload --port 8000
```

### 6.3 Agent and LLM Layer

Use OpenAI Responses API with Structured Outputs.

Recommended model split:

1. **GPT 5.2**
   Use for the final audit judge, code reasoning, and difficult mismatch explanations.

2. **GPT 5 mini**
   Use for fast structured claim extraction and lower cost classification.

3. **Structured Outputs**
   Use JSON schema for claims, evidence candidates, verdicts, and final reports.

4. **Function calling**
   Use tool calls for Nia search, repo file fetch, AgentMail reply, and static checker calls.

Suggested structured output objects:

```text
PaperClaim
EvidenceCandidate
StaticCheckResult
ClaimVerdict
AuditReport
FollowUpExplanation
```

### 6.4 Sponsor SDKs and APIs

AgentMail:

```bash
uv add agentmail
```

Nia:

```bash
npx nia-wizard@latest
```

Use Nia for indexing and search. If direct API details differ at the event, wrap the calls behind this internal interface:

```python
class ContextSearchClient:
    async def index_source(self, source_type: str, source_uri: str) -> str: ...
    async def search(self, query: str, source_ids: list[str], top_k: int = 8) -> list[dict]: ...
    async def read(self, source_id: str, path: str) -> str: ...
```

### 6.5 Deployment

For hackathon demo:

1. Frontend: Vercel or local Next.js
2. Backend: local FastAPI
3. Webhook exposure: ngrok or Cloudflare Tunnel
4. Database: SQLite
5. Repo cache: local `/tmp/reproclaw`
6. Secrets: `.env`

Production later:

1. Frontend: Vercel
2. Backend: Fly.io, Render, Railway, or Modal
3. Database: Postgres
4. Queue: Redis or Cloudflare Queues
5. Sandbox execution: Modal, E2B, Firecracker, or isolated Docker workers

## 7. System Architecture

```text
AgentMail Inbox
    ↓
Webhook Receiver
    ↓
Audit Request Parser
    ↓
Job Store
    ↓
Paper Fetcher and Parser
    ↓
Structured Claim Extractor
    ↓
Nia Index and Search
    ↓
Claim to Code Aligner
    ↓
Static Discrepancy Checker
    ↓
Reproducibility Judge
    ↓
Report Renderer
    ↓
AgentMail Threaded Reply
    ↓
Follow Up Explainer
```

## 8. Repository Structure

```text
reproclaw/
  README.md
  spec.md
  .env.example
  apps/
    web/
      app/
      components/
      lib/
      package.json
    api/
      app/
        main.py
        config.py
        models.py
        db.py
        agentmail_client.py
        nia_client.py
        paper_parser.py
        repo_loader.py
        claim_extractor.py
        aligner.py
        static_checker.py
        judge.py
        reporter.py
        followup.py
      tests/
      pyproject.toml
```

## 9. Environment Variables

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

## 10. API Design

### 10.1 AgentMail webhook

```http
POST /webhooks/agentmail
```

Responsibilities:

1. Verify webhook signature if available.
2. Fetch full message if webhook body is truncated.
3. Ignore messages already labeled `processed`.
4. Create or update audit job.
5. Start audit pipeline.
6. Mark message as `processed`.

### 10.2 Create audit manually

```http
POST /audits
```

Request:

```json
{
  "paper_url": "https://arxiv.org/pdf/2401.xxxxx",
  "repo_url": "https://github.com/example/paper-code",
  "question": "Check accuracy and training setup."
}
```

### 10.3 Get audit status

```http
GET /audits/{audit_id}
```

Response:

```json
{
  "audit_id": "aud_123",
  "status": "running",
  "stage": "aligning_claims",
  "progress": 0.64
}
```

### 10.4 Stream audit events

```http
GET /audits/{audit_id}/events
```

Use Server Sent Events.

### 10.5 Explain claim

```http
POST /audits/{audit_id}/claims/{claim_id}/explain
```

Request:

```json
{
  "question": "Why did you flag this claim?"
}
```

## 11. Data Models

### 11.1 AuditRequest

```json
{
  "audit_id": "string",
  "thread_id": "string",
  "message_id": "string",
  "sender": "string",
  "paper_url": "string",
  "repo_url": "string",
  "question": "string",
  "created_at": "datetime"
}
```

### 11.2 PaperClaim

```json
{
  "claim_id": "string",
  "claim_text": "string",
  "claim_type": "result | training_setup | dataset | metric | baseline | ablation | model_architecture",
  "dataset": "string | null",
  "metric": "string | null",
  "expected_value": "number | string | null",
  "unit": "string | null",
  "paper_location": "string",
  "confidence": "number"
}
```

### 11.3 EvidenceCandidate

```json
{
  "claim_id": "string",
  "source_type": "paper | repo | cited_paper | readme | config",
  "path": "string",
  "line_start": "integer | null",
  "line_end": "integer | null",
  "snippet": "string",
  "retrieval_method": "nia_search | fallback_search",
  "alignment_confidence": "number"
}
```

### 11.4 ClaimVerdict

```json
{
  "claim_id": "string",
  "verdict": "verified | flagged | needs_review | unsupported",
  "severity": "low | medium | high",
  "reason": "string",
  "paper_claim": "string",
  "evidence": ["EvidenceCandidate"],
  "suggested_next_step": "string"
}
```

### 11.5 AuditReport

```json
{
  "audit_id": "string",
  "score": "integer",
  "summary": "string",
  "verified_count": "integer",
  "flagged_count": "integer",
  "needs_review_count": "integer",
  "unsupported_count": "integer",
  "top_findings": ["ClaimVerdict"],
  "limitations": ["string"]
}
```

## 12. Claim Extraction Strategy

Use a structured model call over paper sections.

Input sections:

1. Abstract
2. Introduction
3. Method
4. Experiments
5. Results
6. Tables
7. Appendix if available

Extraction prompt should ask for only auditable claims.

Good claims:

```text
We achieve 91.2 percent accuracy on CIFAR 10.
We train for 100 epochs.
We report mean and standard deviation over 5 seeds.
We use AdamW with learning rate 3e-4.
We compare against baseline X from Smith et al.
```

Bad claims:

```text
Our method is effective.
The model learns robust representations.
Results are promising.
```

## 13. Claim to Code Alignment Strategy

For each claim:

1. Normalize entities:
   * dataset
   * metric
   * model
   * number
   * hyperparameters

2. Generate search queries:

```text
CIFAR 10 accuracy evaluation top1
epochs 100 training config
AdamW learning rate 3e-4
seed mean std experiment script
```

3. Query Nia across repo and paper context.

4. Retrieve top 8 snippets.

5. Rerank snippets using a structured judge.

6. Assign alignment confidence.

7. Pass top evidence to static checker.

## 14. Static Discrepancy Checks

Implement simple deterministic checks first.

### 14.1 Hyperparameter mismatch

Compare paper values against config values:

```text
epochs
batch_size
learning_rate
weight_decay
optimizer
scheduler
seed_count
dataset_name
metric_name
```

### 14.2 Metric mismatch

Flag if paper reports a metric but code computes another:

```text
Paper: accuracy
Code: macro_f1
Verdict: flagged
```

### 14.3 Dataset mismatch

Flag if dataset names or split names differ:

```text
Paper: CIFAR 10 test set
Code: CIFAR 100 loader
Verdict: high severity
```

### 14.4 Unsupported claim

Flag if no code evidence is found:

```text
Paper: average over 5 seeds
Code: no aggregation script found
Verdict: needs review
```

## 15. Reproducibility Scoring

Start with a transparent heuristic:

```text
score = 100
score -= 18 * high_severity_flags
score -= 10 * medium_severity_flags
score -= 5 * low_severity_flags
score -= 4 * unsupported_claims
score += 2 * verified_claims
score = clamp(score, 0, 100)
```

Verdict bands:

```text
85 to 100: Strongly reproducible first pass
70 to 84: Mostly reproducible with concerns
50 to 69: Significant reproducibility concerns
0 to 49: Not reproducible from available evidence
```

## 16. Dashboard Requirements

### 16.1 Home page

Show:

1. Inbox address
2. Recent audit jobs
3. Status
4. Score
5. Number of flagged claims

### 16.2 Audit detail page

Show:

1. Timeline
2. Paper metadata
3. Repo metadata
4. Claim table
5. Evidence snippets
6. Final email preview
7. Button to resend report
8. Button to generate explanation

### 16.3 Visual priorities

Use a clean research audit aesthetic:

1. Score card
2. Claim verdict badges
3. Code evidence cards
4. Timeline with agent steps
5. Compact but readable email preview

## 17. Report Format

### Email subject

```text
ReproClaw Audit: {paper_title}
```

### Email body

```text
Hi,

I completed a first pass reproducibility audit for:

Paper: {paper}
Repo: {repo}

Reproducibility Score: {score} / 100

Summary:
{summary}

Top Findings:

1. {verdict} Claim: {claim}
   Evidence: {path}
   Reason: {reason}

2. {verdict} Claim: {claim}
   Evidence: {path}
   Reason: {reason}

Limitations:
This is an automated first pass audit. It does not guarantee full reproduction unless dynamic execution is enabled.

Reply with "explain claim 3" and I will show the evidence path.
```

## 18. Follow Up Handling

Supported follow up patterns:

1. `explain claim 3`
2. `show evidence for claim 3`
3. `summarize only the flagged claims`
4. `what should the author fix first`
5. `generate reviewer comment`

The follow up agent should:

1. Retrieve the audit report by thread ID.
2. Identify referenced claim.
3. Use Nia to reload evidence if needed.
4. Reply in the same thread.

## 19. Safety and Reliability

### 19.1 Execution safety

Do not execute arbitrary repo code by default.

If dynamic execution is enabled:

1. Use Docker or external sandbox.
2. Disable network by default.
3. Limit CPU, memory, and runtime.
4. Run only curated fallback repos during demo.
5. Never load untrusted secrets into the sandbox.

### 19.2 Email safety

1. Verify webhook signatures if supported.
2. Deduplicate by message ID.
3. Mark processed messages.
4. Ignore auto replies.
5. Limit attachment size.
6. Sanitize HTML.
7. Do not expose API keys in replies.

### 19.3 Claim safety

1. Report uncertainty honestly.
2. Distinguish static mismatch from failed reproduction.
3. Never claim a paper is fraudulent.
4. Say “flagged for review” instead of “wrong” unless directly contradicted.
5. Include limitations in every report.

## 20. Testing Plan

### Unit tests

1. Email parser extracts paper and repo links.
2. Claim extractor returns valid schema.
3. Static checker catches epoch mismatch.
4. Scoring function is deterministic.
5. Follow up parser resolves claim references.

### Integration tests

1. Simulated AgentMail webhook creates an audit.
2. Audit pipeline returns a report.
3. Report email renderer produces plain text and HTML.
4. Follow up question generates correct explanation.

### Demo tests

1. Run audit on fallback paper A.
2. Run audit on fallback paper B.
3. Send a live email to AgentMail inbox.
4. Trigger one follow up reply.
5. Confirm dashboard updates.

## 21. Hackathon Build Plan

### Hour 0 to 1

1. Create repo structure.
2. Set up Next.js frontend.
3. Set up FastAPI backend.
4. Create `.env`.
5. Create AgentMail inbox.
6. Verify one send and one receive.

### Hour 1 to 2

1. Build AgentMail webhook route.
2. Build request parser.
3. Store audit job in SQLite.
4. Show job in dashboard.

### Hour 2 to 3

1. Add paper fetcher.
2. Add PDF text extraction.
3. Add structured claim extraction.
4. Display extracted claims.

### Hour 3 to 4

1. Add Nia setup.
2. Index or query repo.
3. Search candidate code files per claim.
4. Display candidate evidence.

### Hour 4 to 5

1. Add static checker.
2. Add reproducibility score.
3. Generate final audit report.

### Hour 5 to 6

1. Send report through AgentMail.
2. Add follow up handling.
3. Add explanation for flagged claim.

### Hour 6 to submission

1. Polish dashboard.
2. Prepare fallback papers.
3. Record backup demo.
4. Practice 3 minute pitch.
5. Freeze code.

## 22. Fallback Demo Strategy

Prepare two fallback cases.

### Fallback Case A

Claim:

```text
Paper says 100 epochs.
Config says 50 epochs.
```

Expected result:

```text
Flag training schedule mismatch.
```

### Fallback Case B

Claim:

```text
Paper says averaged over 5 seeds.
Repo has no seed aggregation script.
```

Expected result:

```text
Flag missing multi seed evidence.
```

If live arXiv or GitHub fetch fails, load cached paper and repo from `demo_data/`.

## 23. Pitch Script

```text
ReproClaw is an email native reproducibility reviewer for AI papers.

You email it an arXiv paper and GitHub repo. AgentMail gives the agent its inbox, threading, and follow up conversation. Nia gives it the context brain to read the paper, understand the repo, and connect scientific claims to code evidence.

In our demo, ReproClaw extracts numerical and training claims from a paper, aligns each claim to likely code files, checks for config and metric mismatches, and replies with a reproducibility score.

If the reviewer replies, “Why did you flag this claim?” the agent answers in the same thread with the exact evidence.

The bigger idea is simple: every AI paper should come with a machine generated reproducibility audit before publication.
```

## 24. Winning Differentiator

Most teams will build agents that answer questions.

ReproClaw audits whether AI research claims are supported by implementation evidence.

That makes it feel like a new primitive:

```text
Scientific claim → code evidence → reproducibility verdict
```

## 25. Acceptance Criteria

The MVP is successful if all are true:

1. A user can email an audit request to an AgentMail inbox.
2. The backend receives the request.
3. The system extracts at least 5 paper claims.
4. The system uses Nia to retrieve repo or paper evidence.
5. The system flags at least one meaningful mismatch.
6. The dashboard shows the audit process.
7. The system sends a final report through AgentMail.
8. A user can reply with a follow up question.
9. The agent replies with an explanation in the same thread.
10. The demo can complete in under 3 minutes.

## 26. Source Notes

Verified technology choices on April 25, 2026.

1. Next.js latest App Router template with TypeScript, Tailwind, ESLint, and Turbopack defaults.
2. React latest docs list React 19.2.
3. Node.js release page lists Node 24.14.1 as latest LTS and Node 25.9.0 as current.
4. Python downloads list Python 3.14.4 as the latest Python 3 release.
5. FastAPI GitHub releases list 0.136.0 as latest on April 16, 2026.
6. AgentMail docs describe inboxes, sending, receiving, threading, attachments, labels, webhooks, SDKs, semantic search, and structured extraction.
7. Nia docs describe indexing, search, reading, research, handoffs, and context across repos, docs, PDFs, datasets, Slack, Google Drive, and local sources.
8. OpenAI docs describe the Responses API, Structured Outputs, function calling, and current GPT 5 family models.
