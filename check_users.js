import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

async function checkUsers() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({}, { name: 1, email: 1, role: 1 });
  console.log("Users in DB:");
  console.log(JSON.stringify(users, null, 2));
  await mongoose.disconnect();
}

checkUsers();
