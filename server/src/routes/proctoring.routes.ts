import { Router } from "express";
import { checkBan, checkFrame } from "../controllers/proctoring.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/check-ban", requireAuth, checkBan);
router.post("/check-frame", requireAuth, checkFrame);

export default router;
