import { Router } from "express";
import { getProfile, putProfile } from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/profile", requireAuth, getProfile);
router.put("/profile", requireAuth, putProfile);

export default router;
