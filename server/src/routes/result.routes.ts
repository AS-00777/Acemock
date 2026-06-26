import { Router } from "express";
import { details } from "../controllers/interview.controller";
import { requireAuth } from "../middleware/auth.middleware";

// Results are part of an interview. Reuse the ownership-aware interview
// details controller rather than introducing a second authorization path.
const router = Router();
router.use(requireAuth);
router.get("/:id", details);

export default router;
