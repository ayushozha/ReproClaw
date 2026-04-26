from __future__ import annotations

import re


CLAIM_REF_RE = re.compile(r"claim\s+(\d+|claim_\d+)", re.I)


def claim_id_from_question(question: str) -> str | None:
    match = CLAIM_REF_RE.search(question)
    if not match:
        return None
    raw = match.group(1).lower()
    return raw if raw.startswith("claim_") else f"claim_{raw}"


def render_explanation(claim: dict) -> str:
    evidence = claim.get("evidence") or []
    first = evidence[0] if evidence else {}
    snippet = first.get("snippet") or "No snippet was stored for this claim."
    path = first.get("path") or "No evidence path was stored."
    claim_id = claim.get("claim_id", "claim")
    claim_label = _humanize_claim_id(claim_id)

    return "\n".join(
        [
            f"I flagged {claim_label} for review because:",
            "",
            "Paper claim:",
            claim.get("claim_text", ""),
            "",
            "Evidence found:",
            path,
            snippet,
            "",
            "Reason:",
            claim.get("reason", ""),
            "",
            "This is a static audit finding, so the next step is to confirm whether the paper or README documents an override.",
        ]
    )


def _humanize_claim_id(claim_id: str) -> str:
    if claim_id.startswith("claim_"):
        return f"claim {claim_id.split('_', 1)[1]}"
    return claim_id

