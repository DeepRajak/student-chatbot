"""Integration tests for Flask app routes."""
import json
import pytest
from unittest.mock import patch


@pytest.fixture
def client(mock_chatbot_deps):
    with (
        patch("chat.get_response", return_value="Test response"),
        patch("chat._get_chatbot"),
    ):
        from app import app
        app.config["TESTING"] = True
        with app.test_client() as client:
            yield client


class TestChatEndpoint:
    def test_valid_message(self, client):
        resp = client.post(
            "/api/chat",
            json={"message": "Hello"},
            content_type="application/json",
        )
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert "response" in data

    def test_empty_message_returns_400(self, client):
        resp = client.post("/api/chat", json={"message": ""})
        assert resp.status_code == 400

    def test_message_too_long_returns_400(self, client):
        resp = client.post("/api/chat", json={"message": "x" * 2001})
        assert resp.status_code == 400

    def test_non_json_returns_400(self, client):
        resp = client.post("/api/chat", data="not json", content_type="text/plain")
        assert resp.status_code == 400

    def test_missing_message_field_returns_400(self, client):
        resp = client.post("/api/chat", json={})
        assert resp.status_code == 400

    def test_non_string_message_returns_400(self, client):
        resp = client.post("/api/chat", json={"message": 42})
        assert resp.status_code == 400


class TestFeedbackEndpoint:
    def test_valid_thumbs_up(self, client):
        resp = client.post(
            "/api/feedback",
            json={"rating": "up", "message_id": "abc123"},
        )
        assert resp.status_code == 200

    def test_invalid_rating(self, client):
        resp = client.post("/api/feedback", json={"rating": "meh"})
        assert resp.status_code == 400


class TestHealthEndpoint:
    def test_health_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code in (200, 503)  # 503 if model not loaded
