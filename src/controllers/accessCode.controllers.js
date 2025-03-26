import AccessCode from "../models/accessCode.models.js";

export const createCode = async (code, expiryDays) => {
  try {
    // Validate expiryDays
    if (!expiryDays || isNaN(expiryDays) || expiryDays < 1) {
      throw new Error("Valid expiry days (≥1) required");
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(expiryDays));

    const newCode = await AccessCode.create({
      code: code || generateRandomCode(),
      expiryDays: Number(expiryDays),
      expiresAt,
    });

    return newCode;
  } catch (error) {
    throw new Error(error.message);
  }
};

export const validateCode = async (code) => {
  return await AccessCode.findOne({
    code,
    expiresAt: { $gt: new Date() },
    isUsed: false,
  });
};

export const deleteCode = async (id) => {
  return await AccessCode.findByIdAndDelete(id);
};

export const listCodes = async () => {
  return await AccessCode.find({
    expiresAt: { $gt: new Date() },
  }).sort({ expiresAt: 1 });
};

// Helper
function generateRandomCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}