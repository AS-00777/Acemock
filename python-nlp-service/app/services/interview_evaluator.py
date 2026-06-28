import re

from app.schemas import LocalInterviewEvaluationRequest, LocalInterviewEvaluationResponse


def _tokens(value: str) -> set[str]:
    return {token for token in re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}", value.lower())}


def evaluate_local(payload: LocalInterviewEvaluationRequest) -> LocalInterviewEvaluationResponse:
    answer_tokens = _tokens(payload.answer)
    concept_source = payload.keyConcepts or list(_tokens(payload.expectedAnswer or ""))
    normalized_concepts = [concept.lower().strip() for concept in concept_source if concept.strip()]

    matched = [concept for concept in normalized_concepts if concept in payload.answer.lower()]
    missing = [concept for concept in normalized_concepts if concept not in payload.answer.lower()]

    expected_tokens = _tokens(payload.expectedAnswer or " ".join(normalized_concepts))
    overlap = len(answer_tokens & expected_tokens) / max(1, len(expected_tokens))
    concept_score = len(matched) / max(1, len(normalized_concepts)) if normalized_concepts else overlap
    length_score = min(1.0, len(payload.answer.split()) / 80)
    score = round((overlap * 0.45 + concept_score * 0.4 + length_score * 0.15) * 100)

    if score >= 80:
        feedback = "Answer covers the main expected points with sufficient detail."
    elif score >= 55:
        feedback = "Answer is partially aligned, but needs more complete technical coverage."
    else:
        feedback = "Answer misses several expected points and should be expanded."

    return LocalInterviewEvaluationResponse(
        score=max(0, min(100, score)),
        feedback=feedback,
        matchedConcepts=matched[:12],
        missingConcepts=missing[:12],
    )
