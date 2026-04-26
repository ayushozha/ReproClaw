from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal


ClaimType = Literal[
    "result",
    "training_setup",
    "dataset",
    "metric",
    "baseline",
    "ablation",
    "model_architecture",
]

Verdict = Literal["verified", "flagged", "needs_review", "unsupported"]
Severity = Literal["low", "medium", "high"]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class AuditRequest:
    paper_url: str = ""
    repo_url: str = ""
    question: str = ""
    sender: str = ""
    thread_id: str = ""
    message_id: str = ""
    subject: str = ""
    body: str = ""


@dataclass
class PaperClaim:
    claim_id: str
    claim_text: str
    claim_type: ClaimType
    expected_key: str = ""
    expected_value: str = ""
    dataset: str = ""
    metric: str = ""
    paper_location: str = ""
    confidence: float = 0.75

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class EvidenceCandidate:
    claim_id: str
    source_type: str
    path: str
    snippet: str
    line_start: int | None = None
    line_end: int | None = None
    retrieval_method: str = "fallback_search"
    alignment_confidence: float = 0.5

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ClaimVerdict:
    claim_id: str
    verdict: Verdict
    severity: Severity
    reason: str
    paper_claim: str
    evidence: list[EvidenceCandidate] = field(default_factory=list)
    suggested_next_step: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
