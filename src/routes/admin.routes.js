import { Router } from "express";
import {
  createCode,
  validateCode,
  deleteCode,
  listCodes,
} from "../controllers/accessCode.controllers.js";
import connectDB from "../db/index.js";

const router = Router();

router.post("/codes", async (req, res) => {
  try {
    const { code, expiryDays } = req.body;

    if (!expiryDays || isNaN(expiryDays) || expiryDays < 1) {
      return res.status(400).json({ error: "Valid expiry days (≥1) required" });
    }

    const newCode = await createCode(code, expiryDays);
    res.status(201).json(newCode);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/codes", async (req, res) => {
  try {
    const codes = await listCodes();
    res.json(codes);
  } catch (error) {
    res.status(500).json([]);
  }
});

router.post("/codes/validate", async (req, res) => {
  try {
    const code = await validateCode(req.body.code);
    if (!code) {
      return res.status(404).json({ error: "Invalid or expired code" });
    }
    res.json({ valid: true, expiresAt: code.expiresAt });
  } catch (error) {
    res.status(500).json({ error: "Validation failed" });
  }
});

router.delete("/codes/:id", async (req, res) => {
  try {
    await deleteCode(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Deletion failed" });
  }
});

// Add this to admin.routes.js temporarily
router.get("/check-ttl", async (req, res) => {
  const indexes = await mongoose.connection.db
    .collection("accesscodes")
    .indexes();
  res.json(indexes);
});

export default router;