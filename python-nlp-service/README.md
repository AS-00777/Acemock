# AceMock AI Python NLP Service

Additive local NLP service for ATS checks and future local interview evaluation.

## Setup From Backend

Run once from `server`:

```bash
npm run setup:nlp
```

Then start the backend and Python NLP service together:

```bash
npm run dev
```

The Node backend expects:

```env
PYTHON_NLP_URL=http://localhost:8001
```

## Endpoints

- `POST /ats/check` accepts multipart form data with `resume`.
- `POST /resume-jd/analyze` accepts multipart form data with `resume`, `targetRole`, and `jobDescription`.
- `POST /interview/evaluate-local` is available for future integration only. The current mock interview flow does not call it.
