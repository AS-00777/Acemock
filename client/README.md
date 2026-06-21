<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/20fc3c4e-507d-4d0c-86a8-138d1b7a1c92

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the backend API base URL in `.env.local` (example):
   `VITE_API_BASE_URL=http://localhost:5000/api`
3. Run the app:
   `npm run dev`

## Interview monitoring

During an active interview session, the client captures a small webcam frame every 5 seconds and sends it to `POST /api/proctoring/check-frame`. The backend calls Roboflow, applies the consecutive-warning rules, and returns warning/ban decisions. The Roboflow API key must never be configured in the client.
