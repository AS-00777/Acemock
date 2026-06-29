import { Router } from "express";
import type { NextFunction, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { ApiError } from "../middleware/error.middleware";
import type { AuthRequest } from "../types/request";
import {
  backfillUserActivitiesFromCompletedData,
  checkAndAwardBadges,
  getActivityCalendar,
  getAllActiveBadges,
  getCareerReadinessStats,
  getCurrentStreak,
  getLockedBadges,
  getNextBadgeProgress,
  getUserBadges,
} from "../services/badge.service";

const router = Router();

router.use(requireAuth);

async function safeDashboardBackfill(userId: string | number) {
  try {
    await backfillUserActivitiesFromCompletedData(userId);
  } catch (error) {
    console.warn("Dashboard activity backfill failed, continuing without blocking dashboard.", {
      userId: String(userId),
      message: String((error as Error)?.message ?? error),
    });
  }
}

router.get("/badges", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const userId = req.user.clerkId ?? String(req.user.id);

    await safeDashboardBackfill(userId);
    const awardResult = await checkAndAwardBadges(userId);

    const [earnedBadges, lockedBadges, allBadges, currentStreak, nextBadge] = await Promise.all([
      getUserBadges(userId),
      getLockedBadges(userId),
      getAllActiveBadges(),
      getCurrentStreak(userId),
      getNextBadgeProgress(userId),
    ]);

    res.json({
      earnedBadges,
      lockedBadges,
      allBadges,
      totalEarned: earnedBadges.length,
      totalBadges: allBadges.length,
      currentStreak,
      nextBadge,
      newlyAwardedBadges: awardResult.newlyAwardedBadges,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/activity-calendar", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const userId = req.user.clerkId ?? String(req.user.id);

    await safeDashboardBackfill(userId);
    res.json(await getActivityCalendar(userId));
  } catch (error) {
    next(error);
  }
});

router.get("/career-readiness", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const userId = req.user.clerkId ?? String(req.user.id);

    await safeDashboardBackfill(userId);
    res.json(await getCareerReadinessStats(userId));
  } catch (error) {
    next(error);
  }
});

export default router;
