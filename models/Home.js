// models/Home.js
const mongoose = require("mongoose");

const HomeSchema = new mongoose.Schema({
 
  name: { type: String, required: true },
  type: { type: String, default: "apartment" },
  userId: { type: String, required: true },
  mode: { type: String, enum: ["normal", "elderly"], default: "normal" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Home", HomeSchema);