import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import interviewRoutes from "./routes/interview.routes";
import { errorHandler, notFound } from "./middleware/error.middleware";

export const app = express();

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN ?? true,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.send("AceMock AI Backend Running");
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/interview", interviewRoutes);

app.use(notFound);
app.use(errorHandler);

