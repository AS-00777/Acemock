import re
from collections import Counter

from app.schemas import ResumeJdAnalyzeResponse, SkillMatch
from app.services.ats_checker import SECTION_PATTERNS, _normalize, _tokens
from app.services.semantic_similarity import semantic_similarity
from app.services.skill_matcher import canonical_label, extract_skills, match_required_skills


STOPWORDS = {
    "and", "the", "with", "for", "that", "this", "from", "have", "will", "are",
    "you", "your", "our", "using", "into", "able", "work", "team", "role",
}

RESUME_STRUCTURE_SECTIONS = ["skills", "experience", "projects", "education", "certifications"]
WRONG_DOMAIN_THRESHOLD = 18
_spacy_nlp = None
_spacy_checked = False


def _get_spacy():
    global _spacy_nlp, _spacy_checked
    if _spacy_checked:
        return _spacy_nlp
    _spacy_checked = True
    try:
        import spacy
        _spacy_nlp = spacy.load("en_core_web_sm")
    except Exception:
        _spacy_nlp = None
    return _spacy_nlp


def _score(value: float) -> int:
    return max(0, min(100, round(value * 100)))


def _keywords(text: str) -> list[str]:
    nlp = _get_spacy()
    if nlp is not None:
        doc = nlp(text[:100000])
        terms: list[str] = []
        for chunk in doc.noun_chunks:
            value = " ".join(token.lemma_.lower() for token in chunk if not token.is_stop and token.is_alpha).strip()
            if len(value) > 3:
                terms.append(value)
        for token in doc:
            if not token.is_stop and token.is_alpha and len(token.text) > 3:
                terms.append(token.lemma_.lower())
        if terms:
            counts = Counter(terms)
            return [term for term, _count in counts.most_common(30)]

    counts = Counter(token for token in _tokens(text) if len(token) > 3 and token not in STOPWORDS)
    return [token for token, _count in counts.most_common(30)]


def _meaningful_word_count(text: str) -> int:
    return len([token for token in _tokens(text) if token not in STOPWORDS])


def _resume_sections(text: str) -> list[str]:
    lowered = text.lower()
    found = [name for name, pattern in SECTION_PATTERNS.items() if re.search(pattern, lowered)]
    if re.search(r"\bintern(ship)?\b|\btraining\b", lowered) and "experience" not in found:
        found.append("experience")
    if re.search(r"\bcertificate|certification|certified\b", lowered) and "certifications" not in found:
        found.append("certifications")
    return found


def _section_text(text: str, names: list[str]) -> str:
    lowered = text.lower()
    chunks = []
    for name in names:
        match = re.search(SECTION_PATTERNS.get(name, ""), lowered)
        if match:
            chunks.append(text[match.start():match.start() + 1800])
    return "\n".join(chunks) or text[:2500]


def analyze_resume_jd(resume_text: str, target_role: str, job_description: str) -> ResumeJdAnalyzeResponse:
    resume = _normalize(resume_text)
    jd = _normalize(f"{target_role}\n{job_description}")
    meaningful_words = _meaningful_word_count(resume)
    resume_sections = _resume_sections(resume)
    if len(resume) < 80 or meaningful_words < 35:
        raise ValueError("Resume text is too short to analyze.")
    if len(set(resume_sections) & set(RESUME_STRUCTURE_SECTIONS)) < 2:
        if meaningful_words < 80:
            raise ValueError("This does not look like a resume.")
        raise ValueError("This document has text, but it does not look like a resume.")
    if len(job_description.strip()) < 80:
        raise ValueError("Job description is too short to compare.")

    required_skills = extract_skills(jd)
    resume_skills = extract_skills(resume)
    exact_matches, missing, partial_matches = match_required_skills(required_skills, resume_skills)

    skill_points = len(exact_matches) + sum(item.score for item in partial_matches)
    skill_match_score = _score(skill_points / max(1, len(required_skills))) if required_skills else 60

    semantic, semantic_model = semantic_similarity(resume, jd)
    shared_skill_bonus = min(0.24, (len(exact_matches) + len(partial_matches) * 0.65) / max(1, len(required_skills)) * 0.24)
    semantic_match_score = _score(min(1.0, semantic + shared_skill_bonus))

    experience_text = _section_text(resume, ["experience", "projects", "certifications"])
    experience_similarity, _ = semantic_similarity(experience_text, jd)
    evidence_terms = [
        "project", "projects", "internship", "intern", "training", "certification",
        "certificate", "java", "spring", "rest", "api", "mysql", "database",
    ]
    evidence_hits = sum(1 for term in evidence_terms if re.search(rf"\b{re.escape(term)}\b", resume.lower()))
    experience_relevance_score = max(_score(experience_similarity), min(92, 38 + evidence_hits * 5))

    jd_focus_sections = ["skills", "experience", "projects", "education", "certifications"]
    section_relevance_score = _score(len(set(resume_sections) & set(jd_focus_sections)) / len(jd_focus_sections))

    jd_keywords = _keywords(jd)
    resume_lower = resume.lower()
    covered_keywords = [keyword for keyword in jd_keywords if keyword in resume_lower]
    keyword_coverage_score = _score(len(covered_keywords) / max(1, len(jd_keywords)))

    overall = round(
        skill_match_score * 0.35
        + semantic_match_score * 0.25
        + experience_relevance_score * 0.20
        + section_relevance_score * 0.10
        + keyword_coverage_score * 0.10
    )
    if skill_match_score < WRONG_DOMAIN_THRESHOLD and semantic_match_score < 35:
        overall = min(overall, 45)
    if "jpa" in missing and exact_matches:
        overall = min(overall, 88)

    weak_project_alignment = []
    if experience_relevance_score < 55:
        weak_project_alignment.append("Projects and experience do not strongly mirror the role responsibilities.")
    if "projects" not in resume_sections:
        weak_project_alignment.append("Projects section was not clearly detected.")
    if missing:
        weak_project_alignment.append("Several required skills are missing from project or experience evidence.")

    suggestions = [
        "Add role-specific keywords naturally inside experience and project bullets.",
        "Tie each major skill to measurable project outcomes.",
    ]
    if missing:
        suggestions.insert(0, f"Add evidence for missing required skills: {', '.join(canonical_label(skill) for skill in missing[:6])}.")
    if partial_matches:
        suggestions.append("Clarify related backend/database experience so partial matches become direct matches.")

    to_schema = lambda item: SkillMatch(
        requiredSkill=canonical_label(item.requiredSkill),
        resumeSkill=canonical_label(item.resumeSkill),
        matchType=item.matchType,
        score=item.score,
    )

    return ResumeJdAnalyzeResponse(
        overallMatchScore=max(0, min(100, overall)),
        skillMatchScore=skill_match_score,
        semanticMatchScore=semantic_match_score,
        experienceRelevanceScore=experience_relevance_score,
        sectionRelevanceScore=section_relevance_score,
        keywordCoverageScore=keyword_coverage_score,
        matchedSkills=[to_schema(item) for item in exact_matches],
        missingSkills=[canonical_label(skill) for skill in missing],
        partialMatches=[to_schema(item) for item in partial_matches],
        weakProjectAlignment=weak_project_alignment[:4],
        suggestedImprovements=suggestions[:6],
        extractedRequiredSkills=[canonical_label(skill) for skill in required_skills],
        resumeSkills=[canonical_label(skill) for skill in resume_skills],
        semanticModel=semantic_model,
        confidenceLabel="Full confidence" if semantic_model == "all-MiniLM-L6-v2" else "Limited confidence",
        summary="Strong role alignment." if overall >= 80 else "Resume needs more role-specific evidence and keywords.",
    )
