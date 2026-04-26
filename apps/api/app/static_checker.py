from __future__ import annotations

import re

from .models import ClaimVerdict, EvidenceCandidate, PaperClaim


def check_claim(claim: PaperClaim, evidence: list[EvidenceCandidate]) -> ClaimVerdict:
    if not evidence:
        return ClaimVerdict(
            claim_id=claim.claim_id,
            verdict="unsupported",
            severity="medium",
            paper_claim=claim.claim_text,
            reason="No matching implementation evidence was found in the available repository files.",
            suggested_next_step="Ask the author for the training command, config, or evaluation script.",
        )

    key = claim.expected_key.lower()
    if key in {"epochs", "batch_size", "learning_rate"}:
        return _compare_scalar(claim, evidence, key)
    if key == "seed_count":
        return _check_seed_count(claim, evidence)
    if key in {"optimizer", "dataset"}:
        return _check_text_value(claim, evidence)
    if key in {"accuracy", "f1", "auroc", "bleu"}:
        return _check_metric_value(claim, evidence, key)

    return ClaimVerdict(
        claim_id=claim.claim_id,
        verdict="needs_review",
        severity="low",
        paper_claim=claim.claim_text,
        evidence=evidence[:2],
        reason="Evidence was found, but this scaffold does not yet implement a deterministic checker for this claim type.",
        suggested_next_step="Review the evidence snippet manually.",
    )


def _compare_scalar(claim: PaperClaim, evidence: list[EvidenceCandidate], key: str) -> ClaimVerdict:
    expected = str(claim.expected_value).lower()
    snippet = "\n".join(item.snippet for item in evidence)
    aliases = _key_aliases(key)
    alias_pattern = "|".join(aliases)
    found = re.search(alias_pattern, snippet, re.I)
    number = re.search(
        rf"(?:{alias_pattern})\s*[:=]\s*([0-9]+(?:\.[0-9]+)?(?:e-?[0-9]+)?)",
        snippet,
        re.I,
    )
    actual = number.group(1).lower() if number else ""

    if actual and _normalize_number(actual) != _normalize_number(expected):
        return ClaimVerdict(
            claim_id=claim.claim_id,
            verdict="flagged",
            severity="high" if key in {"epochs", "learning_rate"} else "medium",
            paper_claim=claim.claim_text,
            evidence=evidence[:2],
            reason=f"Paper states {key}={expected}, but the repository evidence shows {key}={actual}.",
            suggested_next_step="Confirm whether another config or command-line override matches the paper.",
        )

    if found:
        return ClaimVerdict(
            claim_id=claim.claim_id,
            verdict="verified",
            severity="low",
            paper_claim=claim.claim_text,
            evidence=evidence[:2],
            reason=f"Repository evidence appears to support {key}={expected}.",
        )

    return _needs_review(claim, evidence)


def _check_seed_count(claim: PaperClaim, evidence: list[EvidenceCandidate]) -> ClaimVerdict:
    expected = str(claim.expected_value)
    snippet = "\n".join(item.snippet for item in evidence)
    if re.search(rf"(range\(\s*{re.escape(expected)}\s*\)|{re.escape(expected)}\s+seeds?)", snippet, re.I):
        return ClaimVerdict(
            claim_id=claim.claim_id,
            verdict="verified",
            severity="low",
            paper_claim=claim.claim_text,
            evidence=evidence[:2],
            reason=f"Repository evidence appears to document aggregation over {expected} seeds.",
        )
    return ClaimVerdict(
        claim_id=claim.claim_id,
        verdict="needs_review",
        severity="medium",
        paper_claim=claim.claim_text,
        evidence=evidence[:2],
        reason=f"Paper states results are averaged over {expected} seeds, but the found evidence does not document that aggregation.",
        suggested_next_step="Look for a sweep script, results table generator, or README command that runs all seeds.",
    )


def _check_text_value(claim: PaperClaim, evidence: list[EvidenceCandidate]) -> ClaimVerdict:
    expected = str(claim.expected_value)
    snippet = "\n".join(item.snippet for item in evidence)
    if expected and re.search(re.escape(expected), snippet, re.I):
        return ClaimVerdict(
            claim_id=claim.claim_id,
            verdict="verified",
            severity="low",
            paper_claim=claim.claim_text,
            evidence=evidence[:2],
            reason=f"Repository evidence mentions {expected}.",
        )
    return _needs_review(claim, evidence)


def _check_metric_value(claim: PaperClaim, evidence: list[EvidenceCandidate], key: str) -> ClaimVerdict:
    metric_name = (claim.metric or key).lower()
    snippet = "\n".join(item.snippet for item in evidence)
    metric_present = re.search(re.escape(metric_name), snippet, re.I)
    number = re.search(rf"{re.escape(metric_name)}[^0-9]{{0,12}}([0-9]+(?:\.[0-9]+)?)", snippet, re.I)

    if number:
        actual = number.group(1)
        if _normalize_number(actual) != _normalize_number(str(claim.expected_value)):
            return ClaimVerdict(
                claim_id=claim.claim_id,
                verdict="flagged",
                severity="medium",
                paper_claim=claim.claim_text,
                evidence=evidence[:2],
                reason=(
                    f"Paper reports {metric_name}={claim.expected_value}, "
                    f"but the repository evidence shows {metric_name}={actual}."
                ),
                suggested_next_step="Confirm whether a different config or evaluation script reproduces the paper number.",
            )
        return ClaimVerdict(
            claim_id=claim.claim_id,
            verdict="verified",
            severity="low",
            paper_claim=claim.claim_text,
            evidence=evidence[:2],
            reason=f"Repository evidence reports {metric_name}={actual}, matching the paper value.",
        )

    if metric_present:
        return ClaimVerdict(
            claim_id=claim.claim_id,
            verdict="needs_review",
            severity="low",
            paper_claim=claim.claim_text,
            evidence=evidence[:2],
            reason=(
                f"The metric '{metric_name}' appears in the repository, but no comparable numeric "
                "result was found in the static evidence."
            ),
            suggested_next_step="Run the evaluation script and compare the reported number to the paper.",
        )

    return ClaimVerdict(
        claim_id=claim.claim_id,
        verdict="needs_review",
        severity="medium",
        paper_claim=claim.claim_text,
        evidence=evidence[:2],
        reason=(
            f"Paper reports {metric_name}={claim.expected_value}, but no matching metric "
            "or evaluation script was located in the repository evidence."
        ),
        suggested_next_step="Look for an evaluation or reporting script that emits this metric.",
    )


def _needs_review(claim: PaperClaim, evidence: list[EvidenceCandidate]) -> ClaimVerdict:
    return ClaimVerdict(
        claim_id=claim.claim_id,
        verdict="needs_review",
        severity="low",
        paper_claim=claim.claim_text,
        evidence=evidence[:2],
        reason="Related evidence was found, but it does not conclusively verify or contradict the paper claim.",
        suggested_next_step="Review the linked files manually.",
    )


def _key_aliases(key: str) -> list[str]:
    if key == "learning_rate":
        return ["learning_rate", "lr"]
    if key == "epochs":
        return ["epochs", "epoch"]
    if key == "batch_size":
        return ["batch_size", "batch"]
    return [key]


def _normalize_number(value: str) -> str:
    try:
        return str(float(value))
    except ValueError:
        return value.strip().lower()

