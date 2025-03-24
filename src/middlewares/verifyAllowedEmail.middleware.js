import fs from "fs";

export const verifyAllowedEmail = (req, res, next) => {
  const { email } = req.user; // Assuming req.user contains user data
  const data = fs.readFileSync("./allowedEmails.json"); // Read file
  const { emails } = JSON.parse(data); // Parse JSON

  if (!emails.includes(email)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};
