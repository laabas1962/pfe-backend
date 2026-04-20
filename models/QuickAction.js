// models/QuickAction.js
// models/QuickAction.js
const mongoose = require("mongoose");

const quickActionSchema = new mongoose.Schema({
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true },
  name: { type: String, required: true },
  deviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Device" }]
}, { timestamps: true });

module.exports = mongoose.model("QuickAction", quickActionSchema);