import mongoose from "mongoose";

const fieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, default: "General Area" },
  area: { type: Number, default: 0 }, // in square meters
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  cropId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Crop",
  },
  moisture: { type: Number, default: 50 }, // Air humidity from weather API
  soilMoisture: { type: Number, default: 60 }, // Actual soil moisture percentage
  temperature: { type: Number, default: 25 },
  latitude: { type: Number },
  longitude: { type: Number },
  plantingDate: { type: Date, default: Date.now },
  espCommand: { type: String, default: "OFF" }, // "ON" or "OFF" for the ESP device
  lastNotificationSent: { type: Date },
  lastUpdated: { type: Date, default: Date.now }
});

export default mongoose.model("Field", fieldSchema);
