from __future__ import annotations

from pathlib import Path
import json
import secrets
import sqlite3
from typing import Any

from .models import AuditRequest, utc_now


class Storage:
    def __init__(self, database_path: Path):
        self.database_path = database_path
        self.database_path.parent.mkdir(parents=True, exist_ok=True)

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.database_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                create table if not exists audits (
                    audit_id text primary key,
                    status text not null,
                    stage text not null,
                    paper_url text not null default '',
                    repo_url text not null default '',
                    question text not null default '',
                    sender text not null default '',
                    thread_id text not null default '',
                    message_id text not null default '',
                    subject text not null default '',
                    body text not null default '',
                    score integer,
                    report_text text not null default '',
                    created_at text not null,
                    updated_at text not null
                );

                create table if not exists audit_events (
                    id integer primary key autoincrement,
                    audit_id text not null,
                    stage text not null,
                    message text not null,
                    created_at text not null
                );

                create table if not exists claims (
                    id integer primary key autoincrement,
                    audit_id text not null,
                    claim_id text not null,
                    claim_text text not null,
                    claim_type text not null,
                    expected_key text not null default '',
                    expected_value text not null default '',
                    verdict text not null default 'unsupported',
                    severity text not null default 'low',
                    reason text not null default '',
                    evidence_json text not null default '[]'
                );

                create table if not exists messages (
                    message_id text primary key,
                    audit_id text not null,
                    thread_id text not null default '',
                    created_at text not null
                );

                create table if not exists evidence (
                    id integer primary key autoincrement,
                    audit_id text not null,
                    claim_id text not null,
                    source_type text not null default 'repo',
                    path text not null default '',
                    snippet text not null default '',
                    line_start integer,
                    line_end integer,
                    retrieval_method text not null default 'fallback_search',
                    alignment_confidence real not null default 0.5
                );

                create table if not exists chat_conversations (
                    id text primary key,
                    title text not null default '',
                    created_at text not null,
                    updated_at text not null
                );

                create table if not exists chat_messages (
                    id integer primary key autoincrement,
                    conversation_id text not null,
                    seq integer not null,
                    role text not null,
                    content_json text not null,
                    created_at text not null
                );
                """
            )

    def create_audit(self, request: AuditRequest) -> str:
        audit_id = "aud_" + secrets.token_hex(8)
        now = utc_now()
        with self.connect() as conn:
            conn.execute(
                """
                insert into audits (
                    audit_id, status, stage, paper_url, repo_url, question, sender,
                    thread_id, message_id, subject, body, created_at, updated_at
                ) values (?, 'queued', 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    audit_id,
                    request.paper_url,
                    request.repo_url,
                    request.question,
                    request.sender,
                    request.thread_id,
                    request.message_id,
                    request.subject,
                    request.body,
                    now,
                    now,
                ),
            )
            if request.message_id:
                conn.execute(
                    "insert or ignore into messages (message_id, audit_id, thread_id, created_at) values (?, ?, ?, ?)",
                    (request.message_id, audit_id, request.thread_id, now),
                )
        self.add_event(audit_id, "queued", "Audit queued.")
        return audit_id

    def message_seen(self, message_id: str) -> bool:
        if not message_id:
            return False
        with self.connect() as conn:
            row = conn.execute("select 1 from messages where message_id = ?", (message_id,)).fetchone()
        return row is not None

    def add_event(self, audit_id: str, stage: str, message: str) -> None:
        now = utc_now()
        with self.connect() as conn:
            conn.execute(
                "insert into audit_events (audit_id, stage, message, created_at) values (?, ?, ?, ?)",
                (audit_id, stage, message, now),
            )
            conn.execute(
                "update audits set stage = ?, updated_at = ? where audit_id = ?",
                (stage, now, audit_id),
            )

    def set_status(self, audit_id: str, status: str, stage: str | None = None) -> None:
        now = utc_now()
        with self.connect() as conn:
            conn.execute(
                "update audits set status = ?, stage = coalesce(?, stage), updated_at = ? where audit_id = ?",
                (status, stage, now, audit_id),
            )

    def save_claims(self, audit_id: str, claims: list[dict[str, Any]]) -> None:
        with self.connect() as conn:
            conn.execute("delete from claims where audit_id = ?", (audit_id,))
            for claim in claims:
                conn.execute(
                    """
                    insert into claims (
                        audit_id, claim_id, claim_text, claim_type, expected_key, expected_value
                    ) values (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        audit_id,
                        claim["claim_id"],
                        claim["claim_text"],
                        claim["claim_type"],
                        claim.get("expected_key", ""),
                        str(claim.get("expected_value", "")),
                    ),
                )

    def save_verdicts(self, audit_id: str, verdicts: list[dict[str, Any]]) -> None:
        with self.connect() as conn:
            conn.execute("delete from evidence where audit_id = ?", (audit_id,))
            for verdict in verdicts:
                conn.execute(
                    """
                    update claims
                    set verdict = ?, severity = ?, reason = ?, evidence_json = ?
                    where audit_id = ? and claim_id = ?
                    """,
                    (
                        verdict["verdict"],
                        verdict["severity"],
                        verdict["reason"],
                        json.dumps(verdict.get("evidence", [])),
                        audit_id,
                        verdict["claim_id"],
                    ),
                )
                for item in verdict.get("evidence", []) or []:
                    conn.execute(
                        """
                        insert into evidence (
                            audit_id, claim_id, source_type, path, snippet,
                            line_start, line_end, retrieval_method, alignment_confidence
                        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            audit_id,
                            verdict["claim_id"],
                            item.get("source_type", "repo"),
                            item.get("path", ""),
                            item.get("snippet", ""),
                            item.get("line_start"),
                            item.get("line_end"),
                            item.get("retrieval_method", "fallback_search"),
                            float(item.get("alignment_confidence") or 0.5),
                        ),
                    )

    def save_report(self, audit_id: str, score: int, report_text: str) -> None:
        now = utc_now()
        with self.connect() as conn:
            conn.execute(
                "update audits set score = ?, report_text = ?, updated_at = ? where audit_id = ?",
                (score, report_text, now, audit_id),
            )

    def list_audits(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute("select * from audits order by created_at desc").fetchall()
        return [dict(row) for row in rows]

    def get_audit(self, audit_id: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            audit = conn.execute("select * from audits where audit_id = ?", (audit_id,)).fetchone()
            if audit is None:
                return None
            claims = conn.execute(
                "select * from claims where audit_id = ? order by claim_id",
                (audit_id,),
            ).fetchall()
            events = conn.execute(
                "select * from audit_events where audit_id = ? order by id",
                (audit_id,),
            ).fetchall()
        data = dict(audit)
        data["claims"] = [self._claim_row_to_dict(row) for row in claims]
        data["events"] = [dict(row) for row in events]
        return data

    def get_claim(self, audit_id: str, claim_id: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                "select * from claims where audit_id = ? and claim_id = ?",
                (audit_id, claim_id),
            ).fetchone()
        return self._claim_row_to_dict(row) if row else None

    def get_events_after(self, audit_id: str, after_id: int) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                "select * from audit_events where audit_id = ? and id > ? order by id",
                (audit_id, after_id),
            ).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def _claim_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
        data = dict(row)
        data["evidence"] = json.loads(data.pop("evidence_json") or "[]")
        return data

    # ---- Chat ------------------------------------------------------------

    def create_conversation(self, title: str = "") -> str:
        conversation_id = "cnv_" + secrets.token_hex(8)
        now = utc_now()
        with self.connect() as conn:
            conn.execute(
                "insert into chat_conversations (id, title, created_at, updated_at) values (?, ?, ?, ?)",
                (conversation_id, title, now, now),
            )
        return conversation_id

    def get_conversation(self, conversation_id: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                "select * from chat_conversations where id = ?", (conversation_id,)
            ).fetchone()
            if row is None:
                return None
            messages = conn.execute(
                "select role, content_json, created_at, seq from chat_messages "
                "where conversation_id = ? order by seq",
                (conversation_id,),
            ).fetchall()
        return {
            **dict(row),
            "messages": [
                {
                    "role": m["role"],
                    "content": json.loads(m["content_json"]),
                    "created_at": m["created_at"],
                }
                for m in messages
            ],
        }

    def list_conversations(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                "select id, title, created_at, updated_at from chat_conversations "
                "order by updated_at desc"
            ).fetchall()
        return [dict(r) for r in rows]

    def append_chat_messages(
        self, conversation_id: str, messages: list[dict[str, Any]]
    ) -> None:
        if not messages:
            return
        now = utc_now()
        with self.connect() as conn:
            current = conn.execute(
                "select coalesce(max(seq), 0) from chat_messages where conversation_id = ?",
                (conversation_id,),
            ).fetchone()[0]
            for offset, msg in enumerate(messages, start=1):
                conn.execute(
                    "insert into chat_messages (conversation_id, seq, role, content_json, created_at) "
                    "values (?, ?, ?, ?, ?)",
                    (
                        conversation_id,
                        current + offset,
                        msg["role"],
                        json.dumps(msg["content"]),
                        now,
                    ),
                )
            conn.execute(
                "update chat_conversations set updated_at = ? where id = ?",
                (now, conversation_id),
            )

    def set_conversation_title(self, conversation_id: str, title: str) -> None:
        with self.connect() as conn:
            conn.execute(
                "update chat_conversations set title = ? where id = ? and (title is null or title = '')",
                (title, conversation_id),
            )

