from __future__ import annotations

import asyncio
from pathlib import Path
import re
from typing import Any

import httpx

from .models import EvidenceCandidate, PaperClaim


TEXT_SUFFIXES = {
    ".py",
    ".md",
    ".txt",
    ".yaml",
    ".yml",
    ".json",
    ".toml",
    ".ini",
    ".cfg",
}


NIA_BASE_URL = "https://apigcp.trynia.ai"


class ContextSearchClient:
    """Nia-backed evidence search with a deterministic local fallback.

    The pipeline calls `search_for_claim` (claim-driven local scan that always
    works for the demo fixtures). The spec interface (`index_source`, `search`,
    `read`) attempts Nia HTTP first when an API key is configured and falls
    back to local file scanning when Nia is unreachable or unconfigured.
    """

    def __init__(self, project_root: Path, api_key: str = "", base_url: str = NIA_BASE_URL):
        self.project_root = project_root
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    # ---- Spec interface ---------------------------------------------------

    async def index_source(self, source_type: str, source_uri: str) -> str:
        return source_uri or source_type

    async def search(self, query: str, source_ids: list[str], top_k: int = 8) -> list[dict[str, Any]]:
        if self.api_key and source_ids:
            results = await self._nia_search(query, source_ids, top_k)
            if results:
                return results
        return self._local_search(query, source_ids, top_k)

    async def read(self, source_id: str, path: str) -> str:
        if self.api_key and source_id:
            text = await self._nia_read(source_id, path)
            if text:
                return text
        candidate = Path(path)
        if not candidate.is_absolute():
            candidate = self.project_root / candidate
        if candidate.exists() and candidate.is_file():
            return _read_text(candidate)
        return ""

    # ---- Pipeline-facing helper ------------------------------------------

    async def search_for_claim(self, claim: PaperClaim, repo_path: Path, top_k: int = 8) -> list[EvidenceCandidate]:
        await asyncio.sleep(0)
        if not repo_path.exists():
            return []

        patterns = _patterns_for_claim(claim)
        matches: list[EvidenceCandidate] = []
        for path in _iter_text_files(repo_path):
            rel_path = path.relative_to(repo_path).as_posix()
            text = _read_text(path)
            if not text:
                continue
            for pattern in patterns:
                found = re.search(pattern, text, re.I)
                if not found:
                    continue
                line_start, snippet = _snippet_for_match(text, found.start())
                matches.append(
                    EvidenceCandidate(
                        claim_id=claim.claim_id,
                        source_type="repo",
                        path=rel_path,
                        line_start=line_start,
                        line_end=line_start + max(snippet.count("\n"), 0),
                        snippet=snippet,
                        retrieval_method="fallback_search",
                        alignment_confidence=0.7,
                    )
                )
                break
            if len(matches) >= top_k:
                break
        return matches

    # ---- Internals --------------------------------------------------------

    async def _nia_search(self, query: str, source_ids: list[str], top_k: int) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(
                    f"{self.base_url}/v2/search",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "query": query,
                        "sources": source_ids,
                        "limit": top_k,
                        "include_sources": True,
                    },
                )
        except httpx.HTTPError:
            return []
        if response.status_code >= 400:
            return []
        try:
            payload = response.json()
        except ValueError:
            return []
        results = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(results, list):
            return []
        return results[:top_k]

    async def _nia_read(self, source_id: str, path: str) -> str:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(
                    f"{self.base_url}/v2/sources/{source_id}/file",
                    params={"path": path},
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
        except httpx.HTTPError:
            return ""
        if response.status_code >= 400:
            return ""
        return response.text

    def _local_search(self, query: str, source_ids: list[str], top_k: int) -> list[dict[str, Any]]:
        roots = [self._resolve_root(source_id) for source_id in source_ids] or [self.project_root]
        roots = [root for root in roots if root and root.exists()]
        terms = [term for term in re.split(r"\W+", query.lower()) if len(term) > 2]
        if not terms:
            return []
        results: list[dict[str, Any]] = []
        for root in roots:
            for path in _iter_text_files(root):
                text = _read_text(path)
                if not text:
                    continue
                lowered = text.lower()
                if not any(term in lowered for term in terms):
                    continue
                index = min((lowered.find(term) for term in terms if term in lowered), default=0)
                line_start, snippet = _snippet_for_match(text, index)
                results.append(
                    {
                        "source_id": str(root),
                        "path": path.relative_to(root).as_posix(),
                        "snippet": snippet,
                        "line_start": line_start,
                        "retrieval_method": "fallback_search",
                    }
                )
                if len(results) >= top_k:
                    return results
        return results

    def _resolve_root(self, source_id: str) -> Path | None:
        if not source_id:
            return None
        candidate = Path(source_id)
        if candidate.is_absolute() and candidate.exists():
            return candidate
        relative = self.project_root / source_id
        if relative.exists():
            return relative
        return None


def _patterns_for_claim(claim: PaperClaim) -> list[str]:
    key = claim.expected_key.lower()
    value = re.escape(str(claim.expected_value))
    if key == "epochs":
        return [rf"epochs?\s*[:=]\s*{value}", r"epochs?\s*[:=]\s*\d+"]
    if key == "seed_count":
        return [r"seed", r"seeds", r"for\s+seed", r"range\("]
    if key == "learning_rate":
        return [rf"(learning_rate|lr)\s*[:=]\s*{value}", r"(learning_rate|lr)\s*[:=]"]
    if key == "batch_size":
        return [rf"batch_size\s*[:=]\s*{value}", r"batch_size\s*[:=]"]
    if key == "optimizer":
        return [value, r"optimizer\s*[:=]"]
    if key == "dataset":
        return [value.replace("\\ ", "[-_ ]?")]
    if key in {"accuracy", "f1", "auroc", "bleu"}:
        metric = re.escape(claim.metric or key)
        return [rf"{metric}\s*[:=]?\s*[0-9]", metric, r"def\s+evaluate", r"metric"]
    return [re.escape(claim.metric or claim.expected_key), value]


def _iter_text_files(root: Path):
    ignored = {".git", ".venv", "venv", "node_modules", "__pycache__", ".cache", ".playwright-mcp"}
    for path in root.rglob("*"):
        if any(part in ignored for part in path.parts):
            continue
        if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES:
            yield path


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="ignore")


def _snippet_for_match(text: str, index: int) -> tuple[int, str]:
    lines = text.splitlines()
    running = 0
    for line_number, line in enumerate(lines, start=1):
        next_running = running + len(line) + 1
        if next_running >= index:
            start = max(1, line_number - 2)
            end = min(len(lines), line_number + 2)
            snippet = "\n".join(lines[start - 1 : end])
            return start, snippet
        running = next_running
    return 1, text[:500]


def evidence_to_dict(items: list[EvidenceCandidate]) -> list[dict[str, Any]]:
    return [item.to_dict() for item in items]
