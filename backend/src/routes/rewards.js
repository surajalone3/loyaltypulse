import { Router } from "express";
import { prisma } from "../shopify.js";
import { loadStore } from "../middleware/loadStore.js";

const router = Router();

router.use(loadStore);

function formatReward(reward) {
  return {
    id: reward.id,
    name: reward.name,
    description: reward.description,
    pointsRequired: reward.pointsRequired,
    isActive: reward.isActive,
    createdAt: reward.createdAt,
    updatedAt: reward.updatedAt,
  };
}

function validateRewardBody(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      errors.push("name must be a non-empty string");
    } else if (body.name.trim().length > 100) {
      errors.push("name must be 100 characters or fewer");
    } else {
      data.name = body.name.trim();
    }
  }

  if (!partial || body.description !== undefined) {
    if (
      body.description === undefined ||
      body.description === null ||
      body.description === ""
    ) {
      if (!partial) {
        data.description = null;
      } else if (body.description !== undefined) {
        data.description = null;
      }
    } else if (typeof body.description !== "string") {
      errors.push("description must be a string");
    } else if (body.description.length > 500) {
      errors.push("description must be 500 characters or fewer");
    } else {
      data.description = body.description.trim();
    }
  }

  if (!partial || body.pointsRequired !== undefined) {
    const parsed = Number(body.pointsRequired);
    if (!Number.isInteger(parsed) || parsed < 1) {
      errors.push("pointsRequired must be an integer greater than 0");
    } else {
      data.pointsRequired = parsed;
    }
  }

  if (!partial || body.isActive !== undefined) {
    if (body.isActive === undefined && !partial) {
      data.isActive = true;
    } else if (typeof body.isActive !== "boolean") {
      errors.push("isActive must be a boolean");
    } else {
      data.isActive = body.isActive;
    }
  }

  return { errors, data };
}

async function findStoreReward(storeId, rewardId) {
  return prisma.reward.findFirst({
    where: { id: rewardId, storeId },
  });
}

/**
 * GET /api/rewards — list rewards for the authenticated store
 */
router.get("/", async (req, res) => {
  try {
    const store = res.locals.store;

    const rewards = await prisma.reward.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      data: rewards.map(formatReward),
    });
  } catch (error) {
    console.error("GET /api/rewards failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load rewards.",
    });
  }
});

/**
 * POST /api/rewards — create a reward
 */
router.post("/", async (req, res) => {
  try {
    const { errors, data } = validateRewardBody(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        message: errors.join("; "),
        fields: errors,
      });
    }

    const store = res.locals.store;

    const reward = await prisma.reward.create({
      data: {
        storeId: store.id,
        name: data.name,
        description: data.description ?? null,
        pointsRequired: data.pointsRequired,
        isActive: data.isActive ?? true,
      },
    });

    res.status(201).json(formatReward(reward));
  } catch (error) {
    console.error("POST /api/rewards failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to create reward.",
    });
  }
});

/**
 * PUT /api/rewards/:id — update a reward
 */
router.put("/:id", async (req, res) => {
  try {
    const store = res.locals.store;
    const existing = await findStoreReward(store.id, req.params.id);

    if (!existing) {
      return res.status(404).json({
        error: "Not found",
        message: "Reward not found.",
      });
    }

    const { errors, data } = validateRewardBody(req.body, { partial: true });

    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        message: errors.join("; "),
        fields: errors,
      });
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        error: "Validation failed",
        message: "No valid fields to update.",
      });
    }

    const reward = await prisma.reward.update({
      where: { id: existing.id },
      data,
    });

    res.json(formatReward(reward));
  } catch (error) {
    console.error("PUT /api/rewards/:id failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to update reward.",
    });
  }
});

/**
 * DELETE /api/rewards/:id — delete a reward
 */
router.delete("/:id", async (req, res) => {
  try {
    const store = res.locals.store;
    const existing = await findStoreReward(store.id, req.params.id);

    if (!existing) {
      return res.status(404).json({
        error: "Not found",
        message: "Reward not found.",
      });
    }

    await prisma.reward.delete({
      where: { id: existing.id },
    });

    res.json({ success: true, id: existing.id });
  } catch (error) {
    console.error("DELETE /api/rewards/:id failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to delete reward.",
    });
  }
});

export default router;
