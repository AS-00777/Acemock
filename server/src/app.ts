import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { clerkMiddleware } from "@clerk/express";
import { env } from "./config/env";
import userRoutes from "./routes/user.routes";
import interviewRoutes from "./routes/interview.routes";
import proctoringRoutes from "./routes/proctoring.routes";
import aptitudeRoutes from "./routes/aptitude.routes";
import resultRoutes from "./routes/result.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import { errorHandler, notFound } from "./middleware/error.middleware";

export const app = express();

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN ?? true,
    credentials: true,
  })
);
app.use(express.json({ limit: "6mb" }));
app.use(cookieParser());
app.use(clerkMiddleware({ secretKey: env.CLERK_SECRET_KEY }));

app.get("/", (_req, res) => {
  res.send("AceMock AI Backend Running");
});

app.use("/api/user", userRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/proctoring", proctoringRoutes);
app.use("/api/aptitude", aptitudeRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(notFound);
app.use(errorHandler);
