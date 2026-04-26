from __future__ import annotations

import re
from typing import Any
from xml.etree import ElementTree as ET

import httpx


ARXIV_ID_RE = re.compile(r"(\d{4}\.\d{4,5})(?:v\d+)?")
ARXIV_URL_RE = re.compile(
    r"arxiv\.org/(?:abs|pdf|html)/(\d{4}\.\d{4,5})(?:v\d+)?",
    re.I,
)


async def discover_repo_candidates(paper: str, limit: int = 3) -> dict[str, Any]:
    """Resolve a paper reference and propose up to `limit` GitHub repos.

    The paper input is a free-form string (arXiv URL, arXiv ID, or PDF URL).
    No LLM is used — arXiv Atom API for metadata, GitHub anonymous search for repos.
    """
    paper_meta = await _resolve_paper(paper)
    candidates = await _search_github_for_paper(paper_meta, limit)
    return {"paper": paper_meta, "candidates": candidates}


async def _resolve_paper(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if not text:
        return _empty_paper(raw)

    arxiv_id = _extract_arxiv_id(text)
    if not arxiv_id:
        return await _search_arxiv_by_title(text, raw)

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                "https://export.arxiv.org/api/query",
                params={"id_list": arxiv_id},
            )
    except httpx.HTTPError as exc:
        return {**_empty_paper(raw), "arxiv_id": arxiv_id, "error": f"arXiv lookup failed: {exc}"}

    if response.status_code >= 400:
        return {**_empty_paper(raw), "arxiv_id": arxiv_id, "error": f"arXiv returned {response.status_code}"}

    parsed = _parse_arxiv_atom(response.text)
    if not parsed:
        return {**_empty_paper(raw), "arxiv_id": arxiv_id}

    parsed["raw_input"] = raw
    return parsed


async def _search_arxiv_by_title(query: str, raw: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                "https://export.arxiv.org/api/query",
                params={
                    "search_query": f'all:"{query}"',
                    "max_results": "1",
                    "sortBy": "relevance",
                },
            )
    except httpx.HTTPError as exc:
        return {**_empty_paper(raw), "error": f"arXiv title search failed: {exc}"}

    if response.status_code >= 400:
        fallback = await _search_openalex_by_title(query, raw)
        if fallback.get("arxiv_id") or fallback.get("title"):
            return fallback
        return {**_empty_paper(raw), "error": f"arXiv returned {response.status_code}"}

    parsed = _parse_arxiv_atom(response.text)
    if not parsed:
        return await _search_openalex_by_title(query, raw)
    parsed["raw_input"] = raw
    return parsed


async def _search_openalex_by_title(query: str, raw: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                "https://api.openalex.org/works",
                params={"search": query, "per-page": "1"},
            )
    except httpx.HTTPError as exc:
        return {**_empty_paper(raw), "error": f"OpenAlex lookup failed: {exc}"}

    if response.status_code >= 400:
        return {**_empty_paper(raw), "error": f"OpenAlex returned {response.status_code}"}

    try:
        payload = response.json()
    except ValueError:
        return _empty_paper(raw)

    results = payload.get("results") if isinstance(payload, dict) else None
    if not results:
        return _empty_paper(raw)

    item = results[0]
    title = _normalize_whitespace(item.get("display_name") or item.get("title") or "")
    authors = [
        ((authorship.get("author") or {}).get("display_name") or "").strip()
        for authorship in item.get("authorships") or []
    ]
    authors = [author for author in authors if author]
    arxiv_id = _arxiv_id_from_openalex(item)
    primary = item.get("primary_location") or {}
    best_oa = item.get("best_oa_location") or {}
    landing_url = primary.get("landing_page_url") or best_oa.get("landing_page_url") or ""
    pdf_url = primary.get("pdf_url") or best_oa.get("pdf_url") or ""
    if arxiv_id:
        landing_url = f"https://arxiv.org/abs/{arxiv_id}"
        pdf_url = f"https://arxiv.org/pdf/{arxiv_id}"
    return {
        "raw_input": raw,
        "arxiv_id": arxiv_id,
        "title": title,
        "authors": authors,
        "summary": _abstract_from_openalex(item.get("abstract_inverted_index") or {}),
        "published": str(item.get("publication_date") or item.get("publication_year") or ""),
        "abs_url": landing_url,
        "pdf_url": pdf_url,
    }


def _arxiv_id_from_openalex(item: dict[str, Any]) -> str:
    doi = ((item.get("ids") or {}).get("doi") or item.get("doi") or "").lower()
    match = re.search(r"arxiv\.([0-9]{4}\.[0-9]{4,5})", doi)
    if match:
        return match.group(1)
    for location in item.get("locations") or []:
        for key in ("landing_page_url", "pdf_url"):
            match = ARXIV_URL_RE.search(str(location.get(key) or ""))
            if match:
                return match.group(1)
    for location_key in ("primary_location", "best_oa_location"):
        location = item.get(location_key) or {}
        for key in ("landing_page_url", "pdf_url"):
            match = ARXIV_URL_RE.search(str(location.get(key) or ""))
            if match:
                return match.group(1)
    return ""


def _abstract_from_openalex(index: dict[str, list[int]]) -> str:
    if not isinstance(index, dict):
        return ""
    words: list[tuple[int, str]] = []
    for word, positions in index.items():
        for position in positions or []:
            try:
                words.append((int(position), str(word)))
            except (TypeError, ValueError):
                continue
    words.sort(key=lambda item: item[0])
    return _normalize_whitespace(" ".join(word for _, word in words))


def _extract_arxiv_id(text: str) -> str:
    url_match = ARXIV_URL_RE.search(text)
    if url_match:
        return url_match.group(1)
    bare = ARXIV_ID_RE.search(text)
    return bare.group(1) if bare else ""


def _empty_paper(raw: str) -> dict[str, Any]:
    return {
        "raw_input": raw,
        "arxiv_id": "",
        "title": "",
        "authors": [],
        "summary": "",
        "published": "",
        "abs_url": "",
        "pdf_url": "",
    }


def _parse_arxiv_atom(xml_text: str) -> dict[str, Any] | None:
    ns = {"a": "http://www.w3.org/2005/Atom"}
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None
    entry = root.find("a:entry", ns)
    if entry is None:
        return None
    raw_id = (entry.findtext("a:id", default="", namespaces=ns) or "").strip()
    match = re.search(r"abs/([0-9A-Za-z.\-]+?)(v\d+)?$", raw_id)
    arxiv_id = match.group(1) if match else raw_id
    authors = [
        (a.findtext("a:name", default="", namespaces=ns) or "").strip()
        for a in entry.findall("a:author", ns)
    ]
    return {
        "arxiv_id": arxiv_id,
        "title": _normalize_whitespace(entry.findtext("a:title", default="", namespaces=ns)),
        "authors": [a for a in authors if a],
        "summary": _normalize_whitespace(entry.findtext("a:summary", default="", namespaces=ns)),
        "published": (entry.findtext("a:published", default="", namespaces=ns) or "")[:10],
        "abs_url": f"https://arxiv.org/abs/{arxiv_id}",
        "pdf_url": f"https://arxiv.org/pdf/{arxiv_id}",
    }


async def _search_github_for_paper(paper: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    title = paper.get("title", "")
    authors = paper.get("authors") or []
    arxiv_id = paper.get("arxiv_id", "")

    if not title and not arxiv_id:
        return []

    queries = []
    if arxiv_id:
        queries.append(f"{arxiv_id} in:readme,description")
    if title:
        title_terms = " ".join(title.split()[:6])
        first_author = authors[0].split()[-1] if authors else ""
        if first_author:
            queries.append(f"{title_terms} {first_author}")
        queries.append(f"{title_terms} paper code")
        queries.append(title_terms)

    seen: set[str] = set()
    results: list[dict[str, Any]] = []
    for query in queries:
        repos = await _github_search(query, limit)
        for repo in repos:
            full_name = repo.get("full_name") or ""
            if full_name in seen or not full_name:
                continue
            seen.add(full_name)
            results.append(repo)
            if len(results) >= limit:
                return results
    return results[:limit]


async def _github_search(query: str, per_page: int) -> list[dict[str, Any]]:
    if not query.strip():
        return []
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "ReproClaw-Discover/0.1",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                "https://api.github.com/search/repositories",
                params={"q": query, "per_page": str(per_page * 2), "sort": "best-match"},
                headers=headers,
            )
    except httpx.HTTPError:
        return []
    if response.status_code != 200:
        return []
    items = (response.json() or {}).get("items") or []
    return [
        {
            "full_name": item.get("full_name"),
            "html_url": item.get("html_url"),
            "description": item.get("description") or "",
            "stars": item.get("stargazers_count") or 0,
            "language": item.get("language") or "",
            "updated_at": item.get("updated_at") or "",
        }
        for item in items
    ]


def _normalize_whitespace(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()
