import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();
const CODES_FILE = path.join(__dirname, "..", "data", "accessCodes.json");

// Helper functions
const readCodes = () => {
  try {
    if (!fs.existsSync(CODES_FILE)) {
      fs.mkdirSync(path.dirname(CODES_FILE), { recursive: true });
      fs.writeFileSync(CODES_FILE, JSON.stringify([]));
      return [];
    }
    const content = fs.readFileSync(CODES_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading codes:", error);
    return [];
  }
};

const saveCodes = async (codes) => {
  try {
    await fs.promises.mkdir(path.dirname(CODES_FILE), { recursive: true });
    const tempFile = CODES_FILE + ".tmp";
    await fs.promises.writeFile(tempFile, JSON.stringify(codes, null, 2));
    await fs.promises.rename(tempFile, CODES_FILE);
    console.log(`Saved ${codes.length} codes to ${CODES_FILE}`);
    return true;
  } catch (error) {
    console.error("Failed to save codes:", error);
    return false;
  }
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
router.post("/codes", async (req, res) => {
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
      expiresAt: new Date(Date.now() + expiryDays * 86400000).toISOString(),
    };

    const codes = readCodes();
    codes.push(newCode);
    const saveSuccess = await saveCodes(codes); // Wait for save to complete

    if (!saveSuccess) {
      throw new Error("Failed to save codes to file");
    }

    // Verify the code was actually saved
    const updatedCodes = readCodes();
    if (!updatedCodes.some((c) => c.id === newCode.id)) {
      throw new Error("Code not found in file after saving");
    }

    res.status(201).json(newCode);
  } catch (error) {
    console.error("Code generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate code" });
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

// setInterval(() => {
//   cleanExpiredCodes().catch(console.error);
// }, 6 * 60 * 60 * 1000);
// cleanExpiredCodes();

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
