import React from "react";
import {
  Target,
  Flame,
  Zap,
  Mic,
  Trophy,
  Brain,
  Lightbulb,
  FileCheck,
  Sparkles,
  Lock,
  type LucideIcon,
} from "lucide-react";

type BadgeIconProps = {
  icon: string;
  earned?: boolean;
  size?: "sm" | "md" | "lg";
};

const badgeIconMap: Record<string, LucideIcon> = {
  target: Target,
  flame: Flame,
  zap: Zap,
  mic: Mic,
  trophy: Trophy,
  brain: Brain,
  lightbulb: Lightbulb,
  "file-check": FileCheck,
  sparkles: Sparkles,
};

export const badgeIconKeys = new Set(Object.keys(badgeIconMap));

const sizeClasses = {
  sm: { container: "w-9 h-9", icon: "w-4 h-4" },
  md: { container: "w-12 h-12", icon: "w-5 h-5" },
  lg: { container: "w-16 h-16", icon: "w-7 h-7" },
};

export const defaultBadgeIconByCode: Record<string, string> = {
  FIRST_INTERVIEW: "target",
  THREE_DAY_STREAK: "flame",
  SEVEN_DAY_STREAK: "zap",
  TEN_INTERVIEWS: "mic",
  SCORE_80_INTERVIEW: "trophy",
  FIRST_APTITUDE: "brain",
  SCORE_90_APTITUDE: "lightbulb",
  ATS_80: "file-check",
  ALL_ROUNDER: "sparkles",
};

const BadgeIcon: React.FC<BadgeIconProps> = ({ icon, earned = false, size = "md" }) => {
  const Icon = earned ? badgeIconMap[icon] ?? Target : Lock;
  const classes = sizeClasses[size];

  return (
    <div
      className={[
        classes.container,
        "shrink-0 rounded-full flex items-center justify-center transition-all",
        earned
          ? "bg-gradient-to-br from-blue-600 via-blue-500 to-amber-400 text-white shadow-lg shadow-blue-500/20"
          : "bg-slate-100 dark:bg-neutral-900 text-slate-400 dark:text-neutral-500 border border-slate-200 dark:border-neutral-700",
      ].join(" ")}
    >
      <Icon className={classes.icon} strokeWidth={2.4} aria-hidden="true" />
    </div>
  );
};

export default BadgeIcon;
