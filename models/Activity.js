const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: "Home" },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Device" },

  deviceName: String,
  roomName: String,

  action: String, 

}, { timestamps: true });

module.exports = mongoose.model("Activity", activitySchema);