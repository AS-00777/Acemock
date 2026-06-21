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
  question,
  remove,
  runCode,
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

router.post("/start", requireAuth, start);
router.get("/history", requireAuth, history);
router.post("/answers/audio", requireAuth, upload.single("audio"), audioAnswer);
router.post("/:id/question", requireAuth, question);
router.post("/:id/answer", requireAuth, answer);
router.post("/:id/run-code", requireAuth, runCode);
router.post("/:id/complete", requireAuth, complete);
router.delete("/:id", requireAuth, remove);
router.get("/:id", requireAuth, details);

export default router;
