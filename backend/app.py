import json
import logging
import os
from dotenv import load_dotenv
from flask import Flask, Response, request, jsonify

load_dotenv()
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from chat import get_response

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "ERROR")),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024  # 1 MB

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")]
CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type"],
    }
})

RATELIMIT_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "20 per minute"],
    storage_uri=RATELIMIT_URI,
    storage_options={"socket_connect_timeout": 2, "socket_timeout": 2},
)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _parse_json_body():
    """B9: parse request JSON strictly; return (data, error_response)."""
    try:
        data = request.get_json(silent=False)
    except Exception:
        return None, jsonify({"error": "Invalid JSON"}), 400
    if data is None:
        data = {}
    return data, None, None


def _validate_message(data):
    raw = data.get("message", "")
    if not isinstance(raw, str):
        return None, jsonify({"error": "Message must be a string"}), 400
    message = raw.strip()
    if not message:
        return None, jsonify({"error": "No message provided"}), 400
    if len(message) > 2000:
        return None, jsonify({"error": "Message is too long (max 2000 chars)"}), 400
    return message, None, None


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------

@app.route("/api/chat", methods=["POST"])
@limiter.limit("20 per minute")
def chat():
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400

        data, err, code = _parse_json_body()
        if err:
            return err, code

        message, err, code = _validate_message(data)
        if err:
            return err, code

        session_id = data.get("session_id")
        response = get_response(message, session_id=session_id)
        return jsonify({"response": response, "success": True})

    except Exception:
        app.logger.exception("Error in /api/chat")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/chat/stream", methods=["POST"])
@limiter.limit("20 per minute")
def chat_stream():
    """E3: SSE streaming endpoint — sends response word-by-word."""
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400

        data, err, code = _parse_json_body()
        if err:
            return err, code

        message, err, code = _validate_message(data)
        if err:
            return err, code

        session_id = data.get("session_id")
        response_text = get_response(message, session_id=session_id)

        def generate():
            words = response_text.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"

        return Response(
            generate(),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    except Exception:
        app.logger.exception("Error in /api/chat/stream")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/feedback", methods=["POST"])
def feedback():
    """E15: Accept thumbs-up/down on bot responses."""
    try:
        data = request.get_json(silent=True) or {}
        rating = data.get("rating")
        if rating not in ("up", "down"):
            return jsonify({"error": "rating must be 'up' or 'down'"}), 400

        try:
            from query_logger import log_feedback
            log_feedback(
                message_id=str(data.get("message_id", "")),
                rating=rating,
                session_id=data.get("session_id"),
            )
        except Exception:
            pass  # Logging is optional — never fail the request

        return jsonify({"success": True})

    except Exception:
        app.logger.exception("Error in /api/feedback")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/health", methods=["GET"])
def health():
    """P7: triggers lazy init on first call — also serves as model warmup."""
    try:
        from chat import _get_chatbot
        _get_chatbot()
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        app.logger.error("Health check failed: %s", e)
        return jsonify({"status": "error", "detail": str(e)}), 503


# ------------------------------------------------------------------
# Dev server entrypoint (use gunicorn in production)
# ------------------------------------------------------------------
if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_PORT", 5000))
    app.run(debug=False, host=host, port=port)
