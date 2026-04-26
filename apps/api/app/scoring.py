from __future__ import annotations


def score_verdicts(verdicts: list[dict]) -> int:
    score = 100
    for verdict in verdicts:
        kind = verdict.get("verdict")
        severity = verdict.get("severity")
        if kind == "verified":
            score += 2
        elif kind == "unsupported":
            score -= 4
        elif kind == "flagged":
            if severity == "high":
                score -= 18
            elif severity == "medium":
                score -= 10
            else:
                score -= 5
    return max(0, min(100, score))


def score_band(score: int) -> str:
    if score >= 85:
        return "Strongly reproducible first pass"
    if score >= 70:
        return "Mostly reproducible with concerns"
    if score >= 50:
        return "Significant reproducibility concerns"
    return "Not reproducible from available evidence"

