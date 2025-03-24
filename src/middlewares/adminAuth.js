import "dotenv/config";

export const verifyAdmin = (req, res, next) => {
  const { adminPassword } = req.body; // Get password from request body

  if (!adminPassword) {
    return res.status(400).json({ error: "Admin password required" });
  }

  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Invalid admin password" });
  }

  next(); // Proceed to next middleware
};
