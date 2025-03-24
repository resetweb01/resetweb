import { Router } from "express";
import { getFilteredEmails } from "../controllers/email.controllers.js";

const router = Router();

router.route("/request-link").post(getFilteredEmails);

export default router;
