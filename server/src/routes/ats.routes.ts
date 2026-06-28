import { Router } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { check, health } from "../controllers/ats.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
const uploadDir = path.resolve(process.cwd(), "uploads", "ats-resumes");
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".resume";
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      cb(null, `ats-${unique}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get("/health", health);

router.use(requireAuth);
router.post("/check", upload.single("resume"), check);

export default router;
