import { Router } from "express";
import multer from "multer";
import { analyze, startFromResume } from "../controllers/resume.controller";
import { ApiError } from "../middleware/error.middleware";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname);
    if (!isPdf) return cb(new ApiError(400, "Only PDF resumes are supported."));
    cb(null, true);
  },
});

router.use(requireAuth);
router.post("/analyze", upload.single("resume"), analyze);
router.post("/:resumeId/start-interview", startFromResume);

export default router;
