import { Router } from "express";
import { getHouseholdNetflixEmail } from "../controllers/household.controllers.js";

const router = Router();

// Route to fetch the latest Netflix household email
router.post("/latest-household-netflix-email", getHouseholdNetflixEmail);

export default router;
