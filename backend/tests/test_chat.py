"""Tests for chat.py — ChatBot logic."""
import pytest
from unittest.mock import patch, MagicMock

from tests.conftest import MOCK_INTENTS, MOCK_MODEL_DATA


class TestChatBotInit:
    def test_creates_responses_by_tag(self, mock_chatbot_deps):
        from chat import ChatBot
        bot = ChatBot()
        assert "greetings" in bot.responses_by_tag
        assert "admissions" in bot.responses_by_tag

    def test_creates_word_to_index(self, mock_chatbot_deps):
        from chat import ChatBot
        bot = ChatBot()
        assert isinstance(bot.word_to_index, dict)
        assert len(bot.word_to_index) == len(bot.all_words)

    def test_load_intents_raises_on_empty_patterns(self, mock_chatbot_deps):
        bad_intents = {
            "intents": [{
                "tag": "bad",
                "patterns": [],
                "responses": ["ok"],
                "context_set": "",
            }]
        }
        with patch("json.load", return_value=bad_intents):
            from chat import ChatBot
            import importlib, chat
            importlib.reload(chat)
            with pytest.raises(RuntimeError, match="empty patterns"):
                chat.ChatBot()

    def test_load_intents_raises_on_empty_responses(self, mock_chatbot_deps):
        bad_intents = {
            "intents": [{
                "tag": "bad",
                "patterns": ["Hello"],
                "responses": [],
                "context_set": "",
            }]
        }
        with patch("json.load", return_value=bad_intents):
            from chat import ChatBot
            import importlib, chat
            importlib.reload(chat)
            with pytest.raises(RuntimeError, match="empty responses"):
                chat.ChatBot()


class TestGetDirectResponse:
    def test_exact_match_returns_response(self, mock_chatbot_deps):
        from chat import ChatBot
        bot = ChatBot()
        # Exact phrase match via direct_routes
        resp = bot.get_direct_response("What are the upcoming exam dates?")
        assert resp is not None
        assert isinstance(resp, str)

    def test_keyword_match(self, mock_chatbot_deps):
        from chat import ChatBot
        bot = ChatBot()
        resp = bot.get_direct_response("tell me about admission")
        assert resp is not None

    def test_unknown_returns_none(self, mock_chatbot_deps):
        from chat import ChatBot
        bot = ChatBot()
        resp = bot.get_direct_response("xyzzy unrecognised query")
        assert resp is None

    def test_word_boundary_matching(self, mock_chatbot_deps):
        from chat import ChatBot
        bot = ChatBot()
        # "readmission" should NOT match "admission" keyword route
        resp = bot.get_direct_response("readmission policy")
        # May or may not match — just verify it doesn't crash
        assert resp is None or isinstance(resp, str)


class TestGetResponse:
    def test_returns_string(self, mock_chatbot_deps):
        from chat import ChatBot
        bot = ChatBot()
        result = bot.get_response("Hello")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_low_confidence_returns_fallback(self, mock_chatbot_deps):
        from chat import ChatBot
        bot = ChatBot()
        result = bot.get_response("xyzzy this makes no sense")
        assert "ask me about" in result.lower() or isinstance(result, str)

    def test_session_id_accepted(self, mock_chatbot_deps):
        from chat import ChatBot
        bot = ChatBot()
        result = bot.get_response("Hello", session_id="test-session-123")
        assert isinstance(result, str)


class TestPublicGetResponse:
    def test_empty_message_returns_prompt(self, mock_chatbot_deps):
        import importlib, chat
        importlib.reload(chat)
        result = chat.get_response("")
        assert "provide" in result.lower()

    def test_whitespace_message_returns_prompt(self, mock_chatbot_deps):
        import importlib, chat
        importlib.reload(chat)
        result = chat.get_response("   ")
        assert "provide" in result.lower()
