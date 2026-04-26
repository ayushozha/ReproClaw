from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import json
import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def load_dotenv(path: Path | None = None) -> None:
    env_path = path or PROJECT_ROOT / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def _path_from_database_url(database_url: str) -> Path:
    if database_url.startswith("sqlite:///"):
        raw_path = database_url.removeprefix("sqlite:///")
        path = Path(raw_path)
        return path if path.is_absolute() else PROJECT_ROOT / path
    return PROJECT_ROOT / "reproclaw.db"


def _csv_list(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _nia_manifest_source_ids() -> list[str]:
    manifest_path = PROJECT_ROOT / "nia.json"
    if not manifest_path.exists():
        return []
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []

    ids: list[str] = []
    for key in ("sources", "vaults", "local"):
        entries = manifest.get(key, [])
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if isinstance(entry, str):
                source_id = entry
            elif isinstance(entry, dict):
                source_id = str(entry.get("id") or entry.get("identifier") or "")
            else:
                source_id = ""
            if source_id and source_id not in ids:
                ids.append(source_id)
    return ids


@dataclass(frozen=True)
class Settings:
    agentmail_api_key: str
    agentmail_inbox_id: str
    agentmail_webhook_secret: str
    nia_api_key: str
    nia_project_id: str
    nia_source_ids: list[str]
    anthropic_api_key: str
    database_url: str
    database_path: Path
    repo_cache_dir: Path
    pdf_cache_dir: Path
    public_app_url: str
    api_base_url: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    load_dotenv()
    database_url = os.getenv("DATABASE_URL", "sqlite:///./reproclaw.db")
    return Settings(
        agentmail_api_key=os.getenv("AGENTMAIL_API_KEY", ""),
        agentmail_inbox_id=os.getenv("AGENTMAIL_INBOX_ID", ""),
        agentmail_webhook_secret=os.getenv("AGENTMAIL_WEBHOOK_SECRET", ""),
        nia_api_key=os.getenv("NIA_API_KEY", ""),
        nia_project_id=os.getenv("NIA_PROJECT_ID", ""),
        nia_source_ids=_csv_list(os.getenv("NIA_SOURCE_IDS", "")) or _nia_manifest_source_ids(),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        database_url=database_url,
        database_path=_path_from_database_url(database_url),
        repo_cache_dir=PROJECT_ROOT / os.getenv("REPO_CACHE_DIR", ".cache/repos"),
        pdf_cache_dir=PROJECT_ROOT / os.getenv("PDF_CACHE_DIR", ".cache/papers"),
        public_app_url=os.getenv("PUBLIC_APP_URL", ""),
        api_base_url=os.getenv("API_BASE_URL", "http://localhost:8000"),
    )
