import { Router } from "express";
import { checkBan, checkFrame } from "../controllers/proctoring.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/check-ban", checkBan);
router.post("/check-frame", checkFrame);

export default router;
