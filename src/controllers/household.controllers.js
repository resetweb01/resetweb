import { gmail } from "../config/auth.google.js";
import moment from "moment";
import { RateLimiterMemory } from "rate-limiter-flexible";
import NodeCache from "node-cache";

// Cache for subject lines (filtered to remove empty strings)
const NETFLIX_SUBJECTS = [
  "Kode akses sementara Netflix-mu",
  "Kode akses sementaramu",
  "Tu código de acceso temporal",
  "Tu código de acceso temporal de Netflix",
  "Importante: Cómo actualizar tu Hogar con Netflix",
  "Kode akses sementara Netflix-mu",
  "ข้อมูลสำคัญ: วิธีอัปเดตครัวเรือน Netflix",
  "รหัสการเข้าถึงชั่วคราวของ Netflix ของคุณ",
  "Penting: Cara memperbarui Rumah dengan Akun Netflix-mu",
  "Important : Comment mettre à jour votre foyer Netflix",
  "Votre code d'accès temporaire Netflix",
  "Important: How to update your Netflix Household",
  "Your Netflix temporary access code",
].filter(Boolean); // Remove any empty strings

// Cache for email lookups (5-minute TTL)
const emailCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Rate limiter (15 requests per minute per IP)
const rateLimiter = new RateLimiterMemory({
  points: 15,
  duration: 60,
});

// Helper function to parse email dates robustly
const parseEmailDate = (dateHeader) => {
  try {
    return new Date(dateHeader);
  } catch (e) {
    return new Date(); // Fallback to current time if parsing fails
  }
};

export const getHouseholdNetflixEmail = async (req, res) => {
  try {
    // Rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;
    try {
      await rateLimiter.consume(clientIP);
    } catch (rateLimiterRes) {
      return res.status(429).json({
        message: "Too many requests. Please try again in a minute.",
      });
    }

    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Valid email is required." });
    }

    // Create time-based cache key to prevent stale results
    const timeWindow = Math.floor(Date.now() / (15 * 60 * 1000)); // 15-minute windows
    const cacheKey = `netflix-email-${email}-${timeWindow}`;

    const cachedResult = emailCache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }

    // Calculate time boundary (15 minutes ago)
    const timeBoundary = new Date(Date.now() - 15 * 60 * 1000);

    // Build optimized Gmail query
    const subjectQuery = NETFLIX_SUBJECTS.map((s) => `subject:"${s}"`).join(
      " OR "
    );
    const query = `(${subjectQuery}) to:${email} after:${Math.floor(
      timeBoundary.getTime() / 1000
    )}`;

    try {
      // Fetch the newest matching email
      const listResponse = await gmail.users.messages.list({
        userId: "me",
        maxResults: 3, // Get top 3 in case first has parsing issues
        q: query,
        orderBy: "date desc",
      });

      if (!listResponse.data.messages?.length) {
        return res.status(404).json({
          message:
            "No valid email found. Please request a new verification email.",
        });
      }

      // Process messages in order until we find a valid one
      for (const msg of listResponse.data.messages) {
        try {
          const message = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "full",
          });

          // Verify date is within window (double-check)
          const dateHeader = message.data.payload.headers.find(
            (h) => h.name === "Date"
          )?.value;
          const emailDate = parseEmailDate(dateHeader);

          if (emailDate < timeBoundary) continue;

          // Extract HTML body (handles different email structures)
          let emailBody = "";
          const parts = message.data.payload.parts || [];
          const htmlPart = parts.find((p) => p.mimeType === "text/html");

          if (htmlPart) {
            emailBody = Buffer.from(htmlPart.body.data, "base64").toString(
              "utf-8"
            );
          } else if (message.data.payload.body?.data) {
            emailBody = Buffer.from(
              message.data.payload.body.data,
              "base64"
            ).toString("utf-8");
          }

          if (!emailBody) continue;

          // Extract verification link
          const buttonRegex =
            /<a[^>]*>(Yes, this was me|Get Code|Dapatkan Kode|Ya, Ini Aku|Oui, c'était moi|Obtenir le code|Sí, la envié yo|Obtener código|Ya, Itu Saya|Sí, fui yo|รับรหัส|ใช่แล้ว นี่คือฉัน)<\/a>/i;
          const hrefMatch = emailBody.match(
            /<a[^>]+href="([^"]+)"[^>]*>(?:Yes, this was me|Get Code|Dapatkan Kode|Ya, Ini Aku)/i
          );
          const extractedLink = hrefMatch?.[1];

          if (!extractedLink) continue;

          // Prepare response
          const responseData = {
            requesterEmail: email,
            verificationLink: extractedLink,
            emailReceivedAt: moment(emailDate).format("MMMM Do, h:mm A"),
          };

          // Cache the result
          emailCache.set(cacheKey, responseData);

          return res.status(200).json(responseData);
        } catch (e) {
          console.warn(`Error processing message ${msg.id}:`, e.message);
          continue; // Try next message if this one fails
        }
      }

      return res.status(404).json({
        message: "No valid email could be processed. Please try again.",
      });
    } catch (error) {
      console.error("Gmail API error:", error.message);
      return res.status(503).json({
        message: "Temporary service issue. Please try again shortly.",
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
