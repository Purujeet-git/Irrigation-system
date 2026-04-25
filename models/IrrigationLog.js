import mongoose from "mongoose";

const irrigationLogSchema = new mongoose.Schema({
  fieldId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Field",
    required: true
  },
  amountApplied: { type: Number, required: true }, // Actual water in Liters
  optimalAmount: { type: Number, required: true }, // Optimal water in Liters
  date: { type: Date, default: Date.now }
});

export default mongoose.model("IrrigationLog", irrigationLogSchema);
