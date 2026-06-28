import React from "react";
import BadgeIcon, { badgeIconKeys, defaultBadgeIconByCode } from "./BadgeIcon";

export type AchievementBadge = {
  code: string;
  name: string;
  description: string;
  icon?: string | null;
  category?: string | null;
  earned_at?: string;
};

type AchievementUnlockedModalProps = {
  badge: AchievementBadge | null;
  open: boolean;
  onClose: () => void;
  onViewBadges: () => void;
};

const getBadgeIcon = (badge: AchievementBadge) => {
  if (badge.icon && badgeIconKeys.has(badge.icon)) return badge.icon;
  return defaultBadgeIconByCode[badge.code] || "target";
};

const AchievementUnlockedModal: React.FC<AchievementUnlockedModalProps> = ({
  badge,
  open,
  onClose,
  onViewBadges,
}) => {
  if (!open || !badge) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Close achievement modal"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm dark:bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-title"
        className="relative w-full max-w-sm scale-100 rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-2xl shadow-slate-900/20 transition duration-200 motion-safe:animate-[achievement-pop_240ms_ease-out] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-black/40"
      >
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-blue-600 dark:text-blue-300">
          Achievement Unlocked
        </p>
        <div className="mt-5 flex justify-center">
          <BadgeIcon icon={getBadgeIcon(badge)} earned size="lg" />
        </div>
        <h2 id="achievement-title" className="mt-5 text-2xl font-black text-slate-900 dark:text-neutral-100">
          {badge.name}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-neutral-400">
          {badge.description}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onViewBadges}
            className="min-h-11 rounded-2xl bg-blue-600 px-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-700"
          >
            View Badges
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-2xl border border-slate-200 px-4 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-neutral-800 dark:text-neutral-200 dark:hover:border-blue-900 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default AchievementUnlockedModal;
