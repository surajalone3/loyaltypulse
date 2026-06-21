import { Router } from "express";
import { loadStore } from "../middleware/loadStore.js";
import {
  completeReviewRequest,
  getReviewStats,
  listReviewRequests,
  processDueReviewRequests,
  ReviewRequestServiceError,
  sendReviewRequest,
} from "../services/reviewRequests.js";

const router = Router();

router.use(loadStore);

/**
 * GET /api/reviews — list review requests for the authenticated store
 */
router.get("/", async (req, res) => {
  try {
    const store = res.locals.store;
    const payload = await listReviewRequests(store.id, req.query);
    res.json({
      shop: store.shop,
      ...payload,
    });
  } catch (error) {
    console.error("GET /api/reviews failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load review requests.",
    });
  }
});

/**
 * GET /api/reviews/stats — review request summary metrics
 */
router.get("/stats", async (req, res) => {
  try {
    const store = res.locals.store;
    const stats = await getReviewStats(store.id);
    res.json({
      shop: store.shop,
      ...stats,
    });
  } catch (error) {
    console.error("GET /api/reviews/stats failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load review stats.",
    });
  }
});

/**
 * POST /api/reviews/send — send a review request (or process due requests)
 */
router.post("/send", async (req, res) => {
  try {
    const store = res.locals.store;
    const { reviewRequestId, processDue } = req.body ?? {};

    if (processDue === true) {
      const result = await processDueReviewRequests(store.id);
      return res.json({
        success: true,
        ...result,
      });
    }

    if (!reviewRequestId || typeof reviewRequestId !== "string") {
      return res.status(400).json({
        error: "Validation failed",
        message: "reviewRequestId is required unless processDue is true",
      });
    }

    const review = await sendReviewRequest(reviewRequestId, store.id, {
      force: true,
    });

    res.json({
      success: true,
      review,
    });
  } catch (error) {
    if (error instanceof ReviewRequestServiceError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    console.error("POST /api/reviews/send failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to send review request.",
    });
  }
});

/**
 * POST /api/reviews/complete — mark a review request as completed
 */
router.post("/complete", async (req, res) => {
  try {
    const store = res.locals.store;
    const { reviewRequestId } = req.body ?? {};

    if (!reviewRequestId || typeof reviewRequestId !== "string") {
      return res.status(400).json({
        error: "Validation failed",
        message: "reviewRequestId is required",
      });
    }

    const review = await completeReviewRequest(reviewRequestId, store.id);

    res.json({
      success: true,
      review,
    });
  } catch (error) {
    if (error instanceof ReviewRequestServiceError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    console.error("POST /api/reviews/complete failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to complete review request.",
    });
  }
});

export default router;
