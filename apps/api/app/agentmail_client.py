from __future__ import annotations

from typing import Any

import httpx


AGENTMAIL_BASE_URL = "https://api.agentmail.to/v0"


class AgentMailClient:
    def __init__(self, api_key: str, inbox_id: str = "", base_url: str = AGENTMAIL_BASE_URL):
        self.api_key = api_key
        self.inbox_id = inbox_id
        self.base_url = base_url.rstrip("/")

    async def reply_to_thread(
        self,
        thread_id: str,
        text: str,
        subject: str = "",
        message_id: str = "",
    ) -> dict[str, Any]:
        if not self.api_key:
            return {"sent": False, "reason": "missing_api_key"}
        if not self.inbox_id:
            return {"sent": False, "reason": "missing_inbox_id"}
        if not thread_id:
            return {"sent": False, "reason": "missing_thread_id"}

        body: dict[str, Any] = {"text": text}
        if subject:
            body["subject"] = subject
        if message_id:
            body["in_reply_to"] = message_id

        url = f"{self.base_url}/inboxes/{self.inbox_id}/threads/{thread_id}/messages"
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
        except httpx.HTTPError as exc:
            return {"sent": False, "reason": "transport_error", "detail": str(exc)}

        if response.status_code >= 400:
            return {
                "sent": False,
                "reason": "http_error",
                "status": response.status_code,
                "detail": response.text[:500],
            }
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        return {"sent": True, "status": response.status_code, "response": payload}

    async def send_message(self, to: str, subject: str, text: str) -> dict[str, Any]:
        if not self.api_key:
            return {"sent": False, "reason": "missing_api_key"}
        if not self.inbox_id:
            return {"sent": False, "reason": "missing_inbox_id"}
        if not to:
            return {"sent": False, "reason": "missing_recipient"}

        url = f"{self.base_url}/inboxes/{self.inbox_id}/messages/send"
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={"to": to, "subject": subject, "text": text},
                )
        except httpx.HTTPError as exc:
            return {"sent": False, "reason": "transport_error", "detail": str(exc)}

        if response.status_code >= 400:
            return {
                "sent": False,
                "reason": "http_error",
                "status": response.status_code,
                "detail": response.text[:500],
            }
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        return {"sent": True, "status": response.status_code, "response": payload}

    async def healthcheck(self) -> bool:
        if not self.api_key:
            return False
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{self.base_url}/inboxes",
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
        return response.status_code < 500
