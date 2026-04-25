import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["Farmer", "Admin"], default: "Farmer" },
  pushSubscription: { type: Object }, // Store web-push subscription object
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
