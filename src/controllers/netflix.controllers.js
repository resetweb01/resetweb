import fs from "fs";
import path from "path";
import { gmail } from "../config/auth.google.js";
import { decode } from "html-entities";

const codesFilePath = path.join(process.cwd(), "codes.json");

// Netflix Sign-in Code Subjects in Multiple Languages
const SUBJECT_FILTERS = [
  "Your Netflix sign-in code", // English
  "Netflix: Your sign-in code",
  "Netflix: Ihr Login-Code", // German
  "Netflix: seu código de acesso", // Portuguese
  "Netflix : Votre code d'identification", // French
  "Netflix: Tu código de inicio de sesión", // Spanish
  "Netflix: รหัสเข้าสู่ระบบของคุณ", // Thai
  "Netflix: Kode masukmu", // Indonesian
];

const SUBJECT_QUERY = SUBJECT_FILTERS.map((s) => `subject:"${s}"`).join(" OR ");

// ✅ Load stored codes & remove expired ones
const loadCodes = () => {
  if (!fs.existsSync(codesFilePath)) return {};

  try {
    const codes = JSON.parse(fs.readFileSync(codesFilePath, "utf-8"));
    const currentTime = Date.now();

    // Remove expired codes
    Object.keys(codes).forEach((email) => {
      if (codes[email].expiresAt < currentTime) {
        delete codes[email];
      }
    });

    return codes;
  } catch (error) {
    console.error("❌ Error reading codes file:", error);
    return {};
  }
};

// ✅ Save updated codes
const saveCodes = (codes) => {
  try {
    fs.writeFileSync(codesFilePath, JSON.stringify(codes, null, 2));
  } catch (error) {
    console.error("❌ Error saving codes file:", error);
  }
};

// ✅ Extract Netflix Code from Email Content
const extractNetflixCode = (emailText) => {
  const codeMatch = emailText.match(/\b\d{4,6}\b/);
  return codeMatch
    ? { code: codeMatch[0], expiresAt: Date.now() + 15 * 60 * 1000 } // Code expires in 15 minutes
    : null;
};

// ✅ Fetch Latest Netflix Code from Gmail
export const requestNetflixCode = async (email) => {
  console.log("🔹 Request received for email:", email);

  if (!email) {
    throw new Error("Email is required");
  }

  try {
    // Fetch the latest email from Gmail
    const response = await gmail.users.messages.list({
      userId: "me",
      q: `from:(netflix.com) (${SUBJECT_QUERY}) to:${email}`, // Updated: Include multiple subject filters
      maxResults: 1,
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      throw new Error("No Netflix codes found");
    }

    const message = await gmail.users.messages.get({
      userId: "me",
      id: response.data.messages[0].id,
    });

    // Check the email timestamp
    const emailDateHeader = message.data.payload.headers.find(
      (header) => header.name === "Date"
    );
    const emailDate = emailDateHeader ? new Date(emailDateHeader.value) : null;

    if (!emailDate) {
      throw new Error("Email date not found");
    }

    const currentTime = new Date();
    const emailAgeInMinutes = (currentTime - emailDate) / (1000 * 60);

    if (emailAgeInMinutes > 15) {
      throw new Error(
        "The Netflix code has expired. Please request a new one."
      );
    }

    let emailBody = "";
    if (message.data.payload.parts) {
      for (const part of message.data.payload.parts) {
        if (part.mimeType === "text/plain" && part.body.data) {
          emailBody = part.body.data;
          break;
        }
        if (part.mimeType === "text/html" && part.body.data) {
          emailBody = part.body.data;
        }
      }
    } else if (message.data.payload.body?.data) {
      emailBody = message.data.payload.body.data;
    }

    if (!emailBody) {
      throw new Error("Email body not found");
    }

    const decodedBody = Buffer.from(emailBody, "base64").toString("utf-8");
    const fullEmailContent = decode(decodedBody);

    // Extract the "to" field from the email headers
    const toHeader = message.data.payload.headers.find(
      (header) => header.name === "To"
    );
    const toEmail = toHeader ? toHeader.value : null;

    if (!toEmail) {
      throw new Error("Recipient email not found in the email headers");
    }

    // Check if the entered email matches the "to" email
    if (toEmail !== email) {
      throw new Error(
        "Unauthorized email. The code was not sent to this email address."
      );
    }

    const extractedCode = extractNetflixCode(fullEmailContent);

    if (!extractedCode) {
      throw new Error("Netflix code not found");
    }

    // ✅ Store the new code
    const codes = loadCodes();
    codes[email] = { ...extractedCode, emailDate: emailDate.toISOString() };
    saveCodes(codes);

    return {
      code: extractedCode.code,
      expiresAt: extractedCode.expiresAt,
      emailDate: emailDate.toISOString(), // Send the email timestamp to the frontend
    };
  } catch (error) {
    console.error("❌ Error fetching Netflix code:", error);
    throw new Error(error.message || "Failed to fetch Netflix code");
  }
};

