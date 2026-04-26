# ReproClaw — 3-Minute Demo Script

Date: April 25, 2026
Audience: OpenClaw judges (Eragon × Nozomio × AgentMail)

## Setup before going on stage

1. Backend running: `uv run uvicorn app.main:app --reload --port 8000`
2. Browser tab 1: `http://localhost:8000/dashboard`
3. Browser tab 2: AgentMail inbox for `reproclaw@agentmail.to`
4. Demo audit pre-warmed with `demo:case_a` so the dashboard already shows
   a verified+flagged audit when you open it. (Click "Run Demo Audit" once
   in the green room, then leave it.)
5. Email draft ready in another window with the subject and body from
   step 1 below — do not hit send until you are on stage.

---

## The 3-minute flow

### 0:00 — Hook (10s)

> "Every week, hundreds of ML papers claim a new state of the art.
> Almost none of them are independently checked before someone cites them.
> ReproClaw fixes that — by email."

### 0:10 — Send the email (20s)

Show tab 2 (Gmail compose), then send:

```text
To:      reproclaw@agentmail.to
Subject: Audit this ML paper

Paper: arXiv:2401.xxxxx
Repo:  https://github.com/example/paper-code

Please check whether the reported accuracy and training setup
match the code.
```

Say:

> "I just emailed ReproClaw a paper and a repo. AgentMail receives it,
> our agent picks it up through a webhook, and the audit pipeline starts."

### 0:30 — Show the dashboard timeline (30s)

Switch to tab 1. Point at the **timeline** column on the right of the audit
detail.

> "This is what the agent is doing right now.
> Email received. Paper parsed. Twelve claims extracted.
> Repository indexed with Nia. Each claim aligned to candidate code files."

Point at the **stats strip** above the timeline (Verified / Flagged /
Needs Review / Unsupported counts).

> "Five verified, two flagged, one needs review. Score: 72 out of 100."

### 1:00 — Open the flagged claim (40s)

In the **Claims** table, click the row whose verdict badge says `flagged`
("Trained for 100 epochs"). The **Evidence panel** opens below.

Point at the panel:

> "Here is the paper claim, the file path, the actual code snippet, and
> the agent's reason — all in one place."

Read the snippet aloud:

```yaml
training:
  epochs: 50
```

> "The paper says 100 epochs. The default config in the repo says 50. That
> is a static mismatch that no human reviewer would catch in three minutes
> of skimming."

### 1:40 — Show the email report (30s)

Scroll up to the **Email preview**. Read the top:

> "Reproducibility Score: 72 out of 100. Two claims flagged for review."

Switch to tab 2 (AgentMail inbox) and open the actual sent email.

> "This is the message ReproClaw sent back through AgentMail. Threaded.
> Cited. Reviewer-ready."

### 2:10 — Send the follow-up (40s)

In tab 2, hit reply on ReproClaw's message:

```text
Why did you flag claim 3?
```

Send it. Switch to tab 1, watch the timeline pick up the follow-up.

Switch back to tab 2 — show ReproClaw's threaded reply:

```text
I flagged claim 3 because the paper states 100 training epochs, but the
repo default config sets epochs to 50. I also did not find a README
command that overrides this value to 100.
```

> "It defends the verdict in the same thread, with the same evidence.
> No new tab, no API call from the reviewer."

### 2:50 — Close (10s)

> "ReproClaw introduces a new primitive for AI research:
> scientific claim → code evidence → reproducibility verdict.
> AgentMail makes it accessible from any inbox.
> Nia makes the alignment work.
> Every paper should ship with one of these audits before publication."

---

## If the live email path fails

Fall back to:

1. Click **Run Demo Audit** in the dashboard. This uses `demo:case_a` directly.
2. Walk through the same dashboard steps (timeline, claim, evidence panel,
   email preview).
3. Click **Explain** on the flagged row to surface the threaded explanation
   inside the evidence panel — this is the same text ReproClaw would email.
4. Optionally run a second audit against `demo:case_b` to show the
   "needs review — no multi-seed aggregation" finding.

## Cues to remember

- Always say **"flagged for review"**, never "the paper is wrong".
- Always point to the **file path and line snippet** when explaining a flag.
- The agent has an **email address**, not just a UI. Repeat that once.
- The score is **transparent and deterministic** — show the formula on a
  follow-up if a judge asks how it was computed.
