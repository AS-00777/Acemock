import { Router } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { analyze } from "../controllers/resumeJd.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
const uploadDir = path.resolve(process.cwd(), "uploads", "resume-jd");
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".resume";
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      cb(null, `resume-jd-${unique}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(requireAuth);
router.post("/analyze", upload.single("resume"), analyze);

export default router;
