from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from app.schemas import LocalInterviewEvaluationRequest, LocalInterviewEvaluationResponse, AtsCheckResponse, ResumeExtractResponse, ResumeJdAnalyzeResponse
from app.services.ats_checker import check_ats, extract_resume_text
from app.services.interview_evaluator import evaluate_local
from app.services.resume_jd_analyzer import analyze_resume_jd


app = FastAPI(title="AceMock AI Python NLP Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ats/check", response_model=AtsCheckResponse)
async def ats_check(
    resume: UploadFile = File(...),
) -> AtsCheckResponse:
    try:
        text = extract_resume_text(resume.filename or "", resume.content_type or "", resume.file)
        return check_ats(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to analyze resume") from exc


@app.post("/resume/extract", response_model=ResumeExtractResponse)
async def resume_extract(
    resume: UploadFile = File(...),
) -> ResumeExtractResponse:
    try:
        text = extract_resume_text(resume.filename or "", resume.content_type or "", resume.file)
        ats = check_ats(text)
        status = "resume" if ats.status == "ok" and ats.documentType == "resume" else (
            "unreadable" if ats.status == "unreadable" or ats.documentType == "unreadable" else "invalid_document"
        )
        return ResumeExtractResponse(
            document_type=status,
            extracted_text=text if status == "resume" else "",
            has_linkedin=bool(ats.contactDetection.get("linkedin", False)),
            has_github=bool(ats.contactDetection.get("github", False)),
            readable_word_count=ats.wordCount,
            section_signals=ats.sectionsFound,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to extract resume text") from exc


@app.post("/resume-jd/analyze", response_model=ResumeJdAnalyzeResponse)
async def resume_jd_analyze(
    resume: UploadFile = File(...),
    targetRole: str = Form(...),
    jobDescription: str = Form(...),
) -> ResumeJdAnalyzeResponse:
    try:
        text = extract_resume_text(resume.filename or "", resume.content_type or "", resume.file)
        return analyze_resume_jd(text, targetRole, jobDescription)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to analyze resume against job description") from exc


@app.post("/interview/evaluate-local", response_model=LocalInterviewEvaluationResponse)
def interview_evaluate_local(payload: LocalInterviewEvaluationRequest) -> LocalInterviewEvaluationResponse:
    return evaluate_local(payload)
