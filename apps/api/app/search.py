from __future__ import annotations

from pathlib import Path
import re
import sqlite3
from typing import Any

from .config import PROJECT_ROOT, Settings
from .nia_client import ContextSearchClient
from .storage import Storage


TOKEN_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:/-]*")


class ApplicationSearchService:
    """Application-wide search over audit data plus indexed project context."""

    def __init__(self, storage: Storage, settings: Settings):
        self.storage = storage
        self.settings = settings
        self.context = ContextSearchClient(PROJECT_ROOT, api_key=settings.nia_api_key)
        self.local_context = ContextSearchClient(PROJECT_ROOT)

    async def search(self, query: str, limit: int = 12) -> dict[str, Any]:
        clean_query = query.strip()
        if not clean_query:
            return {"query": query, "results": [], "sources": {"application": 0, "nia": 0}}

        limit = max(1, min(limit, 30))
        terms = _terms(clean_query)
        app_limit = max(4, limit)
        source_limit = max(4, limit // 2)

        app_results = self._search_application(terms, app_limit)
        source_results = await self._search_sources(clean_query, source_limit)
        results = _dedupe(app_results + source_results)
        results.sort(key=lambda item: item.get("score", 0), reverse=True)
        results = results[:limit]

        return {
            "query": clean_query,
            "results": results,
            "sources": {
                "application": sum(1 for result in results if result.get("scope") == "application"),
                "nia": sum(1 for result in results if result.get("scope") == "nia"),
            },
        }

    def _search_application(self, terms: list[str], limit: int) -> list[dict[str, Any]]:
        if not terms:
            return []

        results: list[dict[str, Any]] = []
        with self.storage.connect() as conn:
            results.extend(self._search_audits(conn, terms, limit))
            results.extend(self._search_claims(conn, terms, limit))
            results.extend(self._search_events(conn, terms, limit))
            results.extend(self._search_evidence(conn, terms, limit))

        results.sort(key=lambda item: item.get("score", 0), reverse=True)
        return results[:limit]

    def _search_audits(self, conn: sqlite3.Connection, terms: list[str], limit: int) -> list[dict[str, Any]]:
        columns = [
            "a.audit_id",
            "a.status",
            "a.stage",
            "a.paper_url",
            "a.repo_url",
            "a.question",
            "a.sender",
            "a.subject",
            "a.body",
            "a.report_text",
        ]
        where, params = _like_clause(columns, terms)
        rows = conn.execute(
            f"""
            select a.*
            from audits a
            where {_real_audit_clause()} and {where}
            order by a.updated_at desc
            limit ?
            """,
            (*params, limit * 2),
        ).fetchall()
        results = []
        for row in rows:
            data = dict(row)
            fields = [
                data.get("audit_id"),
                data.get("status"),
                data.get("stage"),
                data.get("paper_url"),
                data.get("repo_url"),
                data.get("question"),
                data.get("subject"),
                data.get("body"),
                data.get("report_text"),
            ]
            score = _score(fields, terms)
            if score <= 0:
                continue
            snippet = _best_snippet(fields, terms)
            title = f"Audit {data.get('audit_id')}"
            subtitle = _compact_source(data.get("paper_url")) or _compact_source(data.get("repo_url")) or data.get("status") or ""
            results.append(
                {
                    "kind": "audit",
                    "scope": "application",
                    "title": title,
                    "subtitle": subtitle,
                    "snippet": snippet,
                    "audit_id": data.get("audit_id"),
                    "score": min(0.99, 0.25 + score),
                }
            )
        return results

    def _search_claims(self, conn: sqlite3.Connection, terms: list[str], limit: int) -> list[dict[str, Any]]:
        columns = [
            "c.claim_id",
            "c.claim_text",
            "c.claim_type",
            "c.expected_key",
            "c.expected_value",
            "c.verdict",
            "c.severity",
            "c.reason",
            "a.paper_url",
            "a.repo_url",
        ]
        where, params = _like_clause(columns, terms)
        rows = conn.execute(
            f"""
            select c.*, a.paper_url, a.repo_url
            from claims c
            join audits a on a.audit_id = c.audit_id
            where {_real_audit_clause()} and {where}
            order by c.id desc
            limit ?
            """,
            (*params, limit * 3),
        ).fetchall()
        results = []
        for row in rows:
            data = dict(row)
            fields = [
                data.get("claim_id"),
                data.get("claim_text"),
                data.get("claim_type"),
                data.get("expected_key"),
                data.get("expected_value"),
                data.get("verdict"),
                data.get("severity"),
                data.get("reason"),
            ]
            score = _score(fields, terms)
            if score <= 0:
                continue
            results.append(
                {
                    "kind": "claim",
                    "scope": "application",
                    "title": f"Claim {data.get('claim_id')}: {_shorten(data.get('claim_text'), 90)}",
                    "subtitle": f"{data.get('verdict') or 'unknown'} | {data.get('severity') or 'unknown'}",
                    "snippet": _best_snippet(fields, terms),
                    "audit_id": data.get("audit_id"),
                    "claim_id": data.get("claim_id"),
                    "score": min(0.99, 0.35 + score),
                }
            )
        return results

    def _search_events(self, conn: sqlite3.Connection, terms: list[str], limit: int) -> list[dict[str, Any]]:
        columns = ["e.stage", "e.message", "a.paper_url", "a.repo_url", "a.subject"]
        where, params = _like_clause(columns, terms)
        rows = conn.execute(
            f"""
            select e.*, a.subject, a.paper_url, a.repo_url
            from audit_events e
            join audits a on a.audit_id = e.audit_id
            where {_real_audit_clause()} and {where}
            order by e.id desc
            limit ?
            """,
            (*params, limit * 2),
        ).fetchall()
        results = []
        for row in rows:
            data = dict(row)
            fields = [data.get("stage"), data.get("message"), data.get("subject")]
            score = _score(fields, terms)
            if score <= 0:
                continue
            results.append(
                {
                    "kind": "event",
                    "scope": "application",
                    "title": f"{data.get('stage') or 'Audit event'}",
                    "subtitle": data.get("created_at") or "",
                    "snippet": data.get("message") or _best_snippet(fields, terms),
                    "audit_id": data.get("audit_id"),
                    "score": min(0.9, 0.2 + score),
                }
            )
        return results

    def _search_evidence(self, conn: sqlite3.Connection, terms: list[str], limit: int) -> list[dict[str, Any]]:
        columns = [
            "e.claim_id",
            "e.source_type",
            "e.path",
            "e.snippet",
            "e.retrieval_method",
            "c.claim_text",
            "c.reason",
            "a.paper_url",
            "a.repo_url",
        ]
        where, params = _like_clause(columns, terms)
        rows = conn.execute(
            f"""
            select e.*, c.claim_text, c.reason
            from evidence e
            join audits a on a.audit_id = e.audit_id
            left join claims c on c.audit_id = e.audit_id and c.claim_id = e.claim_id
            where {_real_audit_clause()} and {where}
            order by e.id desc
            limit ?
            """,
            (*params, limit * 3),
        ).fetchall()
        results = []
        for row in rows:
            data = dict(row)
            fields = [
                data.get("claim_id"),
                data.get("source_type"),
                data.get("path"),
                data.get("snippet"),
                data.get("retrieval_method"),
                data.get("claim_text"),
                data.get("reason"),
            ]
            score = _score(fields, terms)
            if score <= 0:
                continue
            results.append(
                {
                    "kind": "evidence",
                    "scope": "application",
                    "title": f"Evidence for {data.get('claim_id')}",
                    "subtitle": data.get("path") or data.get("source_type") or "",
                    "snippet": _best_snippet(fields, terms),
                    "audit_id": data.get("audit_id"),
                    "claim_id": data.get("claim_id"),
                    "path": data.get("path"),
                    "line_start": data.get("line_start"),
                    "score": min(0.99, 0.4 + score),
                }
            )
        return results

    async def _search_sources(self, query: str, limit: int) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        if self.settings.nia_source_ids:
            raw = await self.context.search(query, self.settings.nia_source_ids, top_k=limit)
            results = _normalize_source_results(raw)

        if not results:
            raw = await self.local_context.search(query, [str(PROJECT_ROOT)], top_k=limit)
            results = _normalize_source_results(raw)

        return results[:limit]


def _terms(query: str) -> list[str]:
    terms: list[str] = []
    for match in TOKEN_RE.finditer(query.lower()):
        term = match.group(0).strip("._-/")
        if not term:
            continue
        if len(term) < 2 and not term.isdigit():
            continue
        if term not in terms:
            terms.append(term)
    return terms[:8]


def _real_audit_clause() -> str:
    return "(coalesce(a.paper_url, '') not like 'demo:%' and coalesce(a.repo_url, '') not like 'demo:%')"


def _like_clause(columns: list[str], terms: list[str]) -> tuple[str, list[str]]:
    clauses: list[str] = []
    params: list[str] = []
    for term in terms:
        like = f"%{term}%"
        for column in columns:
            clauses.append(f"lower(cast(coalesce({column}, '') as text)) like ?")
            params.append(like)
    return "(" + " or ".join(clauses) + ")", params


def _score(fields: list[Any], terms: list[str]) -> float:
    haystack = " ".join(str(field or "") for field in fields).lower()
    if not haystack or not terms:
        return 0.0
    unique_hits = sum(1 for term in terms if term in haystack)
    if unique_hits == 0:
        return 0.0
    frequency = sum(haystack.count(term) for term in terms)
    coverage = unique_hits / len(terms)
    density = min(frequency, 8) * 0.04
    return min(0.6, coverage * 0.45 + density)


def _best_snippet(fields: list[Any], terms: list[str]) -> str:
    values = [str(field or "").strip() for field in fields if str(field or "").strip()]
    if not values:
        return ""
    lowered_terms = [term.lower() for term in terms]
    for value in values:
        lowered = value.lower()
        if any(term in lowered for term in lowered_terms):
            return _around_match(value, lowered_terms)
    return _shorten(values[0], 260)


def _around_match(value: str, terms: list[str]) -> str:
    lowered = value.lower()
    index = min((lowered.find(term) for term in terms if term in lowered), default=0)
    start = max(0, index - 110)
    end = min(len(value), index + 220)
    prefix = "..." if start else ""
    suffix = "..." if end < len(value) else ""
    return f"{prefix}{value[start:end].strip()}{suffix}"


def _normalize_source_results(raw_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for raw in raw_results:
        if not isinstance(raw, dict):
            continue
        metadata = raw.get("metadata") if isinstance(raw.get("metadata"), dict) else {}
        source = raw.get("source") if isinstance(raw.get("source"), dict) else {}
        path = _first(raw, metadata, source, keys=("path", "file_path", "filepath", "name"))
        snippet = _first(raw, metadata, source, keys=("snippet", "content", "text", "summary", "body"))
        if not snippet:
            snippet = str(raw)
        line_start = _first(raw, metadata, source, keys=("line_start", "start_line", "line"))
        source_id = _first(raw, metadata, source, keys=("source_id", "local_folder_id", "id"))
        score = _float(_first(raw, metadata, source, keys=("score", "similarity", "alignment_confidence")), default=0.52)
        retrieval_method = _first(raw, metadata, source, keys=("retrieval_method",)) or "nia_search"
        results.append(
            {
                "kind": "source",
                "scope": "nia",
                "title": _shorten(path or source_id or "Indexed source", 120),
                "subtitle": retrieval_method,
                "snippet": _shorten(snippet, 360),
                "source_id": source_id,
                "path": path,
                "line_start": line_start,
                "score": min(0.95, max(0.05, score)),
            }
        )
    return results


def _first(*dicts: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for data in dicts:
        for key in keys:
            value = data.get(key)
            if value not in (None, ""):
                return value
    return None


def _float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _shorten(value: Any, limit: int = 160) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 3)].rstrip() + "..."


def _compact_source(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        path = Path(text)
        if path.exists():
            return path.name
    except OSError:
        pass
    return _shorten(text, 120)


def _dedupe(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    deduped: list[dict[str, Any]] = []
    for result in results:
        key = (
            result.get("kind"),
            result.get("scope"),
            result.get("audit_id"),
            result.get("claim_id"),
            result.get("path"),
            result.get("title"),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(result)
    return deduped
