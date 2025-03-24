import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const ACCESS_CODES_FILE = path.join(process.cwd(), "data", "accessCodes.json");

// Ensure the data directory and file exist
const ensureFileExists = () => {
  const dir = path.dirname(ACCESS_CODES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  if (!fs.existsSync(ACCESS_CODES_FILE))
    fs.writeFileSync(ACCESS_CODES_FILE, JSON.stringify([]));
};

// Load access codes from file
const loadAccessCodes = () => {
  ensureFileExists();
  const data = fs.readFileSync(ACCESS_CODES_FILE);
  return JSON.parse(data);
};

// Save access codes to file
const saveAccessCodes = (codes) => {
  fs.writeFileSync(ACCESS_CODES_FILE, JSON.stringify(codes, null, 2));
};

// ✅ Automatically clean expired codes
const cleanExpiredCodes = () => {
  let codes = loadAccessCodes();
  codes = codes.filter((c) => Date.now() < c.expiry);
  saveAccessCodes(codes);
};

// ✅ Generate and store access codes
router.post("/admin/codes", (req, res) => {
  const { code, expiryDays } = req.body; // Change to expiryDays
  if (!code || !expiryDays) {
    return res.status(400).json({ error: "Code and expiryDays are required" });
  }

  const newCode = {
    id: Date.now(),
    code,
    expiry: Date.now() + expiryDays * 24 * 60 * 60 * 1000, // Convert days to milliseconds
  };

  const codes = loadAccessCodes();
  codes.push(newCode);
  saveAccessCodes(codes);

  res.status(201).json(newCode);
});

// ✅ Validate login code
router.post("/admin/validate-code", (req, res) => {
  cleanExpiredCodes();
  const { code } = req.body;
  const codes = loadAccessCodes();
  const foundCode = codes.find((c) => c.code === code);

  if (!foundCode) {
    return res.status(404).json({ success: false, message: "Code not found" });
  }

  res.json({ success: true, message: "Code validated" });
});

// ✅ Get all access codes
router.get("/admin/codes", (req, res) => {
  cleanExpiredCodes();
  res.json(loadAccessCodes());
});

// ✅ Delete an access code
router.delete("/admin/codes/:id", (req, res) => {
  const { id } = req.params;
  let codes = loadAccessCodes();
  codes = codes.filter((c) => c.id !== parseInt(id));
  saveAccessCodes(codes);

  res.json({ success: true, message: "Access code deleted" });
});

export default router;