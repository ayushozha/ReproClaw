# Claude Today Plan

Date: April 25, 2026

## Goal

Own the user-facing ReproClaw experience for today's hackathon MVP:

1. Make the dashboard understandable in under 3 minutes.
2. Make the audit email feel credible and grounded.
3. Make claim explanations easy to defend in a live thread.
4. Keep the work dependency-light so the backend can ship.

## Dependency Rule

Do not add frontend or design dependencies today.

Use:

1. plain HTML
2. plain CSS
3. plain JavaScript
4. browser-native `fetch`
5. browser-native `EventSource`

Avoid today:

1. Next.js
2. React
3. Tailwind
4. shadcn/ui
5. charting libraries
6. component libraries
7. markdown renderers
8. animation libraries

The dashboard should be good enough for a demo, not a production app.

## Claude-Owned Features

### 1. Dashboard Content Model

Design the dashboard around the demo story:

```text
Email received
Paper parsed
Claims extracted
Repository searched
Evidence aligned
Claims checked
Audit report sent
Follow-up answered
```

The first screen should show:

1. inbox address
2. current audit status
3. reproducibility score
4. number of verified, flagged, and needs-review claims
5. top flagged claim
6. final email preview

### 2. Static Dashboard UI

Implement inside Codex's static FastAPI assets:

```text
apps/api/app/static/
  index.html
  app.js
  styles.css
```

Views:

1. audit list
2. audit detail
3. live timeline
4. claim table
5. evidence panel
6. email preview

Use compact research-audit styling:

1. white or near-white background
2. dark readable text
3. restrained borders
4. status badges
5. code evidence blocks
6. no decorative graphics

### 3. Claim Table Copy

Columns:

1. claim ID
2. paper claim
3. verdict
4. severity
5. evidence path
6. reason

Verdict labels:

1. `verified`
2. `flagged`
3. `needs_review`
4. `unsupported`

Use "flagged for review" language. Do not say the paper is wrong unless evidence directly contradicts it.

### 4. Email Report Template

Write the plain text report template first:

```text
Hi,

I completed a first-pass reproducibility audit for:

Paper: {paper}
Repo: {repo}

Reproducibility Score: {score} / 100

Summary:
{summary}

Top Findings:

1. {verdict} Claim: {claim}
   Evidence: {path}
   Reason: {reason}

Limitations:
This is an automated first-pass audit. It checks static evidence and does not prove full reproduction.

Reply with "explain claim 3" and I will show the evidence path.
```

Keep the email concise enough to read during the demo.

### 5. Follow-Up Explanation Template

Support:

```text
explain claim {n}
show evidence for claim {n}
why did you flag claim {n}
```

Template:

```text
I flagged claim {n} for review because:

Paper claim:
{claim}

Evidence found:
{path}
{snippet}

Reason:
{reason}

This is a static audit finding, so the next step is to confirm whether the paper or README documents an override.
```

### 6. Demo Fixtures And Narrative

Create clear fixture copy for two fallback cases.

Case A:

1. paper claim: "We train for 100 epochs."
2. repo evidence: `configs/cifar10.yaml` sets `epochs: 50`
3. verdict: `flagged`
4. explanation: default training config does not match the paper claim

Case B:

1. paper claim: "We report the mean over 5 seeds."
2. repo evidence: README documents one command and no aggregation script
3. verdict: `needs_review`
4. explanation: multi-seed aggregation is not documented

### 7. LLM Prompt Text

Prepare prompt text for later model calls, but do not block today's demo on it.

Prompt responsibilities:

1. extract only auditable claims
2. ignore vague claims
3. align claims to evidence snippets
4. write neutral verdict reasons
5. generate concise follow-up answers

All prompts must require JSON-compatible outputs so Codex can wire them into the backend later.

### 8. Demo Script

Write a short demo script:

1. send or simulate an email with paper and repo
2. show the dashboard timeline
3. open the flagged claim
4. show evidence path and snippet
5. show the sent email report
6. ask "Why did you flag claim 3?"
7. show the threaded explanation

The script should fit in 3 minutes.

## Acceptance Criteria

Claude is done today when:

1. The dashboard can explain the product without extra narration.
2. The report template includes score, summary, top findings, evidence, and limitations.
3. Follow-up explanation text is clear and grounded in stored evidence.
4. The fallback demo cases have concise, believable paper and repo text.
5. No frontend framework or component dependency has been added.

## Not Today

1. Marketing landing page.
2. Full design system.
3. Charts.
4. PDF rendering UI.
5. Multi-user settings.
6. Account management.
7. Complex animations.
