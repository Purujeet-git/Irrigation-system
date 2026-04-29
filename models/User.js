import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Optional for OAuth users
  role: { type: String, enum: ["Farmer", "Admin"], default: "Farmer" },
  githubId: { type: String, unique: true, sparse: true },
  pushSubscription: { type: Object }, 
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
