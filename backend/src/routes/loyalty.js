import { Router } from "express";
import { prisma } from "../shopify.js";
import { loadStore } from "../middleware/loadStore.js";
import { ensureLoyaltyProgram } from "../services/loyaltyProgram.js";

const router = Router();

router.use(loadStore);

function formatLoyaltyResponse(loyaltyProgram, store) {
  return {
    shop: store.shop,
    pointsPerDollar: loyaltyProgram.pointsPerDollar,
    rewardThreshold: loyaltyProgram.rewardThreshold,
    pointsName: loyaltyProgram.pointsName,
    isActive: loyaltyProgram.isActive,
    updatedAt: loyaltyProgram.updatedAt,
  };
}

/**
 * GET /api/loyalty — current store loyalty settings
 */
router.get("/", async (req, res) => {
  try {
    const store = res.locals.store;

    let loyaltyProgram = await prisma.loyaltyProgram.findUnique({
      where: { storeId: store.id },
    });

    if (!loyaltyProgram) {
      const ensured = await ensureLoyaltyProgram(store.id);
      loyaltyProgram = ensured.loyaltyProgram;
    }

    res.json(formatLoyaltyResponse(loyaltyProgram, store));
  } catch (error) {
    console.error("GET /api/loyalty failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to load loyalty settings.",
    });
  }
});

function parsePositiveInt(value, fieldName, errors) {
  if (value === undefined || value === null || value === "") {
    errors.push(`${fieldName} is required`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    errors.push(`${fieldName} must be an integer greater than 0`);
    return null;
  }
  return parsed;
}

function validateLoyaltyUpdate(body) {
  const errors = [];
  const pointsPerDollar = parsePositiveInt(
    body.pointsPerDollar,
    "pointsPerDollar",
    errors
  );
  const rewardThreshold = parsePositiveInt(
    body.rewardThreshold,
    "rewardThreshold",
    errors
  );

  if (body.pointsName === undefined) {
    errors.push("pointsName is required");
  } else if (
    typeof body.pointsName !== "string" ||
    body.pointsName.trim().length === 0
  ) {
    errors.push("pointsName must be a non-empty string");
  } else if (body.pointsName.length > 50) {
    errors.push("pointsName must be 50 characters or fewer");
  }

  let isActive = body.isActive;
  if (typeof isActive !== "boolean") {
    errors.push("isActive must be a boolean");
    isActive = undefined;
  }

  return {
    errors,
    pointsPerDollar,
    rewardThreshold,
    pointsName: body.pointsName,
    isActive,
  };
}

/**
 * PUT /api/loyalty — update loyalty settings for the authenticated store
 */
router.put("/", async (req, res) => {
  try {
    const {
      errors: validationErrors,
      pointsPerDollar,
      rewardThreshold,
      pointsName,
      isActive,
    } = validateLoyaltyUpdate(req.body);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        message: validationErrors.join("; "),
        fields: validationErrors,
      });
    }

    const store = res.locals.store;

    let loyaltyProgram = await prisma.loyaltyProgram.findUnique({
      where: { storeId: store.id },
    });

    if (!loyaltyProgram) {
      const ensured = await ensureLoyaltyProgram(store.id);
      loyaltyProgram = ensured.loyaltyProgram;
    }

    const updated = await prisma.loyaltyProgram.update({
      where: { id: loyaltyProgram.id },
      data: {
        pointsPerDollar,
        rewardThreshold,
        pointsName: pointsName.trim(),
        isActive,
      },
    });

    res.json(formatLoyaltyResponse(updated, store));
  } catch (error) {
    console.error("PUT /api/loyalty failed:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to update loyalty settings.",
    });
  }
});

export default router;
