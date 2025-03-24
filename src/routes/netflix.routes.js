import express from "express";
import { requestNetflixCode } from "../controllers/netflix.controllers.js";

const router = express.Router();

// ✅ Request Netflix Code and return the fresh code
router.post("/request-code", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const codeData = await requestNetflixCode(email);

    res.json({
      message: "Netflix code requested successfully",
      code: codeData.code,
      expiresAt: codeData.expiresAt,
      emailDate: codeData.emailDate, // Include emailDate in the response
    });
  } catch (error) {
    console.error("❌ Error requesting Netflix code:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
