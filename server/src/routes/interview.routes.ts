import { Router } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import {
  answer,
  audioAnswer,
  complete,
  details,
  history,
  followUp,
  followUpAnswer,
  question,
  remove,
  runCode,
  retryEvaluation,
  start,
} from "../controllers/interview.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
const audioUploadDir = path.resolve(process.cwd(), "uploads", "interview-audio");
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(audioUploadDir, { recursive: true });
      cb(null, audioUploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".webm";
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      cb(null, `answer-${unique}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Everything in this router is private. Keep auth at the boundary so new
// interview endpoints cannot accidentally be added without protection.
router.use(requireAuth);
router.post("/start", start);
router.get("/history", history);
router.post("/answers/audio", upload.single("audio"), audioAnswer);
router.post("/:id/question", question);
router.post("/:id/answer", answer);
router.post("/:id/follow-up", followUp);
router.post("/:id/follow-up-answer", followUpAnswer);
router.post("/:id/run-code", runCode);
router.post("/:id/complete", complete);
router.post("/:id/submit", complete);
router.post("/:id/retry-evaluation", retryEvaluation);
router.delete("/:id", remove);
router.get("/:id", details);

export default router;
