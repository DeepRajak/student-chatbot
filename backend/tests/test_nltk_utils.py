"""Tests for nltk_utils.py."""
import numpy as np
import pytest
from unittest.mock import patch

from nltk_utils import lemmatize, bag_of_words, tokenize


class TestLemmatize:
    def test_basic_word(self):
        assert isinstance(lemmatize("running"), str)

    def test_empty_string(self):
        assert lemmatize("") == ""  # empty string returns empty

    def test_non_string_returns_empty(self):
        assert lemmatize(None) == ""

    def test_lowercase(self):
        result = lemmatize("CATS")
        assert result == result.lower()

    def test_cache_works(self):
        # Same call twice should return same result (cache hit)
        r1 = lemmatize("studies")
        r2 = lemmatize("studies")
        assert r1 == r2


class TestBagOfWords:
    VOCAB = ["hello", "hi", "exam", "date", "admission"]

    def test_known_word_sets_flag(self):
        bow = bag_of_words(["hello"], self.VOCAB)
        assert bow[0] == 1.0

    def test_unknown_word_leaves_zero(self):
        bow = bag_of_words(["xyz"], self.VOCAB)
        assert bow.sum() == 0.0

    def test_correct_length(self):
        bow = bag_of_words(["hello", "hi"], self.VOCAB)
        assert len(bow) == len(self.VOCAB)

    def test_empty_sentence(self):
        bow = bag_of_words([], self.VOCAB)
        assert all(v == 0.0 for v in bow)

    def test_empty_vocab(self):
        bow = bag_of_words(["hello"], [])
        assert len(bow) == 0

    def test_prebuilt_word_to_index(self):
        word_to_index = {w: i for i, w in enumerate(self.VOCAB)}
        bow_prebuilt = bag_of_words(["hello"], self.VOCAB, word_to_index=word_to_index)
        bow_computed = bag_of_words(["hello"], self.VOCAB)
        np.testing.assert_array_equal(bow_prebuilt, bow_computed)

    def test_float32_dtype(self):
        bow = bag_of_words(["hello"], self.VOCAB)
        assert bow.dtype == np.float32


class TestTokenize:
    def test_splits_sentence(self):
        tokens = tokenize("Hello world")
        assert len(tokens) >= 2

    def test_lowercases(self):
        tokens = tokenize("HELLO")
        assert all(t == t.lower() for t in tokens)

    def test_non_string_returns_empty(self):
        assert tokenize(None) == []

    def test_empty_string(self):
        assert tokenize("") == []
