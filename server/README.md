# AceMock AI — Backend (Express + TypeScript + MySQL)

## 1) Set up MySQL locally

### Option A — MySQL Server + Workbench (recommended)
1. Install **MySQL Community Server** (8.x).
2. Create a database:
   - `CREATE DATABASE acemock;`
3. Create a MySQL user (or use `root`) and note the password.

### Option B — Docker
Run MySQL with a single command:

```bash
docker run --name acemock-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=acemock -p 3306:3306 -d mysql:8
```

## 2) Configure environment variables
Copy `server/.env.example` to `server/.env` and fill values:

- `DATABASE_URL=mysql://user:password@localhost:3306/acemock`
- `JWT_SECRET=...`
- `GEMINI_API_KEY=...`
- `OPENROUTER_API_KEY=...`
- `ROBOFLOW_API_KEY=...` (server-side only; used by interview proctoring)
- `ROBOFLOW_API_URL=https://serverless.roboflow.com`
- `ROBOFLOW_WORKSPACE=atharvas-workspace-fr8mu`
- `ROBOFLOW_WORKFLOW_ID=yolov11`

## 3) Install dependencies

```bash
cd server
npm install
```

## 4) Run migrations / create tables (Prisma)

```bash
cd server
mysql -u root -p acemock < migrations/001_init.sql
mysql -u root -p acemock < migrations/002_interview_enhancements.sql
mysql -u root -p acemock < migrations/003_evaluation_rubrics.sql
mysql -u root -p acemock < migrations/004_clerk_auth.sql
mysql -u root -p acemock < migrations/005_user_profile_search_columns.sql
mysql -u root -p acemock < migrations/006_answer_rubric_factors.sql
mysql -u root -p acemock < migrations/007_proctoring_bans.sql
```

This creates the tables (`users`, `interviews`, `questions`, `answers`, `results`) and adds interview enhancements (difficulty + question type + richer answer evaluation).

Note: A Prisma schema exists at `server/prisma/schema.prisma` if you want to switch to Prisma later.

## 5) Start the server

Development (TypeScript + hot reload):

```bash
cd server
npm run dev
```

Production build:

```bash
cd server
npm run build
npm start
```

Server runs on `http://localhost:5000` by default.

## 6) Connect the frontend to the backend

### Option A — Vite proxy (best)
In `client/vite.config.ts`, proxy `/api` to `http://localhost:5000`.

### Option B — Env var
If your frontend uses an API base URL, point it to:
- `http://localhost:5000`

## API summary

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/user/profile` (Authorization: `Bearer <token>`)
- `POST /api/interview/start`
- `POST /api/interview/:id/question` (generates via Gemini if `questionText` omitted)
- `POST /api/interview/:id/answer` (evaluates via Gemini; saves answer + score + feedback)
- `POST /api/interview/:id/complete`
- `GET /api/interview/history?page=1&limit=10`
- `GET /api/interview/:id`
- `POST /api/proctoring/check-frame` (body: `{ interviewId, frame }`; frame is a webcam image data URL or base64)
- `GET /api/proctoring/check-ban`

## Proctoring

The proctoring module calls the Roboflow `YOLOv11` workflow from the backend using native Node `fetch`, `FormData`, and `Blob`. It posts multipart form data to `/infer/workflows/{workspace}/{workflow_id}?api_key=...` with the webcam frame attached as the field named `image`. It detects repeated monitoring violations for multiple persons and mobile phones. A warning is counted only after 3 consecutive violating checks; the fourth confirmed warning completes the interview, stores `warning_count`, bans the user for 3 hours with `banned_until` and `ban_reason`, and blocks new interview starts until the ban expires.

## Auth notes
- Send JWT on protected routes using: `Authorization: Bearer <token>`
- Passwords are hashed server-side using Node.js `crypto.scrypt` (can be swapped to bcrypt later if desired).
