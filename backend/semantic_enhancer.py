"""
Optional semantic similarity layer using sentence-transformers (E13).
Falls back gracefully when the package is not installed.

Enable by: pip install sentence-transformers
Set ENABLE_SEMANTIC=true in your .env to activate.
"""
import os
import random

try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False

_model = None
_intent_embeddings: dict = {}   # tag → mean embedding
_tag_responses: dict = {}        # tag → list[str]
_ENABLED = os.getenv("ENABLE_SEMANTIC", "false").lower() == "true"


def is_available() -> bool:
    return _AVAILABLE and _ENABLED


def build_index(intents: dict) -> None:
    """Compute and cache per-intent mean embeddings. Call once at startup."""
    global _model, _intent_embeddings, _tag_responses

    if not is_available():
        return

    _model = SentenceTransformer("all-MiniLM-L6-v2")
    _tag_responses = {i["tag"]: i["responses"] for i in intents["intents"]}

    for intent in intents["intents"]:
        patterns = intent.get("patterns", [])
        if not patterns:
            continue
        embeddings = _model.encode(patterns, show_progress_bar=False)
        _intent_embeddings[intent["tag"]] = embeddings.mean(axis=0)


def query(sentence: str, threshold: float = 0.50):
    """
    Return (response, tag, confidence) or (None, None, 0.0) when unavailable.
    Threshold tuned for RCCIIT domain — lower is more permissive.
    """
    if not is_available() or _model is None or not _intent_embeddings:
        return None, None, 0.0

    q_emb = _model.encode([sentence], show_progress_bar=False)[0]

    best_tag, best_score = None, 0.0
    for tag, emb in _intent_embeddings.items():
        score = float(
            np.dot(q_emb, emb) / (np.linalg.norm(q_emb) * np.linalg.norm(emb) + 1e-10)
        )
        if score > best_score:
            best_score = score
            best_tag = tag

    if best_score >= threshold and best_tag and best_tag in _tag_responses:
        return random.choice(_tag_responses[best_tag]), best_tag, best_score

    return None, None, best_score
