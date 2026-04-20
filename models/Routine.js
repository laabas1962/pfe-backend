const mongoose = require("mongoose");

const routineSchema = new mongoose.Schema({
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true },
  name: { type: String, required: true },
  icon: { type: String, default: "flash" },
  time: { type: String, default: "08:00" }, // For scheduling
  isActive: { type: Boolean, default: true },
  type: { type: String, enum: ["predefined", "custom"], default: "custom" },
  actions: [{
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Device" },
    action: { type: String, default: "toggle" }, // 'ON', 'OFF', 'toggle'
    value: { type: mongoose.Schema.Types.Mixed }
  }]
}, { timestamps: true });

module.exports = mongoose.model("Routine", routineSchema);
