from __future__ import annotations

"""
Lightweight JSONL query logger (E9).
Writes to backend/logs/queries.jsonl — rotate or ship this file for analytics.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

_LOG_DIR = Path(__file__).resolve().parent / "logs"
_QUERY_LOG = _LOG_DIR / "queries.jsonl"
_FEEDBACK_LOG = _LOG_DIR / "feedback.jsonl"
_lock = Lock()


def _write(path: Path, entry: dict) -> None:
    with _lock:
        _LOG_DIR.mkdir(exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def log_query(
    *,
    message: str,
    intent_tag: str | None,
    confidence: float | None,
    response: str,
    session_id: str | None = None,
) -> None:
    _write(
        _QUERY_LOG,
        {
            "ts": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
            "session_id": session_id,
            "message": message,
            "intent_tag": intent_tag,
            "confidence": round(confidence, 4) if confidence is not None else None,
            "response_len": len(response),
        },
    )


def log_feedback(*, message_id: str, rating: str, session_id: str | None = None) -> None:
    _write(
        _FEEDBACK_LOG,
        {
            "ts": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
            "message_id": message_id,
            "rating": rating,
            "session_id": session_id,
        },
    )
