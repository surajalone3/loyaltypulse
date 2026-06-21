import { processDueReviewRequests } from "./reviewRequests.js";

const REVIEW_SCHEDULER_INTERVAL_MS = 60_000;
let schedulerTimer = null;

export function startReviewRequestScheduler() {
  if (schedulerTimer) {
    return;
  }

  const tick = async () => {
    try {
      const result = await processDueReviewRequests();
      if (result.sent > 0) {
        console.log("[review-scheduler] sent due review requests", result);
      }
    } catch (error) {
      console.error("[review-scheduler] failed:", error.message);
    }
  };

  tick();
  schedulerTimer = setInterval(tick, REVIEW_SCHEDULER_INTERVAL_MS);
  console.log(
    `[review-scheduler] started (interval ${REVIEW_SCHEDULER_INTERVAL_MS}ms)`
  );
}

export function stopReviewRequestScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
