import re
import tempfile
import unicodedata
from io import BytesIO
from pathlib import Path
from typing import BinaryIO, TypedDict

from docx import Document
from PyPDF2 import PdfReader

from app.schemas import AtsCheckResponse
from app.services.skill_matcher import canonical_label, extract_skills


SECTION_PATTERNS = {
    "summary": r"\b(summary|profile|objective)\b",
    "skills": r"\b(skills|technical skills|technologies)\b",
    "experience": r"\b(experience|employment|work history|internship)\b",
    "education": r"\b(education|degree|university|college)\b",
    "projects": r"\b(projects|portfolio)\b",
    "certifications": r"\b(certifications|certificates)\b",
}


class DocumentClassification(TypedDict):
    documentType: str
    confidence: int
    reasons: list[str]

CONTACT_PATTERNS = {
    "email": r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
    "phone": r"(?:(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4})",
    "linkedin": r"https?://(?:www\.)?linkedin\.com/in/|(?:www\.)?linkedin\.com(?:/in/)?|\blinkedin\b|\blinked\s+in\b|\blinkedin\s+profile\b|(?:^|\s)in/",
    "github": r"https?://(?:www\.)?github\.com/[a-z0-9_.-]+|(?:www\.)?github\.com(?:/[a-z0-9_.-]+)?|\bgithub\b|\bgit\s+hub\b|\bgithub\s+profile\b",
}

OFFER_LETTER_PATTERNS = [
    r"\boffer\s+letter\b",
    r"\bappointment\s+letter\b",
    r"\bemployment\s+offer\b",
    r"\bjoining\b",
    r"\bjoining\s+date\b",
    r"\bsalary\b",
    r"\bcompensation\b",
    r"\bstipend\b",
    r"\bctc\b",
    r"\bterms\s+and\s+conditions\b",
    r"\bemployment\s+agreement\b",
    r"\bcongratulations\b",
    r"\bselected\s+for\b",
    r"\bselected\b",
    r"\bhr\s+department\b",
    r"\bhr\b",
    r"\bdate\s+of\s+joining\b",
    r"\breporting\s+date\b",
    r"\bdesignation\b",
    r"\bprobation\b",
    r"\bacceptance\s+of\s+offer\b",
    r"\bletterhead\b",
    r"\bdear\s+(candidate|applicant|mr|ms|mrs)\b",
]

CERTIFICATE_PATTERNS = [
    r"\bcertificate\b",
    r"\bcertified\b",
    r"\bcertified\s+that\b",
    r"\bcompletion\b",
    r"\bcertificate\s+of\s+completion\b",
    r"\bparticipated\b",
    r"\bparticipated\s+in\b",
    r"\bawarded\b",
    r"\bawarded\s+to\b",
    r"\bissued\s+by\b",
    r"\bcourse\s+completion\b",
    r"\bsuccessfully\s+completed\b",
    r"\btraining\s+program\b",
]

OTHER_NON_RESUME_PATTERNS = [
    r"\binvoice\b",
    r"\bbill\s+to\b",
    r"\btax\s+invoice\b",
    r"\bmarksheet\b",
    r"\bmark\s+sheet\b",
    r"\bidentity\s+card\b",
    r"\baadhaar\b",
    r"\bpan\s+card\b",
]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _normalized_search_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text or "").lower()
    normalized = re.sub(r"[\u200b-\u200d\ufeff]", " ", normalized)
    normalized = re.sub(r"[\r\n]+", " ", normalized)
    normalized = re.sub(r"\s*([./:@])\s*", r"\1", normalized)
    normalized = re.sub(r"\blinked\s+in\b", "linkedin", normalized)
    normalized = re.sub(r"\bgit\s+hub\b", "github", normalized)
    normalized = re.sub(r"\blinkedin\s*\.\s*com\s*/\s*in\s*/", "linkedin.com/in/", normalized)
    normalized = re.sub(r"\blinkedin\s*\.\s*com\b", "linkedin.com", normalized)
    normalized = re.sub(r"\bgithub\s*\.\s*com\s*/", "github.com/", normalized)
    normalized = re.sub(r"\bgithub\s*\.\s*com\b", "github.com", normalized)
    normalized = re.sub(r"[|•·:_\-]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()

def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z0-9.+#-]{1,}", text.lower())


def _read_pdf_pypdf2(pdf_bytes: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        return ""


def _read_pdf_pdfplumber(pdf_bytes: bytes) -> str:
    try:
        import pdfplumber  # type: ignore
    except Exception:
        return ""
    try:
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception:
        return ""


def _read_pdf_pdfminer(pdf_bytes: bytes) -> str:
    try:
        from pdfminer.high_level import extract_text_to_fp  # type: ignore
        from pdfminer.layout import LAParams  # type: ignore
    except Exception:
        return ""
    try:
        output = BytesIO()
        extract_text_to_fp(BytesIO(pdf_bytes), output, laparams=LAParams(), output_type="text", codec="utf-8")
        return output.getvalue().decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _candidate_text_score(text: str) -> int:
    normalized = _normalized_search_text(text)
    readable_words = [word for word in _tokens(normalized) if len(word) > 2]
    contacts = _contact_detection(text, log=False)
    section_hits = sum(1 for pattern in SECTION_PATTERNS.values() if re.search(pattern, normalized, re.IGNORECASE))
    contact_hits = sum(1 for detected in contacts.values() if detected)
    return len(readable_words) + section_hits * 35 + contact_hits * 45


def _read_pdf(file_obj: BinaryIO) -> str:
    pdf_bytes = file_obj.read()
    candidates = [
        _read_pdf_pypdf2(pdf_bytes),
        _read_pdf_pdfplumber(pdf_bytes),
        _read_pdf_pdfminer(pdf_bytes),
    ]
    return max(candidates, key=_candidate_text_score, default="")


def _read_docx(file_obj: BinaryIO) -> str:
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as temp:
        temp.write(file_obj.read())
        temp_path = Path(temp.name)
    try:
        doc = Document(str(temp_path))
        return "\n".join(paragraph.text for paragraph in doc.paragraphs)
    finally:
        temp_path.unlink(missing_ok=True)


def extract_resume_text(filename: str, content_type: str, file_obj: BinaryIO) -> str:
    name = filename.lower()
    if name.endswith(".pdf") or content_type == "application/pdf":
        return _normalize(_read_pdf(file_obj))
    if name.endswith(".docx") or content_type.endswith("officedocument.wordprocessingml.document"):
        return _normalize(_read_docx(file_obj))
    if name.endswith(".txt") or content_type.startswith("text/"):
        return _normalize(file_obj.read().decode("utf-8", errors="ignore"))
    raise ValueError("Unsupported resume format. Upload PDF, DOCX, or TXT.")


def _score_sections(text: str) -> tuple[int, list[str], list[str]]:
    lowered = text.lower()
    found = [name for name, pattern in SECTION_PATTERNS.items() if re.search(pattern, lowered)]
    important = ["skills", "experience", "education", "projects"]
    gaps = [name for name in important if name not in found]
    score = max(35, round((len(found) / len(SECTION_PATTERNS)) * 100))
    return min(score, 100), found, gaps


def _readability_score(text: str, word_count: int) -> int:
    sentences = max(1, len(re.findall(r"[.!?]+", text)))
    avg_sentence_words = word_count / sentences
    score = 100
    if avg_sentence_words > 28:
        score -= 18
    if word_count < 250:
        score -= 18
    if word_count > 1200:
        score -= 12
    return max(35, min(100, round(score)))


def _contact_detection(text: str, log: bool = True) -> dict[str, bool]:
    normalized = _normalized_search_text(text)
    contacts = {
        name: bool(re.search(pattern, text, re.IGNORECASE) or re.search(pattern, normalized, re.IGNORECASE))
        for name, pattern in CONTACT_PATTERNS.items()
    }
    if log:
        print(f"LinkedIn detected: {contacts.get('linkedin', False)}")
        print(f"GitHub detected: {contacts.get('github', False)}")
    return contacts


def _pattern_hits(text: str, patterns: list[str]) -> int:
    return sum(1 for pattern in patterns if re.search(pattern, text, re.IGNORECASE))


def _has_section(text: str, *terms: str) -> bool:
    return any(re.search(rf"\b{re.escape(term)}\b", text, re.IGNORECASE) for term in terms)


def _resume_signal_names(text: str, skills: list[str], contacts: dict[str, bool]) -> list[str]:
    signals = []
    first_block = text[:450]
    if contacts.get("email") or contacts.get("phone"):
        signals.append("email")
    if contacts.get("phone"):
        signals.append("phone")
    if contacts.get("linkedin"):
        signals.append("linkedin")
    if contacts.get("github"):
        signals.append("github")
    if (contacts.get("email") or contacts.get("phone") or contacts.get("linkedin") or contacts.get("github")) and _has_section(first_block, "contact", "portfolio"):
        signals.append("name/contact area")
    if _has_section(text, "education", "degree", "university", "college", "b.e", "be", "b.tech", "btech", "bachelor", "diploma", "master"):
        signals.append("education")
    if _has_section(text, "skills", "technical skills") or len(skills) >= 2:
        signals.append("skills or technical skills")
    if _has_section(text, "projects", "project", "portfolio"):
        signals.append("projects")
    if _has_section(text, "experience", "internship", "employment", "work history"):
        signals.append("experience or internship")
    if _has_section(text, "certifications", "certification", "certificates"):
        signals.append("certifications")
    if _has_section(text, "summary", "about", "objective", "profile"):
        signals.append("summary/about/objective")
    if _has_section(text, "languages"):
        signals.append("languages")
    if _has_section(text, "tools", "technologies", "tech stack") or len(skills) >= 3:
        signals.append("tools/technologies")
    if _has_section(text, "developed", "built", "implemented", "created") and len(skills) >= 2:
        signals.append("project bullets with technology names")
    return signals


def classify_document(text: str) -> DocumentClassification:
    normalized = _normalized_search_text(text)
    words = _tokens(normalized)
    skills = [canonical_label(skill) for skill in extract_skills(normalized)]
    contacts = _contact_detection(text)
    meaningful_words = [word for word in words if len(word) > 2]
    offer_hits = _pattern_hits(normalized, OFFER_LETTER_PATTERNS)
    certificate_hits = _pattern_hits(normalized, CERTIFICATE_PATTERNS)
    other_hits = _pattern_hits(normalized, OTHER_NON_RESUME_PATTERNS)
    if len(meaningful_words) < 60:
        signals = _resume_signal_names(normalized, skills, contacts)
        if offer_hits >= 2:
            return {
                "documentType": "offer_letter",
                "confidence": min(98, 72 + offer_hits * 4),
                "reasons": [f"Resume signals: {', '.join(signals) if signals else 'none'}.", f"Offer-letter signals: {offer_hits}."],
            }
        if certificate_hits >= 2:
            return {
                "documentType": "certificate",
                "confidence": min(98, 72 + certificate_hits * 4),
                "reasons": [f"Resume signals: {', '.join(signals) if signals else 'none'}.", f"Certificate signals: {certificate_hits}."],
            }
        if not signals:
            return {
                "documentType": "unreadable",
                "confidence": 95,
                "reasons": [f"Only {len(meaningful_words)} meaningful words were extracted.", "No resume structure signals were found."],
            }

    signals = _resume_signal_names(normalized, skills, contacts)
    structural_signals = [signal for signal in signals if signal in [
        "education",
        "skills or technical skills",
        "projects",
        "experience or internship",
        "certifications",
        "summary/about/objective",
        "languages",
        "tools/technologies",
        "project bullets with technology names",
    ]]
    reasons = [
        f"Resume signals: {', '.join(signals) if signals else 'none'}.",
        f"Offer-letter signals: {offer_hits}.",
        f"Certificate signals: {certificate_hits}.",
    ]

    if other_hits >= 1 and len(structural_signals) < 2:
        return {"documentType": "unknown", "confidence": 80, "reasons": reasons + ["Non-resume document keywords were detected."]}
    if offer_hits >= 3 and len(structural_signals) < 3:
        return {"documentType": "offer_letter", "confidence": min(98, 70 + offer_hits * 4), "reasons": reasons + ["Offer-letter language outweighs resume structure."]}
    if offer_hits >= 6:
        return {"documentType": "offer_letter", "confidence": min(99, 75 + offer_hits * 3), "reasons": reasons + ["Strong offer-letter language detected."]}
    if certificate_hits >= 3 and len(structural_signals) < 3:
        return {"documentType": "certificate", "confidence": min(98, 72 + certificate_hits * 4), "reasons": reasons + ["Certificate language outweighs resume structure."]}
    if certificate_hits >= 5:
        return {"documentType": "certificate", "confidence": min(99, 78 + certificate_hits * 3), "reasons": reasons + ["Strong certificate language detected."]}
    if len(signals) >= 3 and len(structural_signals) >= 2:
        return {"documentType": "resume", "confidence": min(99, 65 + len(signals) * 4 + len(structural_signals) * 3), "reasons": reasons}
    if len(signals) >= 4 and len(structural_signals) >= 1 and offer_hits < 3 and certificate_hits < 3:
        return {"documentType": "resume", "confidence": min(90, 58 + len(signals) * 4), "reasons": reasons}
    if len(meaningful_words) < 60:
        return {
            "documentType": "unreadable",
            "confidence": 85,
            "reasons": reasons + [f"Only {len(meaningful_words)} meaningful words were extracted."],
        }
    return {"documentType": "unknown", "confidence": 75, "reasons": reasons + ["Fewer than three reliable resume structure signals were found."]}


def _formatting_issues(text: str, word_count: int) -> list[str]:
    issues = []
    if "\t" in text:
        issues.append("Avoid tab-heavy spacing because ATS parsers may read it inconsistently.")
    if sum(1 for line in text.splitlines() if len(line) > 120) > 2:
        issues.append("Several lines are very long; use shorter bullets for cleaner parsing.")
    if word_count < 250:
        issues.append("Resume appears short; add measurable bullets and project details.")
    if word_count > 1200:
        issues.append("Resume appears long; trim repeated details for better scan quality.")
    if re.search(r"[\u25a0-\u25ff]{3,}", text):
        issues.append("Decorative symbols may reduce parser accuracy.")
    return issues


def _keyword_quality_score(skills: list[str], word_count: int) -> int:
    if word_count <= 0:
        return 0
    density = len(skills) / max(1, word_count / 100)
    if density < 1:
        return 45
    if density > 8:
        return 70
    return min(100, round(55 + density * 7))


def _invalid_document_response(
    document_type: str,
    confidence: int,
    reasons: list[str],
    contacts: dict[str, bool],
    word_count: int,
) -> AtsCheckResponse:
    unreadable = document_type == "unreadable"
    message = (
        "Could not read enough resume text. Please upload a text-readable PDF, DOCX, or TXT resume."
        if unreadable
        else "This does not look like a resume. Please upload a valid resume."
    )
    score = 0 if unreadable else 10
    return AtsCheckResponse(
        atsScore=score,
        overallScore=score,
        parseScore=0,
        readabilityScore=0,
        sectionCoverageScore=0,
        formattingScore=0,
        keywordQualityScore=0,
        contactDetection=contacts,
        detectedSkills=[],
        strengths=[],
        improvements=[message],
        formattingIssues=[],
        sectionIssues=[],
        sectionsFound=[],
        wordCount=word_count,
        summary=message,
        documentType=document_type,
        documentConfidence=confidence,
        documentReasons=reasons,
        status="unreadable" if unreadable else "invalid_document",
        message=message,
    )


def check_ats(resume_text: str) -> AtsCheckResponse:
    text = _normalize(resume_text)
    words = _tokens(text)
    word_count = len(words)
    skill_keys = extract_skills(text)
    detected_skills = [canonical_label(skill) for skill in skill_keys]
    section_coverage_score, sections_found, section_gaps = _score_sections(text)
    contacts = _contact_detection(text)
    classification = classify_document(text)
    document_type = classification["documentType"]
    if document_type != "resume":
        return _invalid_document_response(
            document_type=document_type,
            confidence=classification["confidence"],
            reasons=classification["reasons"],
            contacts=contacts,
            word_count=word_count,
        )

    readability_score = _readability_score(text, word_count)
    formatting_issues = _formatting_issues(text, word_count)
    formatting_score = max(35, 100 - len(formatting_issues) * 14)
    keyword_quality_score = _keyword_quality_score(detected_skills, word_count)
    contact_score = round(sum(1 for value in contacts.values() if value) / len(contacts) * 100)
    parse_score = round(readability_score * 0.45 + section_coverage_score * 0.35 + contact_score * 0.20)
    ats_score = round(
        parse_score * 0.30
        + formatting_score * 0.25
        + section_coverage_score * 0.20
        + readability_score * 0.15
        + keyword_quality_score * 0.10
    )

    strengths = []
    if detected_skills:
        strengths.append(f"Detected {len(detected_skills)} technical skills.")
    if "experience" in sections_found:
        strengths.append("Experience section is visible to parsers.")
    if readability_score >= 80:
        strengths.append("Resume is concise and readable.")
    if contacts.get("email") and contacts.get("phone"):
        strengths.append("Core contact details are detectable.")
    if not strengths:
        strengths.append("Resume content was parsed successfully.")

    improvements = []
    if section_gaps:
        improvements.append(f"Add or rename these sections for ATS clarity: {', '.join(section_gaps)}.")
    if not contacts.get("email") or not contacts.get("phone"):
        improvements.append("Include a clearly readable email and phone number near the top.")
    if word_count < 250:
        improvements.append("Add measurable project or work details so the resume has enough searchable context.")
    if not detected_skills:
        improvements.append("Add a clear technical skills section with tools, languages, and frameworks.")
    if not improvements:
        improvements.append("Keep section headings simple and maintain concise achievement-focused bullets.")

    summary = "Strong ATS foundation." if ats_score >= 80 else "Good start, but parser clarity and formatting can improve the ATS score."

    return AtsCheckResponse(
        atsScore=max(0, min(100, ats_score)),
        parseScore=parse_score,
        readabilityScore=readability_score,
        sectionCoverageScore=section_coverage_score,
        formattingScore=formatting_score,
        keywordQualityScore=keyword_quality_score,
        contactDetection=contacts,
        detectedSkills=detected_skills[:20],
        strengths=strengths[:5],
        improvements=improvements[:6],
        formattingIssues=formatting_issues,
        sectionIssues=[f"Missing or unclear {section} section." for section in section_gaps],
        sectionsFound=sections_found,
        wordCount=word_count,
        summary=summary,
        documentType=document_type,
        documentConfidence=classification["confidence"],
        documentReasons=classification["reasons"],
        status="ok",
        message="",
        overallScore=max(0, min(100, ats_score)),
    )
