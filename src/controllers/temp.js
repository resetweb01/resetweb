import { gmail } from "../config/auth.google.js";

export const getHouseholdNetflixEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    // Fetch the latest email with the subject
    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: 1,
      q: 'subject:"Important: How to update your Netflix household" OR subject:"Your Netflix temporary access code"',
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
      return res
        .status(404)
        .json({ message: "Recipient email not found in the email headers." });
    }

    // Extract the email address from the "to" field
    const toEmail = toHeader.match(/<([^>]+)>/)?.[1] || toHeader;

    // Check if the entered email matches the "to" email
    if (toEmail !== email) {
      return res.status(403).json({
        message: "Unauthorized email. The email was not sent to this address.",
      });
    }

    // Extract other email details
    const subject =
      headers.find((h) => h.name === "Subject")?.value || "No Subject";
    const from =
      headers.find((h) => h.name === "From")?.value || "Unknown Sender";
    const dateHeader =
      headers.find((h) => h.name === "Date")?.value || "Unknown Date";

    // Convert the email date to a timestamp
    const emailDate = new Date(dateHeader).getTime(); // Convert to milliseconds
    const currentTime = Date.now(); // Current time in milliseconds
    const timeDifference = currentTime - emailDate; // Difference in milliseconds

    // Check if the email is older than 15 minutes
    const FIFTEEN_MINUTES = 15 * 60 * 1000; // 15 minutes in milliseconds
    if (timeDifference > FIFTEEN_MINUTES) {
      return res.status(400).json({
        message: "The email link has expired. Please request again.",
      });
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

    // ✅ Remove unwanted content from the email body
    const unwantedContent = [
      "If you did not initiate this request, consider",
      "did not initiate this request,",
      "Keep your account secure:",
      "we recommend that you immediately",
      "sign out of all devices that you",

      "If you ",
      "know who this was,",
      "You can also",
      "change your password",
      "don",
      " /a>.",
      "recognise",
      "recognize",
      "Netflix International B.V.",
      "Notification Settings",
      "Terms of Use",
      "Privacy",
      "We're here to help",
      "Visit the for more info.",
      "If you did not initiate this request,",
      "please consider",
      "changing your password.",
      "Questions? Visit the Help Center",
      "Netflix Services Canada ULC",
      "1200 Waterfront Centre, 200 Burrard St, Vancouver, BC V7X 1T2, Canada",
      "The Netflix team",
      "'t't",
    ];

    // Preserve the link and button HTML
    const linkButtonRegex = /<a[^>]*class="[^"]*button[^"]*"[^>]*>.*?<\/a>/g;
    const linkButtonMatch = emailBody.match(linkButtonRegex);
    const linkButtonHtml = linkButtonMatch ? linkButtonMatch[0] : "";

    unwantedContent.forEach((content) => {
      emailBody = emailBody.replace(new RegExp(content, "gi"), "");
    });

    emailBody = emailBody.replace(/Hi\s+[^,]+,\s*/g, ""); // removing the greeting
    // emailBody = emailBody.replace(/<div[^>]*>.*?<\/div>/g, ""); // Remove all div tags
    emailBody = emailBody.replace(/<p[^>]*>.*?<\/p>/g, "");

    emailBody += linkButtonHtml;

    return res.status(200).json({
      requesterEmail: email,
      from,
      subject,
      date: dateHeader,
      emailBody,
    });
  } catch (error) {
    // console.error("Error fetching email:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
