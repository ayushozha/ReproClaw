from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path
import shutil
import subprocess

from .agentmail_client import AgentMailClient
from .claim_extractor import extract_claims
from .config import PROJECT_ROOT, get_settings
from .models import PaperClaim
from .nia_client import ContextSearchClient, evidence_to_dict
from .reporter import render_report
from .scoring import score_verdicts
from .static_checker import check_claim
from .storage import Storage


DEMO_ROOT = PROJECT_ROOT / "demo_data"


async def run_audit(audit_id: str, store: Storage) -> None:
    audit = store.get_audit(audit_id)
    if not audit:
        return

    try:
        store.set_status(audit_id, "running", "parsing_paper")
        store.add_event(audit_id, "parsing_paper", "Parsing paper text.")

        paper_text = _load_paper_text(audit)
        store.add_event(audit_id, "paper_parsed", "Paper text parsed.")

        store.add_event(audit_id, "finding_claims", "Finding auditable claims.")
        claims = extract_claims(paper_text)
        store.save_claims(audit_id, [claim.to_dict() for claim in claims])
        store.add_event(audit_id, "claims_extracted", f"Extracted {len(claims)} claims.")

        settings = get_settings()
        store.add_event(audit_id, "cloning_repo", "Preparing repository workspace.")
        repo_path, repo_message = await asyncio.to_thread(_clone_or_resolve_repo, audit, settings)
        store.add_event(audit_id, "repo_cloned", repo_message)

        store.add_event(audit_id, "searching_evidence", "Searching for evidence with Nia and local fallback.")
        search_client = ContextSearchClient(PROJECT_ROOT, api_key=settings.nia_api_key)

        verdicts = []
        for claim in claims:
            evidence = await search_client.search_for_claim(claim, repo_path)
            verdict = check_claim(claim, evidence)
            verdicts.append(verdict.to_dict())

        store.add_event(audit_id, "evidence_searched", f"Evidence search completed for {len(claims)} claims.")
        store.add_event(audit_id, "checking_claims", "Checking claims against code evidence.")
        store.save_verdicts(audit_id, verdicts)
        store.add_event(audit_id, "claims_checked", f"Checked {len(verdicts)} claims.")

        score = score_verdicts(verdicts)
        store.add_event(audit_id, "scoring", f"Computed reproducibility score {score}.")

        refreshed = store.get_audit(audit_id) or audit
        store.add_event(audit_id, "generating_report", "Generating reproducibility report.")
        report = render_report(refreshed, verdicts, score)
        store.save_report(audit_id, score, report)
        store.add_event(audit_id, "report_generated", "Report generated and ready for review.")

        await _send_reply(audit_id, store, settings, refreshed, report)
        store.set_status(audit_id, "done", "done")
        store.add_event(audit_id, "done", "Audit completed.")
    except Exception as exc:
        store.set_status(audit_id, "failed", "failed")
        store.add_event(audit_id, "failed", f"Audit failed: {exc}")


def _load_paper_text(audit: dict) -> str:
    paper_url = audit.get("paper_url") or ""
    if paper_url.startswith("demo:"):
        case = paper_url.split(":", 1)[1]
        return (DEMO_ROOT / case / "paper.txt").read_text(encoding="utf-8")
    if paper_url and Path(paper_url).exists():
        path = Path(paper_url)
        if path.suffix.lower() == ".pdf":
            from . import paper_parser
            try:
                return paper_parser.extract_text(path)
            except Exception:
                return ""
        return path.read_text(encoding="utf-8", errors="ignore")
    if paper_url:
        return "\n".join(
            part
            for part in [
                audit.get("subject", ""),
                audit.get("body", ""),
                audit.get("question", ""),
                paper_url,
            ]
            if part
        )
    return "\n".join(
        part
        for part in [
            audit.get("subject", ""),
            audit.get("body", ""),
            audit.get("question", ""),
        ]
        if part
    )


async def _send_reply(audit_id: str, store: Storage, settings, audit: dict, report: str) -> None:
    thread_id = audit.get("thread_id") or ""
    if not thread_id:
        store.add_event(audit_id, "sending_reply", "Report stored. No thread_id present, skipping AgentMail send.")
        return

    subject = audit.get("subject") or "ReproClaw audit"
    if subject and not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"

    client = AgentMailClient(api_key=settings.agentmail_api_key, inbox_id=settings.agentmail_inbox_id)
    result = await client.reply_to_thread(
        thread_id=thread_id,
        text=report,
        subject=subject,
        message_id=audit.get("message_id") or "",
    )
    if result.get("sent"):
        store.add_event(audit_id, "sending_reply", f"AgentMail reply sent in thread {thread_id}.")
    else:
        reason = result.get("reason") or "unknown"
        detail = result.get("detail") or ""
        message = f"AgentMail reply not sent ({reason})."
        if detail:
            message = f"{message} {detail[:160]}"
        store.add_event(audit_id, "sending_reply", message)


def _resolve_repo_path(audit: dict) -> Path:
    repo_url = audit.get("repo_url") or ""
    if repo_url.startswith("demo:"):
        case = repo_url.split(":", 1)[1]
        return DEMO_ROOT / case / "repo"
    if repo_url and Path(repo_url).exists():
        return Path(repo_url)
    return PROJECT_ROOT


def _clone_or_resolve_repo(audit: dict, settings) -> tuple[Path, str]:
    repo_url = audit.get("repo_url") or ""
    if repo_url.startswith("demo:"):
        case = repo_url.split(":", 1)[1]
        return DEMO_ROOT / case / "repo", "Demo repository workspace ready."
    if repo_url and Path(repo_url).exists():
        return Path(repo_url), "Local repository workspace ready."
    if not repo_url.startswith("https://github.com/"):
        return PROJECT_ROOT, "No remote repository URL; using project workspace fallback."

    digest = hashlib.sha256(repo_url.encode("utf-8")).hexdigest()[:12]
    target = settings.repo_cache_dir / digest
    if (target / ".git").exists():
        return target, "Cached repository clone ready."
    if target.exists() and any(target.iterdir()):
        return target, "Repository cache ready."

    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, str(target)],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return PROJECT_ROOT, f"Repository clone unavailable; using project workspace fallback ({exc})."

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "git clone failed").strip().splitlines()[:1]
        reason = detail[0] if detail else "git clone failed"
        return PROJECT_ROOT, f"Repository clone failed; using project workspace fallback ({reason})."
    return target, "Repository cloned into local audit workspace."
