import { gmail } from "../config/auth.google.js";
import moment from "moment";

export const getHouseholdNetflixEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    // List of subject lines in different languages
    const subjects = [
      "Kode akses sementara Netflix-mu",
      "Kode akses sementaramu",
      "Tu código de acceso temporal",
      "Tu código de acceso temporal de Netflix",// spanish(Your Netflix temporary access code)
      "Importante: Cómo actualizar tu Hogar con Netflix", // Spanish
      "",
      "Kode akses sementara Netflix-mu", // indonesian
      "ข้อมูลสำคัญ: วิธีอัปเดตครัวเรือน Netflix", // Thai
      "รหัสการเข้าถึงชั่วคราวของ Netflix ของคุณ", // Thai(Your Netflix temporary access code)
      "Penting: Cara memperbarui Rumah dengan Akun Netflix-mu",
      "Tu código de acceso temporal de Netflix",

      "Important : Comment mettre à jour votre foyer Netflix", // French
      "Votre code d'accès temporaire Netflix", // french(Your Netflix temporary access code)
      "Important: How to update your Netflix household",
      "Your Netflix temporary access code",
    ];

    // Create a query string for the Gmail API
    const query = subjects
      .map((subject) => `subject:"${subject}"`)
      .join(" OR ");

    // Fetch the latest email with the required subject
    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: 1,
      q: query,
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      return res.status(404).json({ message: "No relevant email found!" });
    }

    // Get the latest email ID
    const messageId = response.data.messages[0].id;

    // Fetch the email details
    const message = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
    });

    const headers = message.data.payload.headers;

    // Extract the "to" field from the email headers
    const toHeader = headers.find((h) => h.name === "To")?.value || null;
    if (!toHeader) {
      return res.status(404).json({ message: "Recipient email not found." });
    }

    // Extract the email address from the "to" field
    const toEmail = toHeader.match(/<([^>]+)>/)?.[1] || toHeader;
    if (toEmail !== email) {
      return res.status(403).json({ message: "Unauthorized email." });
    }

    // Extract the email date
    const dateHeader =
      headers.find((h) => h.name === "Date")?.value || "Unknown Date";
    const emailDate = new Date(dateHeader).getTime();
    const formattedDate = moment(emailDate).format("MMMM Do, h:mm A"); // Example: "March 23rd, 12:58 PM"

    const currentTime = Date.now();
    const timeDifference = currentTime - emailDate;
    const FIFTEEN_MINUTES = 15 * 60 * 1000; // 15 minutes in milliseconds

    if (timeDifference > FIFTEEN_MINUTES) {
      return res
        .status(400)
        .json({ message: "The email link has expired. Please request again." });
    }

    // Extract the email body
    const emailParts = message.data.payload.parts || [];
    let emailBody = "";
    for (const part of emailParts) {
      if (part.mimeType === "text/html") {
        emailBody = Buffer.from(part.body.data, "base64").toString("utf-8");
        break;
      }
    }

    if (!emailBody) {
      return res.status(404).json({ message: "No email content found!" });
    }

    // Extract the correct link from the email
    const buttonRegex =
      /<a[^>]*>(Yes, this was me|Get Code|Dapatkan Kode|Ya, Ini Aku|Oui, c'était moi|Obtenir le code|Sí, la envié yo|Obtener código|Ya, Itu Saya|Sí, fui yo|รับรหัส|ใช่แล้ว นี่คือฉัน|Oui, c'était moi)<\/a>/i;
    const match = emailBody.match(buttonRegex);
    let extractedLink = null;

    if (match) {
      const anchorTag = match[0];
      const hrefMatch = anchorTag.match(/href="([^"]+)"/);
      extractedLink = hrefMatch ? hrefMatch[1] : null;
    }

    if (!extractedLink) {
      return res.status(404).json({ message: "Verification link not found!" });
    }

    return res.status(200).json({
      requesterEmail: email,
      verificationLink: extractedLink,
      emailReceivedAt: formattedDate, // Formatted email timestamp
    });
  } catch (error) {
    console.error("Error fetching email:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
