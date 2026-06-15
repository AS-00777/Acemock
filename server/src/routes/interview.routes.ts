import { Router } from "express";
import {
  answer,
  complete,
  details,
  history,
  question,
  remove,
  start,
} from "../controllers/interview.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/start", requireAuth, start);
router.get("/history", requireAuth, history);
router.post("/:id/question", requireAuth, question);
router.post("/:id/answer", requireAuth, answer);
router.post("/:id/complete", requireAuth, complete);
router.delete("/:id", requireAuth, remove);
router.get("/:id", requireAuth, details);

export default router;
