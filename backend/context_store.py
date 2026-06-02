from __future__ import annotations

"""
Session-based conversation context store (E2).
In-memory; resets on server restart. Replace with Redis for persistence.
"""
from collections import defaultdict, deque
from threading import Lock

_store: dict = defaultdict(lambda: deque(maxlen=5))
_lock = Lock()


def get_context(session_id: str) -> list:
    with _lock:
        return list(_store[session_id])


def add_to_context(session_id: str, user_msg: str, bot_msg: str) -> None:
    with _lock:
        _store[session_id].append({"user": user_msg, "bot": bot_msg})


def clear_context(session_id: str) -> None:
    with _lock:
        _store.pop(session_id, None)
