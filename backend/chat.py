import random
import json
import re
from pathlib import Path
import torch
from model import NeuralNet
from nltk_utils import bag_of_words, tokenize, ensure_nltk_data

class ChatBot:
    def __init__(self):
        ensure_nltk_data()
        self.intents = self.load_intents()
        self.model, self.all_words, self.tags, self.device = self.initialize_model()
        self.word_to_index = {word: index for index, word in enumerate(self.all_words)}
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
            responses = intent.get('responses', [])
            if not isinstance(responses, list):
                raise RuntimeError(f"Intent '{intent.get('tag', '<unknown>')}' has invalid responses; expected a list.")
            for response in responses:
                if not isinstance(response, str):
                    raise RuntimeError(f"Intent '{intent.get('tag', '<unknown>')}' contains a non-string response.")

        return intents

    def initialize_model(self):
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        file_path = Path(__file__).resolve().parent / 'data.pth'

        if not file_path.exists():
            raise RuntimeError('data.pth is missing. Run train.py before starting the chatbot.')

        data = torch.load(file_path, map_location=device)

        required_keys = {'input_size', 'hidden_size', 'output_size', 'all_words', 'tags', 'model_state'}
        missing_keys = required_keys.difference(data)
        if missing_keys:
            raise RuntimeError(f'data.pth is missing required keys: {", ".join(sorted(missing_keys))}')

        input_size = data['input_size']
        hidden_size = data['hidden_size']
        output_size = data['output_size']
        all_words = data['all_words']
        tags = data['tags']
        model_state = data['model_state']

        model = NeuralNet(input_size, hidden_size, output_size).to(device)
        model.load_state_dict(model_state)
        model.eval()

        return model, all_words, tags, device

    def normalize_text(self, text):
        return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", "", text.lower())).strip()

    def get_direct_response(self, sentence):
        normalized_sentence = self.normalize_text(sentence)

        for route_text, tag in self.direct_routes.items():
            if normalized_sentence == route_text:
                for intent in self.intents['intents']:
                    if intent.get('tag') == tag:
                        return random.choice(intent['responses'])

        keyword_routes = (
            (("admission", "eligibility"), "admissions"),
            (("admission",), "admissions"),
            (("exam", "date"), "exam_dates"),
            (("exam", "schedule"), "exam_dates"),
            (("campus", "support"), "campus_help"),
            (("campus", "service"), "campus_help"),
            (("office", "hour"), "office_hours"),
            (("contact", "detail"), "office_hours"),
        )

        for keywords, tag in keyword_routes:
            if all(keyword in normalized_sentence for keyword in keywords):
                for intent in self.intents['intents']:
                    if intent.get('tag') == tag:
                        return random.choice(intent['responses'])

        return None

    def get_response(self, sentence):
        if not self.model or not self.intents:
            return "System is not properly initialized."

        direct_response = self.get_direct_response(sentence)
        if direct_response:
            return direct_response

        sentence_tokens = tokenize(sentence)
        X = bag_of_words(sentence_tokens, self.all_words)
        X = X.reshape(1, X.shape[0])
        X = torch.from_numpy(X).to(self.device)

        with torch.inference_mode():
            output = self.model(X)
            _, predicted = torch.max(output, dim=1)
            tag = self.tags[predicted.item()]

            probs = torch.softmax(output, dim=1)
            prob = probs[0][predicted.item()]

        if prob.item() > 0.75:
            for intent in self.intents['intents']:
                if tag == intent['tag']:
                    return random.choice(intent['responses'])

        return "I apologize, but I don't quite understand. Could you please rephrase that?"

chatbot = ChatBot()

def get_response(message):
    if not message or not message.strip():
        return "Please provide a message."
    
    return chatbot.get_response(message.strip())