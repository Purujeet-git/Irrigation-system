import express from "express";
import Field from "../models/Field.js";
import Crop from "../models/Crop.js";
import User from "../models/User.js";
import IrrigationLog from "../models/IrrigationLog.js";
import SystemSettings from "../models/SystemSettings.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// Apply protection to all admin routes
router.use(protect);
router.use(adminOnly);

// --- SYSTEM SETTINGS ---
// Get Settings
router.get("/settings", async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({ isIrrigationHalted: false });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Settings
router.put("/settings", async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
    }
    settings.isIrrigationHalted = req.body.isIrrigationHalted !== undefined ? req.body.isIrrigationHalted : settings.isIrrigationHalted;
    settings.broadcastMessage = req.body.broadcastMessage !== undefined ? req.body.broadcastMessage : settings.broadcastMessage;
    settings.lastUpdated = Date.now();
    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics - System-wide analytics
router.get("/analytics", async (req, res) => {
  try {
    const fields = await Field.find().populate("cropId");
    const logs = await IrrigationLog.find();
    
    // Filter out orphaned fields (fields with no valid user)
    const activeFields = fields.filter(f => f.userId);
    const totalFields = activeFields.length;
    
    // Calculate total water applied across system
    let totalWaterApplied = 0;
    let totalOptimalWater = 0;
    
    // Group water usage by crop
    const cropWaterUsage = {}; // { 'Rice': 500, 'Wheat': 200 }
    
    logs.forEach(log => {
      totalWaterApplied += log.amountApplied;
      totalOptimalWater += log.optimalAmount;
    });
    
    // To group by crop accurately, we need to map logs to their fields' crops
    // We'll create a lookup for fieldId -> cropName
    const fieldCropMap = {};
    activeFields.forEach(f => {
      if (f.cropId) fieldCropMap[f._id.toString()] = f.cropId.name;
    });
    
    logs.forEach(log => {
      const cropName = fieldCropMap[log.fieldId.toString()] || "Unknown";
      if (!cropWaterUsage[cropName]) cropWaterUsage[cropName] = 0;
      cropWaterUsage[cropName] += log.amountApplied;
    });

    let systemEfficiency = 100;
    if (totalOptimalWater > 0) {
      systemEfficiency = (totalWaterApplied / totalOptimalWater) * 100;
    }

    // Determine critical alerts (Fields with moisture < 30 or > 80)
    // Only alert for active fields
    const criticalFields = activeFields.filter(f => f.moisture < 30 || f.moisture > 80);
    const alerts = criticalFields.map(f => {
      if (f.moisture < 30) return `⚠️ ${f.name} is critically dry (${f.moisture}% moisture)`;
      if (f.moisture > 80) return `⚠️ ${f.name} is over-saturated (${f.moisture}% moisture)`;
    });

    // Historical Data (Last 7 Days) for Line Chart
    // For simplicity, we will group logs by date string
    const historyData = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      historyData[dateStr] = { actual: 0, optimal: 0 };
    }

    logs.forEach(log => {
      const logDateStr = new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (historyData[logDateStr]) {
        historyData[logDateStr].actual += log.amountApplied;
        historyData[logDateStr].optimal += log.optimalAmount;
      }
    });

    const historyLabels = Object.keys(historyData);
    const historyActual = historyLabels.map(k => historyData[k].actual);
    const historyOptimal = historyLabels.map(k => historyData[k].optimal);

    res.json({
      totalFields,
      totalWaterApplied,
      systemEfficiency: systemEfficiency.toFixed(1),
      cropWaterUsage,
      alerts,
      history: {
        labels: historyLabels,
        actual: historyActual,
        optimal: historyOptimal
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/farmers - Farmer management
router.get("/farmers", async (req, res) => {
  try {
    const farmers = await User.find({ role: "Farmer" });
    const fields = await Field.find();
    const logs = await IrrigationLog.find();

    const farmerStats = farmers.map(farmer => {
      const farmerFields = fields.filter(f => f.userId && f.userId.toString() === farmer._id.toString());
      
      // Calculate farmer's efficiency score
      let fActual = 0;
      let fOptimal = 0;
      
      farmerFields.forEach(f => {
        const fieldLogs = logs.filter(l => l.fieldId.toString() === f._id.toString());
        fieldLogs.forEach(l => {
          fActual += l.amountApplied;
          fOptimal += l.optimalAmount;
        });
      });
      
      let efficiency = 100;
      if (fOptimal > 0) {
        efficiency = (fActual / fOptimal) * 100;
      }

      return {
        _id: farmer._id,
        name: farmer.name,
        totalFields: farmerFields.length,
        efficiencyScore: efficiency.toFixed(1)
      };
    });

    res.json(farmerStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/farmers/:id/fields - Farmer drill-down
router.get("/farmers/:id/fields", async (req, res) => {
  try {
    const fields = await Field.find({ userId: req.params.id }).populate("cropId");
    const logs = await IrrigationLog.find();

    const fieldStats = fields.map(f => {
      const fieldLogs = logs.filter(l => l.fieldId.toString() === f._id.toString());
      let fActual = 0;
      let fOptimal = 0;
      fieldLogs.forEach(l => { fActual += l.amountApplied; fOptimal += l.optimalAmount; });
      
      let efficiency = 100;
      if (fOptimal > 0) efficiency = (fActual / fOptimal) * 100;

      return {
        _id: f._id,
        name: f.name,
        crop: f.cropId ? f.cropId.name : "Unknown",
        moisture: f.moisture,
        efficiencyScore: efficiency.toFixed(1)
      };
    });

    res.json(fieldStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/farmers/:id - Delete farmer and their fields
router.delete("/farmers/:id", async (req, res) => {
  try {
    const fields = await Field.find({ userId: req.params.id });
    const fieldIds = fields.map(f => f._id);
    
    // Delete logs for these fields
    await IrrigationLog.deleteMany({ fieldId: { $in: fieldIds } });
    
    // Delete fields
    await Field.deleteMany({ userId: req.params.id });
    
    // Delete user
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: "Farmer and all associated data deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/fields/:id - Delete a specific field
router.delete("/fields/:id", async (req, res) => {
  try {
    // Delete logs for this field
    await IrrigationLog.deleteMany({ fieldId: req.params.id });
    
    // Delete field
    await Field.findByIdAndDelete(req.params.id);
    
    res.json({ message: "Field and associated logs deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/logs/:id - Delete a specific irrigation log
router.delete("/logs/:id", async (req, res) => {
  try {
    await IrrigationLog.findByIdAndDelete(req.params.id);
    res.json({ message: "Irrigation log deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/activity - Recent Irrigation Activity Feed
router.get("/activity", async (req, res) => {
  try {
    const logs = await IrrigationLog.find()
      .sort({ date: -1 })
      .limit(20)
      .populate({
        path: "fieldId",
        populate: { path: "cropId" }
      });

    const activity = logs
      .filter(log => log.fieldId) // skip orphaned logs
      .map(log => {
        const field = log.fieldId;
        const crop = field.cropId;
        const efficiency = log.optimalAmount > 0
          ? ((log.amountApplied / log.optimalAmount) * 100)
          : 100;

        let status = "efficient";
        let statusLabel = "✅ Efficient";
        if (efficiency > 120) {
          status = "wasteful";
          statusLabel = "🚨 Wasteful";
        } else if (efficiency < 80) {
          status = "under";
          statusLabel = "⚠️ Under-irrigated";
        }

        const waterDiff = log.amountApplied - log.optimalAmount;

        return {
          _id: log._id,
          fieldName: field.name || "Unknown Field",
          fieldLocation: field.location || "",
          cropName: crop ? crop.name : "Unknown",
          amountApplied: log.amountApplied,
          optimalAmount: log.optimalAmount,
          waterDiff: Number(waterDiff.toFixed(1)),
          efficiency: Number(efficiency.toFixed(1)),
          status,
          statusLabel,
          date: log.date
        };
      });

    // Summary stats
    const totalEvents = activity.length;
    const wastefulCount = activity.filter(a => a.status === "wasteful").length;
    const efficientCount = activity.filter(a => a.status === "efficient").length;
    const totalWasted = activity
      .filter(a => a.waterDiff > 0)
      .reduce((sum, a) => sum + a.waterDiff, 0);

    res.json({
      activity,
      summary: {
        totalEvents,
        wastefulCount,
        efficientCount,
        totalWasted: Number(totalWasted.toFixed(1))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
