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

## Auth notes
- Send JWT on protected routes using: `Authorization: Bearer <token>`
- Passwords are hashed server-side using Node.js `crypto.scrypt` (can be swapped to bcrypt later if desired).
