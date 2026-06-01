from flask import Flask, request, jsonify
from flask_cors import CORS
from chat import get_response

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["POST"],
        "allow_headers": ["Content-Type"]
    }
})

@app.route('/api/chat', methods=['POST'])
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
        
        return jsonify({
            'response': response,
            'success': True
        })
        
    except Exception as e:
        app.logger.exception('Error in chat endpoint')
        return jsonify({
            'error': 'Internal server error',
            'message': 'An internal error occurred while processing the request.'
        }), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(debug=False, port=5000)