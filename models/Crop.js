import mongoose from "mongoose";

const cropSchema = new mongoose.Schema({
  name: { type: String, required: true },
  stages: {
    initial: { days: { type: Number, default: 20 }, water: { type: Number, default: 5 } },
    growth: { days: { type: Number, default: 30 }, water: { type: Number, default: 8 } },
    mid: { days: { type: Number, default: 40 }, water: { type: Number, default: 12 } },
    late: { days: { type: Number, default: 20 }, water: { type: Number, default: 6 } }
  },
  minMoisture: { type: Number, default: 30 },
  maxMoisture: { type: Number, default: 70 },
  temperatureRange: {
    min: { type: Number, default: 15 },
    max: { type: Number, default: 35 },
  }
});

export default mongoose.model("Crop", cropSchema);
