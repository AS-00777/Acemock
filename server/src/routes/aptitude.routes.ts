import { Router } from "express";
import { history, meta, questions, result, start, submit } from "../controllers/aptitude.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth);
router.get("/meta", meta);
router.get("/questions", questions);
router.post("/tests/start", start);
router.post("/tests/:testId/submit", submit);
router.get("/tests/history", history);
router.get("/tests/:testId/result", result);

export default router;
