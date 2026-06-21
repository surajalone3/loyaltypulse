import { prisma } from "../shopify.js";
import { ensureLoyaltyProgram } from "./loyaltyProgram.js";

export class LoyaltySettingsError extends Error {
  constructor(message, statusCode = 400, fields = []) {
    super(message);
    this.name = "LoyaltySettingsError";
    this.statusCode = statusCode;
    this.fields = fields;
  }
}

function normalizeProgramName(programName) {
  return programName.trim();
}

function pointsLabelFromProgramName(programName) {
  return normalizeProgramName(programName).toLowerCase();
}

export function formatLoyaltySettings(loyaltyProgram, store) {
  return {
    shop: store.shop,
    programName: loyaltyProgram.programName,
    pointsPerDollar: loyaltyProgram.pointsPerDollar,
    welcomeBonus: loyaltyProgram.welcomeBonus,
    referralBonus: loyaltyProgram.referralBonus,
    reviewRequestDelayDays: loyaltyProgram.reviewRequestDelayDays,
    reviewRequestsEnabled: loyaltyProgram.reviewRequestsEnabled,
    programEnabled: loyaltyProgram.isActive,
    updatedAt: loyaltyProgram.updatedAt,
  };
}

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

function parseNonNegativeInt(value, fieldName, errors) {
  if (value === undefined || value === null || value === "") {
    errors.push(`${fieldName} is required`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    errors.push(`${fieldName} must be a whole number of 0 or greater`);
    return null;
  }
  return parsed;
}

export function validateLoyaltySettingsUpdate(body) {
  const errors = [];

  const pointsPerDollar = parsePositiveInt(
    body.pointsPerDollar,
    "pointsPerDollar",
    errors
  );
  const welcomeBonus = parseNonNegativeInt(body.welcomeBonus, "welcomeBonus", errors);
  const referralBonus = parseNonNegativeInt(
    body.referralBonus,
    "referralBonus",
    errors
  );
  const reviewRequestDelayDays = parseNonNegativeInt(
    body.reviewRequestDelayDays,
    "reviewRequestDelayDays",
    errors
  );

  let reviewRequestsEnabled = body.reviewRequestsEnabled;
  if (typeof reviewRequestsEnabled !== "boolean") {
    errors.push("reviewRequestsEnabled must be a boolean");
    reviewRequestsEnabled = undefined;
  }

  let programName;
  if (body.programName === undefined) {
    errors.push("programName is required");
  } else if (
    typeof body.programName !== "string" ||
    body.programName.trim().length === 0
  ) {
    errors.push("programName must be a non-empty string");
  } else if (body.programName.trim().length > 50) {
    errors.push("programName must be 50 characters or fewer");
  } else {
    programName = normalizeProgramName(body.programName);
  }

  let programEnabled = body.programEnabled;
  if (programEnabled === undefined && body.isActive !== undefined) {
    programEnabled = body.isActive;
  }
  if (typeof programEnabled !== "boolean") {
    errors.push("programEnabled must be a boolean");
    programEnabled = undefined;
  }

  return {
    errors,
    programName,
    pointsPerDollar,
    welcomeBonus,
    referralBonus,
    reviewRequestDelayDays,
    reviewRequestsEnabled,
    programEnabled,
  };
}

export async function getLoyaltySettingsForStore(store) {
  let loyaltyProgram = await prisma.loyaltyProgram.findUnique({
    where: { storeId: store.id },
  });

  if (!loyaltyProgram) {
    const ensured = await ensureLoyaltyProgram(store.id);
    loyaltyProgram = ensured.loyaltyProgram;
  }

  return loyaltyProgram;
}

export async function getLoyaltySettings(store) {
  const loyaltyProgram = await getLoyaltySettingsForStore(store);
  return formatLoyaltySettings(loyaltyProgram, store);
}

export async function updateLoyaltySettings(store, body) {
  const {
    errors,
    programName,
    pointsPerDollar,
    welcomeBonus,
    referralBonus,
    reviewRequestDelayDays,
    reviewRequestsEnabled,
    programEnabled,
  } = validateLoyaltySettingsUpdate(body);

  if (errors.length > 0) {
    throw new LoyaltySettingsError(errors.join("; "), 400, errors);
  }

  const loyaltyProgram = await getLoyaltySettingsForStore(store);

  const updated = await prisma.loyaltyProgram.update({
    where: { id: loyaltyProgram.id },
    data: {
      programName,
      pointsPerDollar,
      welcomeBonus,
      referralBonus,
      reviewRequestDelayDays,
      reviewRequestsEnabled,
      isActive: programEnabled,
      pointsName: pointsLabelFromProgramName(programName),
    },
  });

  return formatLoyaltySettings(updated, store);
}

export function getPublicProgramLabel(loyaltyProgram) {
  return loyaltyProgram.programName || loyaltyProgram.pointsName || "points";
}
