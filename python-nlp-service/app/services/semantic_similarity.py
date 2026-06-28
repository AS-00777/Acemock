import math
import os
import re
from collections import Counter
from pathlib import Path

MODEL_NAME = "all-MiniLM-L6-v2"
_model = None
_model_failed = False


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}", text.lower())


def _fallback_similarity(a: str, b: str) -> float:
    a_counts = Counter(_tokens(a))
    b_counts = Counter(_tokens(b))
    if not a_counts or not b_counts:
        return 0.0
    common = set(a_counts) & set(b_counts)
    dot = sum(a_counts[token] * b_counts[token] for token in common)
    a_norm = math.sqrt(sum(value * value for value in a_counts.values()))
    b_norm = math.sqrt(sum(value * value for value in b_counts.values()))
    cosine = dot / max(0.0001, a_norm * b_norm)
    a_set = set(a_counts)
    b_set = set(b_counts)
    containment = len(a_set & b_set) / max(1, min(len(a_set), len(b_set)))
    return min(1.0, cosine * 0.55 + containment * 0.45)


def semantic_similarity(a: str, b: str) -> tuple[float, str]:
    global _model, _model_failed
    if not _model_failed and _model is None:
        try:
            model_path = os.getenv("MINILM_MODEL_PATH", "").strip()
            if not model_path or not Path(model_path).exists():
                raise RuntimeError("MINILM_MODEL_PATH is not configured")
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(model_path, local_files_only=True)
        except Exception:
            _model_failed = True

    if _model is not None:
        try:
            embeddings = _model.encode([a, b], normalize_embeddings=True)
            return float((embeddings[0] * embeddings[1]).sum()), MODEL_NAME
        except Exception:
            pass

    return _fallback_similarity(a, b), "local-token-cosine-fallback"
