"""Shared pytest fixtures."""
import sys
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

# Make backend importable from tests/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


MOCK_INTENTS = {
    "intents": [
        {
            "tag": "greetings",
            "patterns": ["Hello", "Hi", "Hey there"],
            "responses": ["Hi! How can I help you?", "Hello! What can I do for you?"],
            "context_set": "",
        },
        {
            "tag": "admissions",
            "patterns": ["How do I apply?", "Tell me about admissions"],
            "responses": ["Admissions open in June. Visit rcciit.edu.in for details."],
            "context_set": "",
        },
        {
            "tag": "exam_dates",
            "patterns": ["When are the exams?", "What are the exam dates?"],
            "responses": ["Exam dates are published on the notice board and website."],
            "context_set": "",
        },
    ]
}

MOCK_MODEL_DATA = {
    "input_size": 5,
    "hidden_size": 8,
    "output_size": 3,
    "all_words": ["hello", "hi", "apply", "admission", "exam"],
    "tags": ["admissions", "exam_dates", "greetings"],
    "model_state": {},
}


@pytest.fixture
def mock_chatbot_deps():
    """Patch all external deps so ChatBot can be instantiated without real files."""
    import torch

    # Minimal real NeuralNet for testing
    from model import NeuralNet
    real_model = NeuralNet(
        MOCK_MODEL_DATA["input_size"],
        MOCK_MODEL_DATA["hidden_size"],
        MOCK_MODEL_DATA["output_size"],
    )
    real_model.eval()
    mock_data = dict(MOCK_MODEL_DATA)
    mock_data["model_state"] = real_model.state_dict()

    with (
        patch("chat.ensure_nltk_data"),
        patch("chat.torch.load", return_value=mock_data),
        patch("pathlib.Path.exists", return_value=True),
        patch("builtins.open", create=True),
        patch("json.load", return_value=MOCK_INTENTS),
    ):
        yield mock_data
