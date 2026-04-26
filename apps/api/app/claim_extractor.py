from __future__ import annotations

import re

from .models import PaperClaim


def extract_claims(paper_text: str) -> list[PaperClaim]:
    claims: list[PaperClaim] = []

    for match in re.finditer(r"(?:train|trained|training)[^.]{0,80}?(\d+)\s+epochs?", paper_text, re.I):
        claims.append(
            PaperClaim(
                claim_id=_next_id(claims),
                claim_text=_sentence_around(paper_text, match.start()),
                claim_type="training_setup",
                expected_key="epochs",
                expected_value=match.group(1),
                paper_location="paper_text",
            )
        )

    for match in re.finditer(r"(?:mean|average|averaged|std|standard deviation)[^.]{0,80}?(\d+)\s+seeds?", paper_text, re.I):
        claims.append(
            PaperClaim(
                claim_id=_next_id(claims),
                claim_text=_sentence_around(paper_text, match.start()),
                claim_type="training_setup",
                expected_key="seed_count",
                expected_value=match.group(1),
                paper_location="paper_text",
            )
        )

    for match in re.finditer(r"(?:learning rate|lr)[^\d]{0,20}([0-9]+(?:\.[0-9]+)?e-?[0-9]+|0\.\d+)", paper_text, re.I):
        claims.append(
            PaperClaim(
                claim_id=_next_id(claims),
                claim_text=_sentence_around(paper_text, match.start()),
                claim_type="training_setup",
                expected_key="learning_rate",
                expected_value=match.group(1),
                paper_location="paper_text",
            )
        )

    for match in re.finditer(r"(?:batch size)[^\d]{0,20}(\d+)", paper_text, re.I):
        claims.append(
            PaperClaim(
                claim_id=_next_id(claims),
                claim_text=_sentence_around(paper_text, match.start()),
                claim_type="training_setup",
                expected_key="batch_size",
                expected_value=match.group(1),
                paper_location="paper_text",
            )
        )

    for match in re.finditer(r"(AdamW|Adam|SGD|RMSProp)", paper_text):
        claims.append(
            PaperClaim(
                claim_id=_next_id(claims),
                claim_text=_sentence_around(paper_text, match.start()),
                claim_type="training_setup",
                expected_key="optimizer",
                expected_value=match.group(1),
                paper_location="paper_text",
            )
        )

    for match in re.finditer(r"(CIFAR[- ]?10|CIFAR[- ]?100|ImageNet|MNIST|SST-2|MMLU)", paper_text, re.I):
        claims.append(
            PaperClaim(
                claim_id=_next_id(claims),
                claim_text=_sentence_around(paper_text, match.start()),
                claim_type="dataset",
                expected_key="dataset",
                expected_value=match.group(1),
                dataset=match.group(1),
                paper_location="paper_text",
            )
        )

    for match in re.finditer(r"(\d+(?:\.\d+)?)\s*(?:%|percent)\s+(accuracy|F1|AUROC|BLEU)", paper_text, re.I):
        claims.append(
            PaperClaim(
                claim_id=_next_id(claims),
                claim_text=_sentence_around(paper_text, match.start()),
                claim_type="result",
                expected_key=match.group(2).lower(),
                expected_value=match.group(1),
                metric=match.group(2),
                paper_location="paper_text",
            )
        )

    return _dedupe_claims(claims)[:12]


def _next_id(claims: list[PaperClaim]) -> str:
    return f"claim_{len(claims) + 1}"


def _sentence_around(text: str, index: int) -> str:
    start = max(text.rfind(".", 0, index), text.rfind("\n", 0, index))
    end_dot = text.find(".", index)
    end_newline = text.find("\n", index)
    candidates = [pos for pos in [end_dot, end_newline] if pos != -1]
    end = min(candidates) if candidates else min(len(text), index + 180)
    return text[start + 1 : end + 1].strip()


def _dedupe_claims(claims: list[PaperClaim]) -> list[PaperClaim]:
    seen: set[tuple[str, str]] = set()
    unique: list[PaperClaim] = []
    for claim in claims:
        key = (claim.expected_key, claim.expected_value)
        if key in seen:
            continue
        seen.add(key)
        claim.claim_id = f"claim_{len(unique) + 1}"
        unique.append(claim)
    return unique

