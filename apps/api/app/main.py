from __future__ import annotations

import asyncio
import hashlib
import json
from pathlib import Path
import re

from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import paper_parser

from .agentmail_client import AgentMailClient
from .audit_pipeline import run_audit
from .chat import ChatAgent
from .config import PROJECT_ROOT, get_settings
from .discover import discover_repo_candidates
from .email_parser import parse_audit_request
from .followup import claim_id_from_question, render_explanation
from .nia_client import ContextSearchClient
from .search import ApplicationSearchService
from .storage import Storage


settings = get_settings()
store = Storage(settings.database_path)
chat_agent = ChatAgent(api_key=settings.anthropic_api_key)
search_service = ApplicationSearchService(store, settings)
static_dir = Path(__file__).parent / "static"

app = FastAPI(title="ReproClaw API", version="0.1.0")
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.on_event("startup")
async def startup() -> None:
    store.init()


@app.get("/")
async def landing() -> FileResponse:
    return FileResponse(static_dir / "index.html")


@app.get("/dashboard")
async def dashboard() -> FileResponse:
    return FileResponse(static_dir / "dashboard.html")


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "reproclaw-api"}


@app.post("/audits")
async def create_audit(request: Request) -> dict:
    payload = await request.json()
    audit_request = parse_audit_request(payload)
    audit_id = store.create_audit(audit_request)
    store.add_event(audit_id, "finding_paper", "Resolving the paper reference.")
    if audit_request.paper_url:
        store.add_event(audit_id, "paper_found", f"Paper ready: {audit_request.paper_url}")
    else:
        store.add_event(audit_id, "paper_found", "Paper reference missing; using request body only.")
    store.add_event(audit_id, "finding_github_repo", "Looking for a matching GitHub repository.")
    if audit_request.repo_url:
        store.add_event(audit_id, "github_found", f"Repository ready: {audit_request.repo_url}")
    else:
        store.add_event(audit_id, "github_found", "No repository provided; using available project context.")
    nia_status = await _attempt_nia_index(audit_id, audit_request.repo_url)
    asyncio.create_task(run_audit(audit_id, store))
    return {"audit_id": audit_id, "status": "queued", "nia": nia_status}


@app.post("/audits/upload-paper")
async def upload_paper(file: UploadFile = File(...)) -> dict:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")
    cache_dir = settings.pdf_cache_dir
    cache_dir.mkdir(parents=True, exist_ok=True)

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file.")
    digest = hashlib.sha256(contents).hexdigest()[:16]
    target = cache_dir / f"{digest}.pdf"
    target.write_bytes(contents)

    pages = 0
    try:
        pages = paper_parser.page_count(target)
    except Exception:
        pages = 0

    return {
        "paper_url": str(target),
        "filename": file.filename,
        "size": len(contents),
        "pages": pages,
    }


@app.post("/audits/discover")
async def audits_discover(request: Request) -> dict:
    payload = await request.json()
    paper = str(payload.get("paper") or "").strip()
    if not paper:
        raise HTTPException(status_code=400, detail="paper is required")
    return await discover_repo_candidates(paper, limit=3)


async def _attempt_nia_index(audit_id: str, repo_url: str) -> dict:
    if not repo_url or repo_url.startswith("demo:"):
        store.add_event(audit_id, "indexing", "Skipping Nia index (no remote repo URL).")
        return {"indexed": False, "reason": "no_remote_repo"}
    client = ContextSearchClient(PROJECT_ROOT, api_key=settings.nia_api_key)
    try:
        source_id = await client.index_source("github", repo_url)
    except Exception as exc:
        store.add_event(audit_id, "indexing", f"Nia indexing failed: {exc}")
        return {"indexed": False, "reason": "error", "detail": str(exc)}
    if not source_id:
        store.add_event(audit_id, "indexing", "Nia returned no source id; falling back to local scan.")
        return {"indexed": False, "reason": "no_source_id"}
    store.add_event(audit_id, "indexing", f"Repo registered with Nia (source_id={source_id}).")
    return {"indexed": True, "source_id": source_id}


@app.post("/webhooks/agentmail")
async def agentmail_webhook(request: Request) -> dict:
    payload = await request.json()
    audit_request = parse_audit_request(payload)
    if audit_request.message_id and store.message_seen(audit_request.message_id):
        return {"status": "ignored", "reason": "duplicate_message"}
    audit_id = store.create_audit(audit_request)
    asyncio.create_task(run_audit(audit_id, store))
    return {"audit_id": audit_id, "status": "queued"}


@app.get("/audits")
async def list_audits() -> dict:
    return {"audits": store.list_audits()}


@app.get("/audits/{audit_id}")
async def get_audit(audit_id: str) -> dict:
    audit = store.get_audit(audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    return audit


@app.get("/search")
async def search(q: str = Query("", max_length=240), limit: int = Query(12, ge=1, le=30)) -> dict:
    return await search_service.search(q, limit=limit)


@app.get("/audits/{audit_id}/events")
async def audit_events(audit_id: str) -> StreamingResponse:
    if not store.get_audit(audit_id):
        raise HTTPException(status_code=404, detail="Audit not found")

    async def event_stream():
        last_id = 0
        while True:
            events = store.get_events_after(audit_id, last_id)
            for event in events:
                last_id = event["id"]
                yield f"id: {last_id}\nevent: audit_event\ndata: {json.dumps(event)}\n\n"
            audit = store.get_audit(audit_id)
            if audit and audit["status"] in {"done", "failed"} and not events:
                break
            await asyncio.sleep(1)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/audits/{audit_id}/claims/{claim_id}/explain")
async def explain_claim(audit_id: str, claim_id: str) -> dict:
    audit = store.get_audit(audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    claim = store.get_claim(audit_id, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    text = render_explanation(claim)
    reply = await _post_followup_to_thread(audit, claim_id, text)
    return {"text": text, "reply": reply}


@app.post("/audits/{audit_id}/followups")
async def followup(audit_id: str, request: Request) -> dict:
    audit = store.get_audit(audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    payload = await request.json()
    question = str(payload.get("question") or "")
    claim_id = claim_id_from_question(question)
    if not claim_id:
        raise HTTPException(status_code=400, detail="Ask about a specific claim, for example: explain claim 3")
    claim = store.get_claim(audit_id, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    text = render_explanation(claim)
    reply = await _post_followup_to_thread(audit, claim_id, text)
    return {"claim_id": claim_id, "text": text, "reply": reply}


@app.post("/audits/{audit_id}/email-report")
async def email_report(audit_id: str, request: Request) -> dict:
    audit = store.get_audit(audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    if not audit.get("report_text"):
        raise HTTPException(status_code=400, detail="Report is not ready yet")

    payload = await request.json()
    recipient = str(payload.get("to") or audit.get("sender") or "").strip()
    if not _looks_like_email(recipient):
        raise HTTPException(status_code=400, detail="Provide a valid recipient email")

    subject = str(payload.get("subject") or _default_report_subject(audit)).strip()
    text = str(payload.get("text") or _default_report_email(audit)).strip()
    if not text:
        raise HTTPException(status_code=400, detail="Email body is required")

    client = AgentMailClient(api_key=settings.agentmail_api_key, inbox_id=settings.agentmail_inbox_id)
    result = await client.send_message(to=recipient, subject=subject, text=text)
    if result.get("sent"):
        store.add_event(audit_id, "email_sent", f"Report emailed to {recipient}.")
    else:
        reason = result.get("reason") or "unknown"
        detail = result.get("detail") or ""
        message = f"Report email not sent ({reason})."
        if detail:
            message = f"{message} {detail[:160]}"
        store.add_event(audit_id, "email_failed", message)
    return result


@app.get("/chat/conversations")
async def list_chat_conversations() -> dict:
    return {"conversations": store.list_conversations()}


@app.post("/chat/conversations")
async def create_chat_conversation() -> dict:
    conversation_id = store.create_conversation()
    return {"conversation_id": conversation_id}


@app.get("/chat/conversations/{conversation_id}")
async def get_chat_conversation(conversation_id: str) -> dict:
    conversation = store.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@app.post("/chat/conversations/{conversation_id}/messages/stream")
async def stream_chat_message(conversation_id: str, request: Request) -> StreamingResponse:
    conversation = store.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    payload = await request.json()
    user_message = str(payload.get("message") or "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="message is required")

    history = conversation.get("messages", [])
    history_for_agent = [{"role": m["role"], "content": m["content"]} for m in history]

    async def event_source():
        captured: list[dict] = []
        try:
            async for evt in chat_agent.run_stream(history_for_agent, user_message):
                if evt.get("event") == "done":
                    captured = evt.get("data", {}).get("messages") or []
                yield f"event: {evt['event']}\ndata: {json.dumps(evt.get('data') or {}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'message': str(exc)})}\n\n"
        finally:
            if captured:
                store.append_chat_messages(conversation_id, captured)
                if not conversation.get("title"):
                    store.set_conversation_title(conversation_id, user_message[:80])

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/chat/conversations/{conversation_id}/messages")
async def send_chat_message(conversation_id: str, request: Request) -> dict:
    conversation = store.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    payload = await request.json()
    user_message = str(payload.get("message") or "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="message is required")

    history = conversation.get("messages", [])
    history_for_agent = [{"role": m["role"], "content": m["content"]} for m in history]

    new_messages = await chat_agent.run(history_for_agent, user_message)
    store.append_chat_messages(conversation_id, new_messages)
    if not conversation.get("title"):
        store.set_conversation_title(conversation_id, user_message[:80])
    return {"messages": new_messages}


def _looks_like_email(value: str) -> bool:
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value))


def _default_report_subject(audit: dict) -> str:
    paper = audit.get("paper_url") or "your paper"
    return f"ReproClaw reproducibility audit for {paper}"


def _default_report_email(audit: dict) -> str:
    score = audit.get("score")
    score_text = f"{score} / 100" if score is not None else "pending"
    report = audit.get("report_text") or ""
    return "\n".join(
        [
            "Hi,",
            "",
            "I ran a ReproClaw reproducibility audit against the paper and linked code.",
            "",
            f"Paper: {audit.get('paper_url') or 'not provided'}",
            f"Repository: {audit.get('repo_url') or 'not provided'}",
            f"Score: {score_text}",
            "",
            report,
        ]
    ).strip()


async def _post_followup_to_thread(audit: dict, claim_id: str, text: str) -> dict:
    thread_id = audit.get("thread_id") or ""
    if not thread_id:
        store.add_event(audit["audit_id"], "followup", f"Follow-up rendered for {claim_id}; no thread_id present.")
        return {"sent": False, "reason": "missing_thread_id"}

    subject = audit.get("subject") or "ReproClaw audit"
    if subject and not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"

    client = AgentMailClient(api_key=settings.agentmail_api_key, inbox_id=settings.agentmail_inbox_id)
    result = await client.reply_to_thread(
        thread_id=thread_id,
        text=text,
        subject=subject,
        message_id=audit.get("message_id") or "",
    )
    if result.get("sent"):
        store.add_event(audit["audit_id"], "followup", f"Follow-up reply sent for {claim_id} in thread {thread_id}.")
    else:
        reason = result.get("reason") or "unknown"
        store.add_event(
            audit["audit_id"],
            "followup",
            f"Follow-up reply for {claim_id} not sent ({reason}).",
        )
    return result
