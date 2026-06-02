import random
import json
import re
import threading
from pathlib import Path
import torch
from model import NeuralNet
from nltk_utils import bag_of_words, tokenize, ensure_nltk_data


class ChatBot:
    # Hoisted to class constant — no longer rebuilt on every get_direct_response call
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

    def __init__(self):
        ensure_nltk_data()
        self.intents = self.load_intents()
        self.model, self.all_words, self.tags, self.device = self.initialize_model()
        # Pre-built index for O(1) BoW lookup — passed directly to bag_of_words
        self.word_to_index = {word: idx for idx, word in enumerate(self.all_words)}
        # O(1) tag → responses lookup — replaces three O(n) linear scans
        self.responses_by_tag = {
            intent['tag']: intent['responses']
            for intent in self.intents['intents']
        }
        self.direct_routes = {
            self.normalize_text("What are the upcoming exam dates?"): "exam_dates",
            self.normalize_text("Tell me about admissions and eligibility."): "admissions",
            self.normalize_text("How do I find campus services and support?"): "campus_help",
            self.normalize_text("Share office hours and contact details."): "office_hours",
        }

    def load_intents(self):
        intents_path = Path(__file__).resolve().parent / 'intents.json'
        if not intents_path.exists():
            raise RuntimeError('intents.json is missing.')

        with intents_path.open('r', encoding='utf-8') as json_data:
            intents = json.load(json_data)

        if 'intents' not in intents or not isinstance(intents['intents'], list):
            raise RuntimeError('intents.json must contain an "intents" list.')

        for intent in intents['intents']:
            tag = intent.get('tag', '<unknown>')
            responses = intent.get('responses', [])
            if not isinstance(responses, list):
                raise RuntimeError(f"Intent '{tag}' has invalid responses; expected a list.")
            if not responses:
                raise RuntimeError(f"Intent '{tag}' has an empty responses list.")
            for response in responses:
                if not isinstance(response, str):
                    raise RuntimeError(f"Intent '{tag}' contains a non-string response.")

        return intents

    def initialize_model(self):
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        file_path = Path(__file__).resolve().parent / 'data.pth'

        if not file_path.exists():
            raise RuntimeError('data.pth is missing. Run train.py before starting the chatbot.')

        # weights_only=True prevents arbitrary code execution via pickle
        data = torch.load(file_path, map_location=device, weights_only=True)

        required_keys = {'input_size', 'hidden_size', 'output_size', 'all_words', 'tags', 'model_state'}
        missing_keys = required_keys.difference(data)
        if missing_keys:
            raise RuntimeError(f'data.pth is missing required keys: {", ".join(sorted(missing_keys))}')

        model = NeuralNet(data['input_size'], data['hidden_size'], data['output_size']).to(device)
        model.load_state_dict(data['model_state'])
        model.eval()

        return model, data['all_words'], data['tags'], device

    def normalize_text(self, text):
        return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", "", text.lower())).strip()

    def get_direct_response(self, sentence):
        normalized_sentence = self.normalize_text(sentence)

        for route_text, tag in self.direct_routes.items():
            if normalized_sentence == route_text:
                responses = self.responses_by_tag.get(tag)
                if responses:
                    return random.choice(responses)

        # Word-set lookup prevents substring false-matches (e.g. "readmission" matching "admission")
        words_set = set(normalized_sentence.split())
        for keywords, tag in self._KEYWORD_ROUTES:
            if all(kw in words_set for kw in keywords):
                responses = self.responses_by_tag.get(tag)
                if responses:
                    return random.choice(responses)

        return None

    def get_response(self, sentence):
        direct_response = self.get_direct_response(sentence)
        if direct_response:
            return direct_response

        sentence_tokens = tokenize(sentence)
        # Pass pre-built word_to_index — avoids rebuilding dict on every inference call
        X = bag_of_words(sentence_tokens, self.all_words, word_to_index=self.word_to_index)
        X = X.reshape(1, X.shape[0])
        X = torch.from_numpy(X).to(self.device)

        with torch.inference_mode():
            output = self.model(X)
            _, predicted = torch.max(output, dim=1)
            tag = self.tags[predicted.item()]
            probs = torch.softmax(output, dim=1)
            prob = probs[0][predicted.item()]

        if prob.item() > 0.75:
            responses = self.responses_by_tag.get(tag)
            if responses:
                return random.choice(responses)

        return "I apologize, but I don't quite understand. Could you please rephrase that?"


# Lazy singleton — avoids crashing Flask at import time if data.pth / intents.json are missing
_chatbot = None
_chatbot_lock = threading.Lock()


def _get_chatbot():
    global _chatbot
    if _chatbot is None:
        with _chatbot_lock:
            if _chatbot is None:
                _chatbot = ChatBot()
    return _chatbot


def get_response(message):
    if not message or not message.strip():
        return "Please provide a message."
    return _get_chatbot().get_response(message.strip())
