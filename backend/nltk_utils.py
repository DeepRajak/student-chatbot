import numpy as np
import nltk
from nltk.stem import WordNetLemmatizer
from threading import Lock

_REQUIRED_NLTK_RESOURCES = (
    ('tokenizers/punkt', 'punkt'),
    ('corpora/wordnet', 'wordnet'),
)

lemmatizer = WordNetLemmatizer()
_NLTK_READY = False
_NLTK_LOCK = Lock()


def ensure_nltk_data(allow_download=False):
    global _NLTK_READY

    with _NLTK_LOCK:
        if _NLTK_READY:
            return True

        missing_resources = []

        for lookup_name, download_name in _REQUIRED_NLTK_RESOURCES:
            try:
                nltk.data.find(lookup_name)
            except LookupError:
                missing_resources.append(download_name)

        if not missing_resources:
            _NLTK_READY = True
            return True

        if allow_download:
            for resource_name in missing_resources:
                nltk.download(resource_name, quiet=True)
            _NLTK_READY = True
            return True

        raise RuntimeError(
            'Missing NLTK data: ' + ', '.join(missing_resources) + '. Install the resources during setup instead of downloading at import time.'
        )

def tokenize(sentence):
    """Split sentence into array of words/tokens"""
    if not isinstance(sentence, str):
        return []
    return nltk.word_tokenize(sentence.lower())

def lemmatize(word):
    """Find the base form of the word"""
    if not isinstance(word, str):
        return ""
    return lemmatizer.lemmatize(word.lower())

def bag_of_words(tokenized_sentence, words):
    """Return bag of words array"""
    if not tokenized_sentence or not words:
        return np.zeros(len(words) if words else 0, dtype=np.float32)

    sentence_words = [lemmatize(word) for word in tokenized_sentence]
    bag = np.zeros(len(words), dtype=np.float32)

    word_to_index = {word: index for index, word in enumerate(words)}
    for word in set(sentence_words):
        index = word_to_index.get(word)
        if index is not None:
            bag[index] = 1.0

    return bag