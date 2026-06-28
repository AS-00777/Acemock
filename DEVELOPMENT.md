# Development Workflow

Run the Node backend and Python NLP service independently during development.

## Terminal 1: Backend

```powershell
cd server
npm run dev
```

The backend uses nodemon and automatically reloads when backend files change.

## Terminal 2: Python NLP Service

```powershell
cd python-nlp-service
.\venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

The Python service automatically reloads when Python files change.

## Terminal 3: Frontend

```powershell
cd client
npm start
```

With this workflow, editing Python files does not stop or restart the backend server.
