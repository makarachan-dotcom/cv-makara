"use client";

interface Props {
  currentCount: number;
  streakTarget: number;
  lastCheckInDate: string | null;
  today: string;
}

/**
 * 7-day streak progress matrix used inside the locked-template modal.
 * Renders exactly N tiles where N === streakTarget (currently 7). The first
 * `currentCount` are filled. The next one — today's slot — is highlighted if
 * the user hasn't yet checked in today.
 */
export function StreakMatrix({ currentCount, streakTarget, lastCheckInDate, today }: Props) {
  const tiles = Array.from({ length: streakTarget });
  const todayUnclaimed = lastCheckInDate !== today;
  const remaining = Math.max(0, streakTarget - currentCount);

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-4">
      <header className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-widest text-ink-100">
          Day {Math.min(currentCount, streakTarget)}/{streakTarget} tracked
        </h4>
        <span className="text-xs text-ink-200">
          {remaining > 0
            ? `${remaining} more consecutive check-in${remaining === 1 ? "" : "s"} to unlock`
            : "Streak complete — premium matrix unlocked"}
        </span>
      </header>

      <ol className="mt-3 grid grid-cols-7 gap-2" aria-label="Streak progress">
        {tiles.map((_, i) => {
          const filled = i < currentCount;
          const isTodaySlot = i === currentCount && todayUnclaimed;
          return (
            <li
              key={i}
              aria-current={isTodaySlot ? "step" : undefined}
              className={
                "flex aspect-square items-center justify-center rounded-md border text-xs font-mono " +
                (filled
                  ? "border-accent-cyan bg-accent-cyan/20 text-accent-cyan"
                  : isTodaySlot
                  ? "border-accent-gold bg-accent-gold/10 text-accent-gold"
                  : "border-ink-700 bg-ink-800 text-ink-200")
              }
            >
              {i + 1}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
