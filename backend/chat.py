from __future__ import annotations

import json
import random
import re
import threading
from functools import lru_cache
from pathlib import Path

import torch

from model import NeuralNet
from nltk_utils import bag_of_words, tokenize, ensure_nltk_data

# Optional integrations — loaded lazily so Flask starts even if they fail
_query_logger = None
_context_store = None
_semantic_enhancer = None


def _try_import_optional() -> None:
    global _query_logger, _context_store, _semantic_enhancer
    try:
        import query_logger as _ql
        _query_logger = _ql
    except ImportError:
        pass
    try:
        import context_store as _cs
        _context_store = _cs
    except ImportError:
        pass
    try:
        import semantic_enhancer as _se
        _semantic_enhancer = _se
    except ImportError:
        pass


class ChatBot:
    # Class-level constant — not rebuilt on every call
    _KEYWORD_ROUTES = (
        (("admission", "eligibility"), "admissions"),
        (("admission",), "admissions"),
        (("exam", "date"), "exam_dates"),
        (("exam", "schedule"), "exam_dates"),
        (("campus", "support"), "campus_help"),
        (("campus", "service"), "campus_help"),
        (("office", "hour"), "office_hours"),
        (("contact", "detail"), "office_hours"),
    )

    # Shown when ML confidence is below threshold (E4 — confidence fallback)
    _FALLBACK_RESPONSE = (
        "I'm not sure I understood that. You can ask me about:\n"
        "- **Admissions** — eligibility, deadlines, process\n"
        "- **Exams** — dates, schedules, results\n"
        "- **Campus** — departments, facilities, contacts\n"
        "- **Courses** — programs, syllabus, faculty\n\n"
        "Try rephrasing, or tap one of the quick-prompt buttons!"
    )

    def __init__(self):
        ensure_nltk_data()
        self.intents = self.load_intents()
        self.model, self.all_words, self.tags, self.device = self.initialize_model()
        self.word_to_index = {word: idx for idx, word in enumerate(self.all_words)}
        self.responses_by_tag = {
            intent["tag"]: intent["responses"]
            for intent in self.intents["intents"]
        }
        self.direct_routes = {
            self.normalize_text("What are the upcoming exam dates?"): "exam_dates",
            self.normalize_text("Tell me about admissions and eligibility."): "admissions",
            self.normalize_text("How do I find campus services and support?"): "campus_help",
            self.normalize_text("Share office hours and contact details."): "office_hours",
        }

        if _semantic_enhancer is not None:
            try:
                _semantic_enhancer.build_index(self.intents)
            except Exception:
                pass  # Optional — non-fatal

    # ------------------------------------------------------------------
    # Data loading
    # ------------------------------------------------------------------

    def load_intents(self) -> dict:
        intents_path = Path(__file__).resolve().parent / "intents.json"
        if not intents_path.exists():
            raise RuntimeError("intents.json is missing.")

        with intents_path.open("r", encoding="utf-8") as f:
            intents = json.load(f)

        if "intents" not in intents or not isinstance(intents["intents"], list):
            raise RuntimeError('intents.json must contain an "intents" list.')

        for intent in intents["intents"]:
            tag = intent.get("tag", "<unknown>")

            # B5: validate patterns
            patterns = intent.get("patterns", [])
            if not isinstance(patterns, list):
                raise RuntimeError(f"Intent '{tag}' has invalid patterns; expected a list.")
            if not patterns:
                raise RuntimeError(f"Intent '{tag}' has an empty patterns list.")

            responses = intent.get("responses", [])
            if not isinstance(responses, list):
                raise RuntimeError(f"Intent '{tag}' has invalid responses; expected a list.")
            if not responses:
                raise RuntimeError(f"Intent '{tag}' has an empty responses list.")
            for response in responses:
                if not isinstance(response, str):
                    raise RuntimeError(f"Intent '{tag}' contains a non-string response.")

        return intents

    def initialize_model(self):
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        file_path = Path(__file__).resolve().parent / "data.pth"

        if not file_path.exists():
            raise RuntimeError("data.pth is missing. Run train.py before starting the chatbot.")

        data = torch.load(file_path, map_location=device, weights_only=True)

        required_keys = {"input_size", "hidden_size", "output_size", "all_words", "tags", "model_state"}
        missing = required_keys.difference(data)
        if missing:
            raise RuntimeError(f"data.pth missing keys: {', '.join(sorted(missing))}")

        model = NeuralNet(data["input_size"], data["hidden_size"], data["output_size"]).to(device)
        model.load_state_dict(data["model_state"])
        model.eval()

        return model, data["all_words"], data["tags"], device

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def normalize_text(self, text: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", "", text.lower())).strip()

    def get_direct_response(self, sentence: str):
        normalized = self.normalize_text(sentence)

        for route_text, tag in self.direct_routes.items():
            if normalized == route_text:
                responses = self.responses_by_tag.get(tag)
                if responses:
                    return random.choice(responses)

        words_set = set(normalized.split())
        for keywords, tag in self._KEYWORD_ROUTES:
            if all(kw in words_set for kw in keywords):
                responses = self.responses_by_tag.get(tag)
                if responses:
                    return random.choice(responses)

        return None

    @lru_cache(maxsize=256)
    def _run_inference(self, sentence: str):
        """Pure ML forward pass — cached to skip repeated computation (P2)."""
        sentence_tokens = tokenize(sentence)
        X = bag_of_words(sentence_tokens, self.all_words, word_to_index=self.word_to_index)
        X = X.reshape(1, X.shape[0])
        X = torch.from_numpy(X).to(self.device)

        with torch.inference_mode():
            output = self.model(X)
            predicted_idx = torch.argmax(output, dim=1).item()
            tag = self.tags[predicted_idx]
            # P3: softmax computed only once, after argmax
            prob = torch.softmax(output, dim=1)[0][predicted_idx].item()

        return tag, prob

    def get_response(self, sentence: str, session_id: str | None = None) -> str:
        # 1. Exact / keyword direct routes
        direct = self.get_direct_response(sentence)
        if direct:
            self._record(sentence, "direct_route", 1.0, direct, session_id)
            return direct

        # 2. Optional semantic similarity layer (E13)
        if _semantic_enhancer is not None:
            try:
                sem_resp, sem_tag, sem_conf = _semantic_enhancer.query(sentence)
                if sem_resp:
                    self._record(sentence, sem_tag, sem_conf, sem_resp, session_id)
                    return sem_resp
            except Exception:
                pass

        # 3. Bag-of-words ML inference
        tag, prob = self._run_inference(sentence)

        if prob > 0.75:
            responses = self.responses_by_tag.get(tag)
            if responses:
                response = random.choice(responses)
                self._record(sentence, tag, prob, response, session_id)
                return response

        # 4. E4: Confidence fallback — helpful suggestions instead of generic "I don't understand"
        self._record(sentence, None, prob, self._FALLBACK_RESPONSE, session_id)
        return self._FALLBACK_RESPONSE

    def _record(self, message: str, tag, confidence, response: str, session_id) -> None:
        """Fire-and-forget: log query + update context. Never raises."""
        if _query_logger:
            try:
                _query_logger.log_query(
                    message=message,
                    intent_tag=tag,
                    confidence=confidence,
                    response=response,
                    session_id=session_id,
                )
            except Exception:
                pass
        if _context_store and session_id:
            try:
                _context_store.add_to_context(session_id, message, response)
            except Exception:
                pass


# ------------------------------------------------------------------
# Public API — lazy singleton
# ------------------------------------------------------------------

_chatbot: ChatBot | None = None
_chatbot_lock = threading.Lock()


def _get_chatbot() -> ChatBot:
    global _chatbot
    if _chatbot is None:
        with _chatbot_lock:
            if _chatbot is None:
                _try_import_optional()
                _chatbot = ChatBot()
    return _chatbot


def get_response(message: str, session_id: str | None = None) -> str:
    if not message or not message.strip():
        return "Please provide a message."
    return _get_chatbot().get_response(message.strip(), session_id=session_id)
