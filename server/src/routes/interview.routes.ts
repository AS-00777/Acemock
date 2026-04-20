import { Router } from "express";
import {
  answer,
  complete,
  details,
  history,
  question,
  start,
} from "../controllers/interview.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/start", requireAuth, start);
router.get("/history", requireAuth, history);
router.post("/:id/question", requireAuth, question);
router.post("/:id/answer", requireAuth, answer);
router.post("/:id/complete", requireAuth, complete);
router.get("/:id", requireAuth, details);

export default router;
