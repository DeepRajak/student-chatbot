import numpy as np
import nltk
from functools import lru_cache
from nltk.stem import WordNetLemmatizer
from threading import Lock

_REQUIRED_NLTK_RESOURCES = (
    ('tokenizers/punkt_tab', 'punkt_tab'),
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
                ok = nltk.download(resource_name, quiet=True)
                if not ok:
                    raise RuntimeError(f'Failed to download NLTK resource: {resource_name}')
            _NLTK_READY = True
            return True

        raise RuntimeError(
            'Missing NLTK data: ' + ', '.join(missing_resources) +
            '. Run: python -c "import nltk; nltk.download(\'punkt_tab\'); nltk.download(\'wordnet\')"'
        )


def tokenize(sentence):
    if not isinstance(sentence, str):
        return []
    return nltk.word_tokenize(sentence.lower())


@lru_cache(maxsize=1024)
def lemmatize(word):
    if not isinstance(word, str):
        return ""
    return lemmatizer.lemmatize(word.lower())


def bag_of_words(tokenized_sentence, words, word_to_index=None):
    """Return bag of words array.

    Pass a pre-built word_to_index dict to skip rebuilding it on every call.
    """
    if not tokenized_sentence or not words:
        return np.zeros(len(words) if words else 0, dtype=np.float32)

    sentence_words = [lemmatize(w) for w in tokenized_sentence]
    bag = np.zeros(len(words), dtype=np.float32)

    if word_to_index is None:
        word_to_index = {word: index for index, word in enumerate(words)}

    for word in set(sentence_words):
        index = word_to_index.get(word)
        if index is not None:
            bag[index] = 1.0

    return bag
