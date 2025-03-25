import { Router } from "express";
import fs from "fs";
import path from "path";
import { setInterval } from "timers";

const router = Router();
const CODES_FILE = path.join(process.cwd(), "data", "accessCodes.json");

// Helper functions
const readCodes = () => {
  if (!fs.existsSync(CODES_FILE)) return [];
  return JSON.parse(fs.readFileSync(CODES_FILE));
};

const saveCodes = (codes) => {
  fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2));
};

// Clean expired codes every hour
const cleanExpiredCodes = () => {
  const now = new Date();
  const codes = readCodes().filter((code) => {
    const createdDate = new Date(code.createdAt);
    const daysPassed = (now - createdDate) / (1000 * 60 * 60 * 24);
    return daysPassed < code.expiryDays;
  });
  saveCodes(codes);
};
setInterval(cleanExpiredCodes, 60 * 60 * 1000);

// Create new access code
router.post("/codes", (req, res) => {
  try {
    const { code, expiryDays } = req.body;

    // Validation
    if (!code || !expiryDays || isNaN(expiryDays)) {
      return res
        .status(400)
        .json({ error: "Both code and expiry days are required" });
    }
    if (expiryDays <= 0) {
      return res.status(400).json({ error: "Expiry days must be at least 1" });
    }

    const newCode = {
      id: Date.now(),
      code,
      expiryDays: Number(expiryDays),
      createdAt: new Date().toISOString(),
    };

    const codes = readCodes();
    codes.push(newCode);
    saveCodes(codes);

    res.status(201).json(newCode);
  } catch (error) {
    res.status(500).json({ error: "Failed to create code" });
  }
});

// Get all active codes
router.get("/codes", async (req, res) => {
  try {
    const now = new Date();
    let codes = readCodes();

    // Ensure codes is always an array
    if (!Array.isArray(codes)) codes = [];

    const result = codes.map((code) => {
      const createdDate = new Date(code.createdAt);
      const daysPassed = (now - createdDate) / (1000 * 60 * 60 * 24);
      const daysRemaining = code.expiryDays - daysPassed;

      return {
        ...code,
        daysRemaining: Math.max(0, Math.floor(daysRemaining)),
        status: daysRemaining > 0 ? "active" : "expired",
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json([]); // Return empty array on error
  }
});

// Delete a code
router.delete("/codes/:id", (req, res) => {
  try {
    const { id } = req.params;
    const codes = readCodes().filter((code) => code.id !== parseInt(id));
    saveCodes(codes);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete code" });
  }
});

// Validate access code
router.post("/codes/validate", (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    const now = new Date();
    const codes = readCodes();

    const foundCode = codes.find((c) => {
      const createdDate = new Date(c.createdAt);
      const daysPassed = (now - createdDate) / (1000 * 60 * 60 * 24);
      return c.code === code && daysPassed < c.expiryDays;
    });

    if (foundCode) {
      return res.json({ success: true });
    } else {
      return res.status(404).json({ error: "Invalid or expired code" });
    }
  } catch (error) {
    res.status(500).json({ error: "Validation failed" });
  }
});

export default router;