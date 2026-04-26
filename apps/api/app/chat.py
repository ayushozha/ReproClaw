from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Any
from xml.etree import ElementTree as ET

import anthropic
import httpx


_ARXIV_MIN_INTERVAL_S = 3.2
_ARXIV_LOCK = asyncio.Lock()
_arxiv_last_call_ts: float = 0.0


MODEL = "claude-sonnet-4-6"

SYSTEM_PROMPT = (
    "You are ReproClaw's research assistant inside the ReproClaw dashboard. "
    "ReproClaw audits ML papers for reproducibility against their code. "
    "You help researchers find papers on arXiv and the matching code "
    "repositories on GitHub.\n\n"
    "You have two tools:\n"
    "  - search_arxiv(query, max_results) — searches arXiv.org\n"
    "  - search_github(query, max_results) — searches GitHub repositories\n\n"
    "Use them to ground every factual claim. Never invent paper IDs, author "
    "names, repository URLs, or star counts. If a search returns nothing, say "
    "so plainly.\n\n"
    "Use full https://arxiv.org/abs/... links for arXiv papers and GitHub "
    "repos by their full URL. Keep replies focused, neutral, reviewer-style. Each tool call is "
    "shown to the user as a small inline card, so do not narrate \"I am now "
    "searching\" — just call the tool and discuss the results."
)


RESEARCH_RESPONSE_PROMPT = (
    "Research behavior:\n"
    "- Keep using arXiv and GitHub search until you can name enough credible "
    "papers, or until the available tool budget is exhausted.\n"
    "- Never stop with process commentary such as 'I stopped after several "
    "tool rounds' or ask the user to continue. Always synthesize the best "
    "answer from the evidence gathered.\n"
    "- Return exactly 3 papers by default. If the user asks for a specific "
    "count, return that count when enough grounded results exist. If the user "
    "asks for multiple results without a number, return 5.\n"
    "- Prefer papers with available implementation repositories or clearly "
    "verifiable artifacts.\n\n"
    "Final answer format:\n"
    "Paper: <Name>\n"
    "ArXiv: <ArXiv Link>\n"
    "Field: <Field, Subfield>\n"
    "Result: <What this paper proved>\n"
    "Verification: <What could be verified here or what needs verification here>\n\n"
    "---\n\n"
    "Repeat that block for each result. The final answer must start with "
    "`Paper:`. Do not add a preamble, headings, caveats, bullets, summaries, "
    "or extra sections before or after the result blocks. Put the `---` "
    "separator only between result blocks. Use full https://arxiv.org/abs/... "
    "links."
)


FINAL_SYNTHESIS_PROMPT = (
    "You have reached the end of the available tool budget. Do not call tools "
    "and do not ask the user to continue. Produce the best grounded answer "
    "from the arXiv and GitHub results already gathered. If fewer than the "
    "requested number of credible papers are supported by the gathered data, "
    "return only the credible papers and state uncertainty inside the relevant "
    "Verification field."
)


TOOLS: list[dict[str, Any]] = [
    {
        "name": "search_arxiv",
        "description": (
            "Search arXiv for papers matching the query. Returns a list of "
            "papers with arxiv_id, title, authors, abstract, published date, "
            "and PDF/abstract URLs. Use this for any question about academic "
            "papers, results, or research areas."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Free-text search query. May include author names, keywords, or topic phrases.",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Number of results to return (1-10).",
                    "default": 5,
                    "minimum": 1,
                    "maximum": 10,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "search_github",
        "description": (
            "Search GitHub for code repositories matching the query. Returns "
            "full_name, html_url, description, primary language, and star "
            "count. Use this when looking for the implementation of a paper "
            "or any open-source codebase. Supports GitHub search qualifiers "
            "like 'language:python' or 'stars:>100'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "GitHub search query. Supports qualifiers.",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Number of results to return (1-10).",
                    "default": 5,
                    "minimum": 1,
                    "maximum": 10,
                },
            },
            "required": ["query"],
        },
    },
]


class ChatAgent:
    """Manual agent loop over the Anthropic Messages API.

    Returns the new messages appended this turn (user + any tool_use/tool_result
    pairs + final assistant) so the caller can persist and stream them to the UI.
    """

    def __init__(self, api_key: str):
        self._api_key = api_key
        self._client = anthropic.AsyncAnthropic(api_key=api_key) if api_key else None

    async def run(
        self,
        history: list[dict[str, Any]],
        user_message: str,
        max_iterations: int = 12,
    ) -> list[dict[str, Any]]:
        if not self._client:
            return [
                {"role": "user", "content": [{"type": "text", "text": user_message}]},
                {
                    "role": "assistant",
                    "content": [
                        {
                            "type": "text",
                            "text": "ANTHROPIC_API_KEY is not configured on the server.",
                        }
                    ],
                },
            ]

        new_messages: list[dict[str, Any]] = [
            {"role": "user", "content": [{"type": "text", "text": user_message}]}
        ]
        messages: list[dict[str, Any]] = [*history, *new_messages]

        for _ in range(max_iterations):
            try:
                response = await self._client.messages.create(
                    model=MODEL,
                    max_tokens=2048,
                    system=[
                        {
                            "type": "text",
                            "text": f"{SYSTEM_PROMPT}\n\n{RESEARCH_RESPONSE_PROMPT}",
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    tools=TOOLS,
                    messages=messages,
                )
            except anthropic.APIStatusError as exc:
                new_messages.append(
                    {
                        "role": "assistant",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Anthropic API error ({exc.status_code}): {exc.message}",
                            }
                        ],
                    }
                )
                return new_messages

            assistant_content = [_block_to_dict(b) for b in response.content]
            messages.append({"role": "assistant", "content": assistant_content})
            new_messages.append({"role": "assistant", "content": assistant_content})

            if response.stop_reason != "tool_use":
                assistant_content = _normalize_research_answer(assistant_content)
                if not _has_visible_text(assistant_content):
                    assistant_content = await self._synthesize_final(messages)
                messages[-1]["content"] = assistant_content
                new_messages[-1]["content"] = assistant_content
                if not _has_visible_text(assistant_content):
                    fallback = _fallback_from_tool_results(messages)
                    if fallback:
                        new_messages[-1]["content"] = fallback
                        messages[-1]["content"] = fallback
                return new_messages

            tool_results: list[dict[str, Any]] = []
            for block in response.content:
                if getattr(block, "type", None) != "tool_use":
                    continue
                output, is_error = await _run_tool(block.name, dict(block.input or {}))
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": output,
                        "is_error": is_error,
                    }
                )
            if not tool_results:
                return new_messages
            messages.append({"role": "user", "content": tool_results})
            new_messages.append({"role": "user", "content": tool_results})

        # Tool budget reached; synthesize a final answer from gathered evidence.
        final_content = await self._synthesize_final(messages)
        if not _has_visible_text(final_content):
            fallback = _fallback_from_tool_results(messages)
            if fallback:
                final_content = fallback
        new_messages.append({"role": "assistant", "content": final_content})
        return new_messages

    async def run_stream(
        self,
        history: list[dict[str, Any]],
        user_message: str,
        max_iterations: int = 12,
    ):
        """Yield SSE-shaped events while running the agent loop.

        Each yielded value is a dict {event, data}. Caller serializes it to SSE.
        At end, yields {event: "done", data: {messages: <full new turn>}}.
        """
        if not self._client:
            yield {
                "event": "error",
                "data": {"message": "ANTHROPIC_API_KEY is not configured on the server."},
            }
            yield {
                "event": "done",
                "data": {
                    "messages": [
                        {"role": "user", "content": [{"type": "text", "text": user_message}]},
                        {
                            "role": "assistant",
                            "content": [
                                {"type": "text", "text": "ANTHROPIC_API_KEY is not configured on the server."}
                            ],
                        },
                    ]
                },
            }
            return

        new_messages: list[dict[str, Any]] = [
            {"role": "user", "content": [{"type": "text", "text": user_message}]}
        ]
        messages: list[dict[str, Any]] = [*history, *new_messages]
        yield {"event": "turn_start", "data": {"user_message": user_message}}

        for _ in range(max_iterations):
            try:
                async with self._client.messages.stream(
                    model=MODEL,
                    max_tokens=2048,
                    system=[
                        {
                            "type": "text",
                            "text": f"{SYSTEM_PROMPT}\n\n{RESEARCH_RESPONSE_PROMPT}",
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    tools=TOOLS,
                    messages=messages,
                ) as stream:
                    async for event in stream:
                        etype = getattr(event, "type", None)
                        if etype == "content_block_delta":
                            delta = getattr(event, "delta", None)
                            dtype = getattr(delta, "type", None)
                            if dtype == "text_delta":
                                yield {
                                    "event": "text_delta",
                                    "data": {"text": getattr(delta, "text", "")},
                                }
                    final_message = await stream.get_final_message()
            except anthropic.APIStatusError as exc:
                err_msg = f"Anthropic API error ({exc.status_code}): {exc.message}"
                yield {"event": "error", "data": {"message": err_msg}}
                new_messages.append(
                    {"role": "assistant", "content": [{"type": "text", "text": err_msg}]}
                )
                yield {"event": "done", "data": {"messages": new_messages}}
                return

            assistant_content = [_block_to_dict(b) for b in final_message.content]
            messages.append({"role": "assistant", "content": assistant_content})
            new_messages.append({"role": "assistant", "content": assistant_content})
            yield {
                "event": "assistant_complete",
                "data": {"content": assistant_content, "stop_reason": final_message.stop_reason},
            }

            if final_message.stop_reason != "tool_use":
                normalized = _normalize_research_answer(assistant_content)
                if not _has_visible_text(normalized):
                    normalized = await self._synthesize_final(messages)
                if not _has_visible_text(normalized):
                    fallback = _fallback_from_tool_results(messages)
                    if fallback:
                        normalized = fallback
                messages[-1]["content"] = normalized
                new_messages[-1]["content"] = normalized
                yield {"event": "final_text", "data": {"content": normalized}}
                yield {"event": "done", "data": {"messages": new_messages}}
                return

            # Run each tool, streaming a tool_use → tool_result pair per call.
            tool_results: list[dict[str, Any]] = []
            for block in final_message.content:
                if getattr(block, "type", None) != "tool_use":
                    continue
                tool_input = dict(block.input or {})
                yield {
                    "event": "tool_use",
                    "data": {
                        "id": block.id,
                        "name": block.name,
                        "input": tool_input,
                    },
                }
                output, is_error = await _run_tool(block.name, tool_input)
                preview = _summarize_tool_output(block.name, output, is_error)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": output,
                        "is_error": is_error,
                    }
                )
                yield {
                    "event": "tool_result",
                    "data": {
                        "tool_use_id": block.id,
                        "name": block.name,
                        "is_error": is_error,
                        "preview": preview,
                    },
                }

            if not tool_results:
                yield {"event": "done", "data": {"messages": new_messages}}
                return
            messages.append({"role": "user", "content": tool_results})
            new_messages.append({"role": "user", "content": tool_results})

        # Tool budget reached.
        yield {"event": "synthesizing", "data": {"reason": "tool_budget_reached"}}
        final_content = await self._synthesize_final(messages)
        if not _has_visible_text(final_content):
            fallback = _fallback_from_tool_results(messages)
            if fallback:
                final_content = fallback
        new_messages.append({"role": "assistant", "content": final_content})
        yield {"event": "final_text", "data": {"content": final_content}}
        yield {"event": "done", "data": {"messages": new_messages}}

    async def _synthesize_final(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        try:
            response = await self._client.messages.create(
                model=MODEL,
                max_tokens=2500,
                system=[
                    {
                        "type": "text",
                        "text": (
                            f"{SYSTEM_PROMPT}\n\n"
                            f"{RESEARCH_RESPONSE_PROMPT}\n\n"
                            f"{FINAL_SYNTHESIS_PROMPT}"
                        ),
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=messages,
            )
        except anthropic.APIStatusError as exc:
            return [
                {
                    "type": "text",
                    "text": f"Anthropic API error ({exc.status_code}): {exc.message}",
                }
            ]
        except anthropic.APIError as exc:
            return [
                {
                    "type": "text",
                    "text": f"Anthropic API error while synthesizing results: {exc}",
                }
            ]
        return _normalize_research_answer([_block_to_dict(b) for b in response.content])


def _block_to_dict(block: Any) -> dict[str, Any]:
    if hasattr(block, "model_dump"):
        return block.model_dump(exclude_none=True, mode="json")
    return dict(block) if isinstance(block, dict) else {"type": "text", "text": str(block)}


def _summarize_tool_output(name: str, output: str, is_error: bool) -> dict[str, Any]:
    if is_error:
        return {"count": 0, "label": "error"}
    try:
        payload = json.loads(output) if isinstance(output, str) else output
    except ValueError:
        return {"count": 0, "label": "result"}
    if not isinstance(payload, dict):
        return {"count": 0, "label": "result"}
    results = payload.get("results") or []
    count = len(results) if isinstance(results, list) else 0
    if name == "search_arxiv":
        return {"count": count, "label": f"{count} {'paper' if count == 1 else 'papers'}"}
    if name == "search_github":
        return {"count": count, "label": f"{count} {'repo' if count == 1 else 'repos'}"}
    return {"count": count, "label": f"{count} results"}


def _has_visible_text(content: list[dict[str, Any]]) -> bool:
    for block in content or []:
        if block.get("type") == "text" and (block.get("text") or "").strip():
            return True
    return False


def _fallback_from_tool_results(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    arxiv: list[dict[str, Any]] = []
    github: list[dict[str, Any]] = []
    rate_limited = False
    for msg in messages:
        if msg.get("role") != "user":
            continue
        for block in msg.get("content") or []:
            if block.get("type") != "tool_result":
                continue
            raw = block.get("content")
            if not isinstance(raw, str):
                continue
            try:
                payload = json.loads(raw)
            except ValueError:
                continue
            results = payload.get("results") or []
            if payload.get("error") == "arxiv_rate_limited":
                rate_limited = True
            for item in results:
                if not isinstance(item, dict):
                    continue
                if "arxiv_id" in item:
                    arxiv.append(item)
                elif "full_name" in item:
                    github.append(item)

    if not arxiv and not github:
        if rate_limited:
            text = (
                "I couldn't search arXiv just now — they rate-limited the request. "
                "Please try again in a minute or rephrase the query."
            )
        else:
            text = "I couldn't find any usable results. Try rephrasing the question or narrowing the topic."
        return [{"type": "text", "text": text}]

    lines: list[str] = []
    if rate_limited:
        lines.append("arXiv was rate-limited so this answer leans on GitHub results.\n")

    if arxiv:
        for paper in arxiv[:5]:
            title = (paper.get("title") or "").strip()
            arxiv_id = paper.get("arxiv_id") or ""
            authors = ", ".join((paper.get("authors") or [])[:3])
            summary = (paper.get("summary") or "").strip()
            lines.append(f"Paper: {title}")
            if arxiv_id:
                lines.append(f"ArXiv: https://arxiv.org/abs/{arxiv_id}")
            if authors:
                lines.append(f"Authors: {authors}")
            if summary:
                lines.append(f"Result: {summary[:300]}")
            lines.append("Verification: Needs manual review.\n---\n")

    if github and not arxiv:
        for repo in github[:5]:
            full = repo.get("full_name") or ""
            url = repo.get("html_url") or ""
            desc = (repo.get("description") or "").strip()
            stars = repo.get("stars") or 0
            lang = repo.get("language") or ""
            lines.append(f"Paper: code repository {full}")
            lines.append(f"ArXiv: {url}")
            lines.append(f"Field: GitHub, {lang or 'unknown'}")
            lines.append(f"Result: {desc} ({stars} stars)" if desc else f"Result: {stars} stars")
            lines.append("Verification: Open the repo and confirm the implementation matches the paper.\n---\n")

    return [{"type": "text", "text": "\n".join(lines).strip()}]


def _normalize_research_answer(content: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for block in content:
        if block.get("type") != "text" or not isinstance(block.get("text"), str):
            normalized.append(block)
            continue
        normalized.append({**block, "text": _trim_to_paper_blocks(block["text"])})
    return normalized


def _trim_to_paper_blocks(text: str) -> str:
    match = re.search(r"(?im)^Paper:\s*", text)
    if not match:
        return text
    return text[match.start() :].strip()


async def _run_tool(name: str, args: dict[str, Any]) -> tuple[str, bool]:
    try:
        if name == "search_arxiv":
            results = await _search_arxiv(
                str(args.get("query", "")),
                int(args.get("max_results") or 5),
            )
            return json.dumps({"results": results}, ensure_ascii=False), False
        if name == "search_github":
            results = await _search_github(
                str(args.get("query", "")),
                int(args.get("max_results") or 5),
            )
            return json.dumps({"results": results}, ensure_ascii=False), False
        return f"Unknown tool: {name}", True
    except _ArxivRateLimited:
        return (
            json.dumps({
                "results": [],
                "error": "arxiv_rate_limited",
                "guidance": "arXiv rate-limited the request. Stop calling search_arxiv and answer using the GitHub results you already have, or rephrase the question.",
            }),
            True,
        )
    except httpx.HTTPError as exc:
        return f"Network error calling {name}: {exc}", True
    except Exception as exc:
        return f"Tool {name} failed: {exc}", True


async def _search_arxiv(query: str, max_results: int) -> list[dict[str, Any]]:
    max_results = max(1, min(max_results, 10))
    if not query.strip():
        return []

    headers = {"User-Agent": "ReproClaw-Research/0.1 (mailto:demo@reproclaw.ai)"}
    params = {
        "search_query": f"all:{query}",
        "max_results": str(max_results),
        "sortBy": "relevance",
    }

    async def _do_request() -> httpx.Response:
        async with _ARXIV_LOCK:
            global _arxiv_last_call_ts
            elapsed = time.monotonic() - _arxiv_last_call_ts
            if elapsed < _ARXIV_MIN_INTERVAL_S:
                await asyncio.sleep(_ARXIV_MIN_INTERVAL_S - elapsed)
            try:
                async with httpx.AsyncClient(timeout=25) as client:
                    return await client.get(
                        "https://export.arxiv.org/api/query",
                        params=params,
                        headers=headers,
                    )
            finally:
                _arxiv_last_call_ts = time.monotonic()

    response = await _do_request()
    if response.status_code == 429:
        retry_after = response.headers.get("retry-after", "")
        try:
            wait_s = max(1.0, min(float(retry_after), 15.0))
        except ValueError:
            wait_s = 5.0
        await asyncio.sleep(wait_s)
        response = await _do_request()
        if response.status_code == 429:
            raise _ArxivRateLimited()
    response.raise_for_status()
    return _parse_arxiv_atom(response.text)[:max_results]


class _ArxivRateLimited(Exception):
    pass


def _parse_arxiv_atom(xml_text: str) -> list[dict[str, Any]]:
    ns = {"a": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(xml_text)
    out: list[dict[str, Any]] = []
    for entry in root.findall("a:entry", ns):
        raw_id = (entry.findtext("a:id", default="", namespaces=ns) or "").strip()
        match = re.search(r"abs/([0-9A-Za-z.\-]+?)(v\d+)?$", raw_id)
        arxiv_id = match.group(1) if match else raw_id
        authors = [
            (a.findtext("a:name", default="", namespaces=ns) or "").strip()
            for a in entry.findall("a:author", ns)
        ]
        out.append(
            {
                "arxiv_id": arxiv_id,
                "title": _normalize_whitespace(entry.findtext("a:title", default="", namespaces=ns)),
                "summary": _normalize_whitespace(entry.findtext("a:summary", default="", namespaces=ns)),
                "authors": authors,
                "published": (entry.findtext("a:published", default="", namespaces=ns) or "")[:10],
                "pdf_url": f"https://arxiv.org/pdf/{arxiv_id}",
                "abs_url": f"https://arxiv.org/abs/{arxiv_id}",
            }
        )
    return out


async def _search_github(query: str, max_results: int) -> list[dict[str, Any]]:
    max_results = max(1, min(max_results, 10))
    if not query.strip():
        return []
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "ReproClaw-Research/0.1",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            "https://api.github.com/search/repositories",
            params={
                "q": query,
                "per_page": str(max_results),
                "sort": "best-match",
            },
            headers=headers,
        )
    if response.status_code == 403:
        return [{"warning": "GitHub anonymous rate limit reached. Retry shortly."}]
    response.raise_for_status()
    items = response.json().get("items") or []
    return [
        {
            "full_name": item.get("full_name"),
            "html_url": item.get("html_url"),
            "description": item.get("description"),
            "stars": item.get("stargazers_count"),
            "language": item.get("language"),
            "updated_at": item.get("updated_at"),
        }
        for item in items[:max_results]
    ]


def _normalize_whitespace(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()
