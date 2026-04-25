import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema({
  isIrrigationHalted: { type: Boolean, default: false },
  broadcastMessage: { type: String, default: "" },
  lastUpdated: { type: Date, default: Date.now }
});

export default mongoose.model("SystemSettings", systemSettingsSchema);
