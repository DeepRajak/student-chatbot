import logging
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from chat import get_response

logging.basicConfig(
    level=logging.ERROR,
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024

# Set ALLOWED_ORIGINS env var for production (comma-separated)
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")]
CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["POST"],
        "allow_headers": ["Content-Type"],
    }
})

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "20 per minute"],
    storage_uri="memory://",
)


@app.route('/api/chat', methods=['POST'])
@limiter.limit("20 per minute")
def chat():
    try:
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400

        data = request.get_json(silent=True) or {}
        raw_message = data.get('message', '')

        if not isinstance(raw_message, str):
            return jsonify({'error': 'Message must be a string'}), 400

        message = raw_message.strip()

        if not message:
            return jsonify({'error': 'No message provided'}), 400
        if len(message) > 2000:
            return jsonify({'error': 'Message is too long'}), 400

        response = get_response(message)

        return jsonify({'response': response, 'success': True})

    except Exception:
        app.logger.exception('Error in chat endpoint')
        return jsonify({
            'error': 'Internal server error',
            'message': 'An internal error occurred while processing the request.',
        }), 500


@app.route('/health', methods=['GET'])
def health():
    try:
        from chat import _get_chatbot
        _get_chatbot()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        app.logger.error('Health check failed: %s', e)
        return jsonify({'status': 'error', 'detail': str(e)}), 503


if __name__ == '__main__':
    app.run(debug=False, port=5000)
