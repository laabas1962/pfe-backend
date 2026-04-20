// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  name: { type: String, default: "User" },       // ✅ add name
  email: { type: String, required: true },
  profileImage: { type: String, default: "https://example.com/default-avatar.png" },
  role: { 
  type: String, 
  enum: ["elderly", "caregiver", "guardian", "normal"], 
  default: "normal" 
  },
  mode: {
  type: String,
  enum: ["normal", "elderly"],
  default: "normal"
 },
  hasSetup: { type: Boolean, default: false },
});

module.exports = mongoose.model("User", userSchema);