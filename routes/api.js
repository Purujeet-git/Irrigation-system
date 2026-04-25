import express from "express";
import Field from "../models/Field.js";
import Crop from "../models/Crop.js";
import User from "../models/User.js";
import IrrigationLog from "../models/IrrigationLog.js";
import SystemSettings from "../models/SystemSettings.js";
import mongoose from "mongoose";
import { getCoordinates, getCurrentWeather, getTomorrowForecast } from "../utils/weather.js";
import adminRoutes from "./admin.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Mount admin sub-routes here (Express 5 fix: nested mount works reliably)
router.use("/admin", adminRoutes);

// Protect all following routes
router.use(protect);

// Push Subscription
router.post("/subscribe", async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.pushSubscription = req.body;
    await user.save();
    res.json({ message: "Subscribed to push notifications" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get system settings (for broadcasts)
router.get("/settings", async (req, res) => {
  try {
    const settings = await SystemSettings.findOne();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all crops
router.get("/crops", async (req, res) => {
  try {
    const crops = await Crop.find();
    res.json(crops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seed default crops & dummy user
router.post("/crops/seed", async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.create({ name: "John Doe (Demo Farmer)", role: "Farmer" });
    }

    const count = await Crop.countDocuments();
    if (count === 0) {
      await Crop.insertMany([
        { 
          name: "Rice", 
          stages: {
            initial: { days: 20, water: 8 },
            growth: { days: 30, water: 12 },
            mid: { days: 40, water: 15 },
            late: { days: 20, water: 10 }
          },
          minMoisture: 50, maxMoisture: 80, temperatureRange: { min: 20, max: 35 } 
        },
        { 
          name: "Wheat", 
          stages: {
            initial: { days: 15, water: 4 },
            growth: { days: 25, water: 7 },
            mid: { days: 50, water: 9 },
            late: { days: 20, water: 5 }
          },
          minMoisture: 30, maxMoisture: 60, temperatureRange: { min: 10, max: 25 } 
        }
      ]);
      return res.json({ message: "Seeded crops" });
    }
    res.json({ message: "Crops already exist" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update crop
router.put("/crops/:id", async (req, res) => {
  try {
    const crop = await Crop.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(crop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new crop
router.post("/crops", async (req, res) => {
  try {
    const crop = new Crop(req.body);
    await crop.save();
    res.status(201).json(crop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete crop
router.delete("/crops/:id", async (req, res) => {
  try {
    await Crop.findByIdAndDelete(req.params.id);
    res.json({ message: "Crop deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all fields for the logged in user (or for a specific user if admin)
router.get("/fields", async (req, res) => {
  try {
    let query = { userId: req.user.id };
    
    // Admin View-As logic
    if (req.user.role === 'Admin' && req.query.userId) {
      query = { userId: req.query.userId };
    }

    const fields = await Field.find(query).populate("cropId");
    res.json(fields);
  } catch (err) {
    console.error("Fetch Fields Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Create field
router.post("/fields", async (req, res) => {
  try {
    const fieldData = { ...req.body, userId: req.user.id };

    // Fetch real weather for the location
    const coords = await getCoordinates(fieldData.location);
    if (coords) {
      fieldData.latitude = coords.lat;
      fieldData.longitude = coords.lon;
      const weather = await getCurrentWeather(coords.lat, coords.lon);
      if (weather) {
        fieldData.temperature = weather.temperature;
        fieldData.moisture = weather.humidity; // mapping humidity to the 'moisture' field
      }
    }

    const field = new Field({ ...fieldData, soilMoisture: 60 });
    await field.save();
    res.status(201).json(field);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Weather Forecast for main widget
router.get("/weather/forecast", async (req, res) => {
  try {
    // Get the first field to determine the primary location
    const field = await Field.findOne();
    let locationName = field ? field.location : "London";
    console.log(`Fetching main weather forecast for: ${locationName}`);
    let coords = null;

    if (field && field.latitude && field.longitude) {
      coords = { lat: field.latitude, lon: field.longitude };
    } else {
      coords = await getCoordinates(locationName);
      // Fallback to London if geocoding fails
      if (!coords) {
        locationName = "London (Fallback)";
        coords = await getCoordinates("London");
      }
    }

    if (!coords) return res.status(404).json({ error: "Location not found" });

    const current = await getCurrentWeather(coords.lat, coords.lon);
    const forecast = await getTomorrowForecast(coords.lat, coords.lon);

    console.log(`Weather fetch success: ${current ? 'Current data OK' : 'Current data NULL'}, ${forecast ? 'Forecast data OK' : 'Forecast data NULL'}`);

    res.json({
      location: locationName,
      current: current || { temperature: "--" },
      forecast: forecast || { isRainExpected: false, rainAmount: 0, maxTemp: "--" }
    });
  } catch (err) {
    console.error(`Weather forecast route error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Delete field
router.delete("/fields/:id", async (req, res) => {
  try {
    await Field.findByIdAndDelete(req.params.id);
    await IrrigationLog.deleteMany({ fieldId: req.params.id });
    res.json({ message: "Field deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Irrigate Field & Log Water Usage
// Irrigate Field & Log Water Usage (FINAL VERSION)
router.post("/fields/:id/irrigate", async (req, res) => {
  try {
    // Check if system is halted
    const settings = await SystemSettings.findOne();
    if (settings && settings.isIrrigationHalted) {
      return res.status(403).json({ error: "Irrigation is temporarily halted by the Admin." });
    }

    // Get field + crop
    const field = await Field.findById(req.params.id).populate("cropId");
    if (!field) return res.status(404).json({ error: "Field not found" });

    const crop = field.cropId;
    if (!crop) return res.status(400).json({ error: "Field has no crop assigned" });

    // =========================
    // 🔥 LIFE CYCLE IRRIGATION LOGIC
    // =========================

    const plantingDate = field.plantingDate || field._id.getTimestamp();
    const daysSincePlanting = Math.floor((new Date() - new Date(plantingDate)) / (1000 * 60 * 60 * 24));
    const s = crop.stages;
    
    let currentWaterPerSqm = 0;
    if (daysSincePlanting <= s.initial.days) {
      currentWaterPerSqm = s.initial.water;
    } else if (daysSincePlanting <= (s.initial.days + s.growth.days)) {
      currentWaterPerSqm = s.growth.water;
    } else if (daysSincePlanting <= (s.initial.days + s.growth.days + s.mid.days)) {
      currentWaterPerSqm = s.mid.water;
    } else if (daysSincePlanting <= (s.initial.days + s.growth.days + s.mid.days + s.late.days)) {
      currentWaterPerSqm = s.late.water;
    } else {
      currentWaterPerSqm = 0; // Harvest stage
    }

    const optimalAmount = currentWaterPerSqm * field.area;

    // =========================
    // 🔥 UPDATE FIELD STATE
    // =========================

    field.soilMoisture = 100; // Reset to 100% after irrigation
    field.lastUpdated = new Date();
    field.espCommand = "OFF"; // Turn off ESP pump after irrigation
    await field.save();

    // =========================
    // 🔥 SAVE IRRIGATION LOG
    // =========================

    const log = new IrrigationLog({
      fieldId: field._id,
      amountApplied: optimalAmount,
      optimalAmount: optimalAmount,
      date: new Date()
    });

    await log.save();

    // =========================
    // 🔥 RESPONSE TO FRONTEND
    // =========================

    res.json({
      message: "Irrigation completed successfully",
      data: {
        amountApplied: optimalAmount,
        updatedSoilMoisture: field.soilMoisture
      }
    });

  } catch (err) {
    console.error("Irrigation Error:", err);
    res.status(500).json({ error: err.message });
  }
});


// Get Irrigation History and Efficiency for a Field
router.get("/fields/:id/stats", async (req, res) => {
  try {
    const logs = await IrrigationLog.find({ fieldId: req.params.id }).sort({ date: 1 });

    let totalActual = 0;
    let totalOptimal = 0;

    const chartData = logs.map(log => {
      totalActual += log.amountApplied;
      totalOptimal += log.optimalAmount;
      return {
        date: log.date,
        actual: log.amountApplied,
        optimal: log.optimalAmount
      };
    });

    // Efficiency Score
    let efficiencyScore = 100;
    if (totalOptimal > 0) {
      efficiencyScore = (totalActual / totalOptimal) * 100;
    }

    let efficiencyStatus = "Efficient ✅";
    if (efficiencyScore > 120) efficiencyStatus = "Wasteful ❌ (Too much water)";
    else if (efficiencyScore < 80) efficiencyStatus = "Under-irrigation ❌ (Too little water)";

    res.json({
      logs: chartData,
      efficiencyScore: efficiencyScore.toFixed(1),
      efficiencyStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
