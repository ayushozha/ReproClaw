from __future__ import annotations

import re

from .models import AuditRequest


ARXIV_RE = re.compile(r"(?:arxiv:|arxiv\.org/(?:abs|pdf)/)(\d{4}\.\d{4,5})(?:v\d+)?", re.I)
PDF_RE = re.compile(r"https?://[^\s)]+\.pdf(?:\?[^\s)]*)?", re.I)
GITHUB_RE = re.compile(r"https?://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", re.I)


def parse_audit_request(payload: dict) -> AuditRequest:
    subject = str(payload.get("subject") or "")
    body = _body_from_payload(payload)
    text = "\n".join(part for part in [subject, body] if part)

    paper_url = str(payload.get("paper_url") or "")
    repo_url = str(payload.get("repo_url") or "")

    if not paper_url:
        pdf = PDF_RE.search(text)
        if pdf:
            paper_url = pdf.group(0)
        else:
            arxiv = ARXIV_RE.search(text)
            if arxiv:
                paper_url = f"https://arxiv.org/pdf/{arxiv.group(1)}"

    if not repo_url:
        repo = GITHUB_RE.search(text)
        if repo:
            repo_url = repo.group(0).rstrip(".,")

    return AuditRequest(
        paper_url=paper_url,
        repo_url=repo_url,
        question=str(payload.get("question") or _extract_question(body)),
        sender=str(payload.get("sender") or payload.get("from") or ""),
        thread_id=str(payload.get("thread_id") or payload.get("threadId") or ""),
        message_id=str(payload.get("message_id") or payload.get("messageId") or ""),
        subject=subject,
        body=body,
    )


def _body_from_payload(payload: dict) -> str:
    for key in ("body", "text", "text_body", "textBody", "plain_text", "plainText"):
        value = payload.get(key)
        if value:
            return str(value)
    message = payload.get("message")
    if isinstance(message, dict):
        return _body_from_payload(message)
    return ""


def _extract_question(body: str) -> str:
    lines = []
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.lower().startswith(("paper:", "repo:", "github:", "arxiv:")):
            continue
        lines.append(stripped)
    return " ".join(lines)

