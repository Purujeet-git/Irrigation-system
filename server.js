import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import apiRoutes from "./routes/api.js";
import authRoutes from "./routes/auth.js";
import Field from "./models/Field.js";
import { getCoordinates, getCurrentWeather } from "./utils/weather.js";
import { sendESPCommand, sendIrrigationEmail, sendPushNotification } from "./utils/notifications.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// API Routes (admin routes are nested inside api router as /api/admin/*)
app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Fallback for HTML (SPA-like behavior for non-API GET requests)
app.use((req, res, next) => {
  if (req.method !== "GET" || req.originalUrl.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Background Weather Sync Job (Runs every 1 hour)
setInterval(async () => {
  console.log("Starting hourly weather sync for all fields...");

  const fields = await Field.find();

  for (const field of fields) {
    // Skip orphaned fields (prevents validation errors on save)
    if (!field.userId) continue;

    const weather = await getCurrentWeather(field.latitude, field.longitude);

    if (weather) {
      field.temperature = weather.temperature;
      field.moisture = weather.humidity;
      field.lastUpdated = Date.now();

      try {
        await field.save(); // ✅ update existing field
      } catch (err) {
        console.error(`Failed to sync weather for field ${field.name}:`, err.message);
      }
    }
  }
}, 60 * 60 * 1000);

// Background Irrigation Monitor (Runs every 10 minutes)
setInterval(async () => {
  console.log("Checking for fields due for irrigation...");
  try {
    // Only fetch fields that have a valid user
    const fields = await Field.find().populate('userId');
    const now = new Date();

    for (const field of fields) {
      if (!field.userId) continue; // Skip orphaned fields

      const dueTime = new Date(field.lastUpdated).getTime() + (24 * 60 * 60 * 1000);
      
      // If due AND we haven't sent a notification for this cycle
      if (now.getTime() > dueTime && (!field.lastNotificationSent || field.lastNotificationSent < field.lastUpdated)) {
        console.log(`[ALERT] Field "${field.name}" is due. Sending notifications...`);
        
        // 1. Update DB state
        field.espCommand = "ON";
        field.lastNotificationSent = now;
        await field.save();

        // 2. Send ESP Command
        await sendESPCommand(field.name, "ON");

        // 3. Send Email
        if (field.userId && field.userId.email) {
          await sendIrrigationEmail(field.userId.email, field.userId.name, field.name);
        }

        // 4. Send Push Notification
        if (field.userId && field.userId.pushSubscription) {
          await sendPushNotification(
            field.userId.pushSubscription,
            `🚨 Irrigation Due: ${field.name}`,
            `${field.name} needs attention immediately! ESP command ON sent.`
          );
        }
      }
    }
  } catch (err) {
    console.error("Irrigation Monitor Error:", err);
  }
}, 10 * 60 * 1000);
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log("Connected to MongoDB cluster!");
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}).catch(err => {
  console.error("MongoDB connection error:", err);
});
