import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const CODES_FILE = path.join(process.cwd(), "data", "accessCodes.json");

// Helper functions
const readCodes = () => {
  if (!fs.existsSync(CODES_FILE)) return [];
  const content = fs.readFileSync(CODES_FILE);
  return JSON.parse(content);
};

const saveCodes = (codes) => {
  fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2));
};

// Simplified expiration check
const isCodeExpired = (code) => {
  if (!code.expiresAt) return true;
  return new Date() >= new Date(code.expiresAt);
};

// Clean expired codes (run this periodically)
const cleanExpiredCodes = () => {
  const codes = readCodes();
  const validCodes = codes.filter((code) => !isCodeExpired(code));
  if (validCodes.length < codes.length) {
    saveCodes(validCodes);
  }
};

// Generate new access code
router.post("/codes", (req, res) => {
  try {
    const { code, expiryDays } = req.body;

    // Validation
    if (!expiryDays || isNaN(expiryDays) || expiryDays < 1) {
      return res.status(400).json({ error: "Valid expiry days (≥1) required" });
    }

    const newCode = {
      id: Date.now(),
      code: code || Math.random().toString(36).substring(2, 10).toUpperCase(),
      expiryDays: Number(expiryDays),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiryDays * 86400000).toISOString(), // 86400000 ms/day
    };

    const codes = readCodes();
    codes.push(newCode);
    saveCodes(codes);

    // console.log(
    //   `Generated code ${newCode.code} expires at ${newCode.expiresAt}`
    // );
    res.status(201).json(newCode);
  } catch (error) {
    console.error("Code generation error:", error);
    res.status(500).json({ error: "Failed to generate code" });
  }
});

// Get all codes with accurate status
router.get("/codes", (req, res) => {
  try {
    let codes = readCodes();
    if (!Array.isArray(codes)) codes = [];

    // Validate all codes have required fields
    const validatedCodes = codes.map((code) => {
      if (!code.expiresAt) {
        console.error("Invalid code missing expiresAt:", code);
        return {
          ...code,
          expiresAt: new Date(Date.now() + 86400000).toISOString(), // Default 1 day
          status: "invalid",
        };
      }
      return code;
    });

    res.json(validatedCodes);
  } catch (error) {
    console.error("Failed to fetch codes:", error);
    res.status(500).json([]);
  }
});

// Validate code
router.post("/codes/validate", (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Code required" });

    const codes = readCodes();
    const foundCode = codes.find((c) => c.code === code);

    if (!foundCode) {
      // console.log(`Validation failed: Code ${code} not found`);
      return res.status(404).json({ error: "Code not found" });
    }

    if (isCodeExpired(foundCode)) {
      // console.log(
      //   `Validation failed: Code ${code} expired at ${foundCode.expiresAt}`
      // );
      return res.status(400).json({ error: "Code expired" });
    }

    console.log(`Validation success for code ${code}`);
    res.json({
      success: true,
      expiresAt: foundCode.expiresAt,
      daysRemaining: Math.ceil(
        (new Date(foundCode.expiresAt) - new Date()) / 86400000
      ),
    });
  } catch (error) {
    console.error("Validation error:", error);
    res.status(500).json({ error: "Validation failed" });
  }
});

// Delete code
router.delete("/codes/:id", (req, res) => {
  try {
    const codes = readCodes().filter((c) => c.id !== parseInt(req.params.id));
    saveCodes(codes);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Deletion failed" });
  }
});

// Clean expired codes every hour
setInterval(cleanExpiredCodes, 3600000);
cleanExpiredCodes();

// Add this before export default router
router.get("/debug-code/:id", (req, res) => {
  const codes = readCodes();
  const code = codes.find((c) => c.id == req.params.id);

  if (!code) return res.status(404).json({ error: "Not found" });

  res.json({
    id: code.id,
    code: code.code,
    createdAt: new Date(code.createdAt),
    expiresAt: new Date(code.expiresAt),
    now: new Date(),
    daysRemaining: (new Date(code.expiresAt) - new Date()) / 86400000,
    isValid: new Date() < new Date(code.expiresAt),
  });
});

export default router;