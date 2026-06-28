from pydantic import BaseModel, Field


class AtsCheckResponse(BaseModel):
    atsScore: int = Field(ge=0, le=100)
    parseScore: int = Field(ge=0, le=100)
    readabilityScore: int = Field(ge=0, le=100)
    sectionCoverageScore: int = Field(ge=0, le=100)
    formattingScore: int = Field(ge=0, le=100)
    keywordQualityScore: int = Field(ge=0, le=100)
    contactDetection: dict[str, bool]
    detectedSkills: list[str]
    strengths: list[str]
    improvements: list[str]
    formattingIssues: list[str]
    sectionIssues: list[str]
    sectionsFound: list[str]
    wordCount: int
    summary: str
    documentType: str = "resume"
    documentConfidence: int = Field(default=100, ge=0, le=100)
    documentReasons: list[str] = []
    status: str = "ok"
    message: str = ""
    overallScore: int | None = Field(default=None, ge=0, le=100)


class ResumeExtractResponse(BaseModel):
    document_type: str
    extracted_text: str
    has_linkedin: bool
    has_github: bool
    readable_word_count: int
    section_signals: list[str]


class SkillMatch(BaseModel):
    requiredSkill: str
    resumeSkill: str
    matchType: str
    score: float


class ResumeJdAnalyzeResponse(BaseModel):
    overallMatchScore: int = Field(ge=0, le=100)
    skillMatchScore: int = Field(ge=0, le=100)
    semanticMatchScore: int = Field(ge=0, le=100)
    experienceRelevanceScore: int = Field(ge=0, le=100)
    sectionRelevanceScore: int = Field(ge=0, le=100)
    keywordCoverageScore: int = Field(ge=0, le=100)
    matchedSkills: list[SkillMatch]
    missingSkills: list[str]
    partialMatches: list[SkillMatch]
    weakProjectAlignment: list[str]
    suggestedImprovements: list[str]
    extractedRequiredSkills: list[str]
    resumeSkills: list[str]
    semanticModel: str
    confidenceLabel: str
    summary: str


class LocalInterviewEvaluationRequest(BaseModel):
    question: str
    answer: str
    expectedAnswer: str | None = None
    keyConcepts: list[str] = []


class LocalInterviewEvaluationResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    feedback: str
    matchedConcepts: list[str]
    missingConcepts: list[str]
    source: str = "python-local-nlp"
