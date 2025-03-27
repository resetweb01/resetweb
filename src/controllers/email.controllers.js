import { gmail } from "../config/auth.google.js";
import { decode } from "html-entities";
import * as cheerio from "cheerio"; 

// Password Reset Request Subject in Multiple Languages
const SUBJECT_FILTERS = [
  "Complete your password reset request", // English
  "Complétez votre demande de réinitialisation de mot de passe", // French
  "Completa tu solicitud de restablecimiento de contraseña", // Spanish
  "Completa la tua richiesta di reimpostazione della password", // Italian
  "Completa sua solicitação de redefinição de senha", // Portuguese
  "Vervollständige deine Anfrage zum Zurücksetzen deines Passworts", // German
  "قم بإكمال طلب إعادة تعيين كلمة المرور الخاصة بك", // Arabic
  "パスワードリセットリクエストを完了してください", // Japanese
  "비밀번호 재설정 요청을 완료하세요", // Korean
  "Şifre sıfırlama isteğinizi tamamlayın", // Turkish
  "Selesaikan permintaanmu untuk mengatur ulang sandi", // Indonesian ✅
  "Complete su solicitud para restablecer su contraseña",
  "Completa tu solicitud de restablecimiento de contraseña",
  "Réinitialisation de mot de passe à terminer",
];

const SUBJECT_QUERY = SUBJECT_FILTERS.map((s) => `subject:"${s}"`).join(" OR ");

// ✅ Function to extract reset link from HTML content
const extractResetLinkFromHTML = (htmlContent) => {
  const $ = cheerio.load(htmlContent);

  // Find the reset password link in the email
  const resetLink = $('a:contains("Reset password")').attr("href"); // Match link by text

  // If the above doesn't work, try a more generic approach
  if (!resetLink) {
    const links = $("a"); // Get all links
    for (let i = 0; i < links.length; i++) {
      const href = $(links[i]).attr("href");
      if (href && href.includes("netflix.com/password")) {
        return href; // Return the first matching link
      }
    }
  }

  return resetLink;
};

// ✅ Function to extract relevant parts of the email
const extractRelevantContent = (emailText) => {
  // Extract greeting
  const greetingMatch = emailText.match(/Hi\s+(\w+)/);
  const greeting = greetingMatch ? `Hi ${greetingMatch[1]},` : "Hello,";

  // Extract reset password link using HTML parser
  const resetLink = extractResetLinkFromHTML(emailText);

  // Description
  const description =
    "Let's reset your password so you can get back to watching.";

  return { greeting, description, resetLink };
};

// ✅ Fetch & Filter Email Content
export const getFilteredEmails = async (req, res) => {
  const { email } = req.body;

  try {
    //  Fetch latest email
    const response = await gmail.users.messages.list({
      userId: "me",
      q: `from:(netflix.com OR netflix.net OR netflix.app) (${SUBJECT_QUERY}) to:${email}`, // Filter by recipient
      maxResults: 1,
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      return res.status(404).json({ error: "No matching emails found" });
    }

    //  Get latest email details
    const message = await gmail.users.messages.get({
      userId: "me",
      id: response.data.messages[0].id,
    });

    // Extract the "to" field from the email headers
    const toHeader = message.data.payload.headers.find(
      (header) => header.name === "To"
    );
    const toEmail = toHeader ? toHeader.value : null;

    if (!toEmail) {
      return res
        .status(404)
        .json({ error: "Recipient email not found in the email headers." });
    }

    // Extract the email address from the "to" field
    const normalizeEmail = (email) => email.trim().toLowerCase(); // Normalize email for comparison
    const recipientEmail = toEmail.match(/<([^>]+)>/)?.[1] || toEmail;

    // Check if the entered email matches the "to" email
    if (normalizeEmail(recipientEmail) !== normalizeEmail(email)) {
      return res.status(403).json({
        error: "Unauthorized email. The email was not sent to this address.",
      });
    }

    let emailBody = "";

    // Extract body content
    if (message.data.payload.parts) {
      for (const part of message.data.payload.parts) {
        if (part.mimeType === "text/html" && part.body.data) {
          emailBody = part.body.data; // Prioritize HTML content
          break;
        }
        if (part.mimeType === "text/plain" && part.body.data) {
          emailBody = part.body.data;
        }
      }
    } else if (message.data.payload.body.data) {
      emailBody = message.data.payload.body.data;
    }

    if (!emailBody) {
      return res.status(404).json({ error: "Email body not found" });
    }

    // Decode Base64 safely
    const decodedBody = Buffer.from(emailBody, "base64url").toString("utf-8");
    const fullEmailContent = decode(decodedBody);

    // Log the full email content for debugging
    // console.log("Full Email Content:", fullEmailContent);

    // Extract relevant details
    const filteredContent = extractRelevantContent(fullEmailContent);

    // Log the extracted link for debugging
    // console.log("Extracted Reset Link:", filteredContent.resetLink);

    res.json({ emailContent: filteredContent });
  } catch (error) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ error: "Failed to fetch email" });
  }
};
