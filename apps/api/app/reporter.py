from __future__ import annotations

from .scoring import score_band


def render_report(audit: dict, verdicts: list[dict], score: int) -> str:
    counts = _counts(verdicts)
    top_findings = [
        verdict for verdict in verdicts if verdict["verdict"] in {"flagged", "needs_review", "unsupported"}
    ][:5]

    lines = [
        "Hi,",
        "",
        "I completed a first-pass reproducibility audit for:",
        "",
        f"Paper: {audit.get('paper_url') or 'not provided'}",
        f"Repo: {audit.get('repo_url') or 'not provided'}",
        "",
        f"Reproducibility Score: {score} / 100  ({score_band(score)})",
        "",
        "Summary:",
        (
            f"{counts['verified']} verified, {counts['flagged']} flagged for review, "
            f"{counts['needs_review']} need review, {counts['unsupported']} unsupported."
        ),
        "",
        "Top Findings:",
        "",
    ]

    if not top_findings:
        lines.append("No flagged findings in the static first pass.")
    else:
        for index, verdict in enumerate(top_findings, start=1):
            evidence = verdict.get("evidence") or []
            path = evidence[0].get("path", "no evidence path") if evidence else "no evidence path"
            lines.extend(
                [
                    f"{index}. {verdict['verdict']} Claim: {verdict['paper_claim']}",
                    f"   Evidence: {path}",
                    f"   Reason: {verdict['reason']}",
                    "",
                ]
            )

    lines.extend(
        [
            "Limitations:",
            "This is an automated first-pass audit. It checks static evidence and does not prove full reproduction.",
            "",
            'Reply with "explain claim 3" and I will show the evidence path.',
        ]
    )
    return "\n".join(lines)


def _counts(verdicts: list[dict]) -> dict[str, int]:
    counts = {"verified": 0, "flagged": 0, "needs_review": 0, "unsupported": 0}
    for verdict in verdicts:
        kind = verdict.get("verdict")
        if kind in counts:
            counts[kind] += 1
    return counts

