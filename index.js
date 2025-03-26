import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./src/db/index.js";
import emailRoutes from "./src/routes/email.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import householdRoutes from "./src/routes/household.routes.js";
import { verifyAllowedEmail } from "./src/middlewares/verifyAllowedEmail.middleware.js";
import netflixRoutes from "./src/routes/netflix.routes.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

app.use(
  cors({
    origin: [
      "https://kratosvs.com/",
      process.env.FRONTEND_URL,
      "http://localhost:5000",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"], // Ensure allowed methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow necessary headers
  })
);

app.use(express.json());

// Routes
app.use("/api/email", emailRoutes);
app.use("/api/netflix", netflixRoutes);
app.use("/api", adminRoutes);
app.use("/api", householdRoutes);

// Example of a protected route using verifyAllowedEmail middleware
app.get("/protected-route", verifyAllowedEmail, (req, res) => {
  res.json({ message: "You have access to this route" });
});

//  Serve Frontend (Only if dist/ exists)
const frontendPath = path.join(__dirname, "dist");

if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
} else {
  console.error(
    "❌ dist folder not found. Did you run `npm run build` in frontend?"
  );
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// ✅ Connect to Database and Start Server
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MONGO DB connection failed:", err);
  });
