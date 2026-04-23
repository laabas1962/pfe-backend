const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  userId: { type: String },
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: "Home" },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Device" },
  deviceName: { type: String },
  roomName: { type: String },
  source: { type: String, default: "system" },

  action: {
    type: String,
    enum: ["ON", "OFF", "OPEN", "CLOSE", "CHANGE"]
  },

  value: mongoose.Mixed,
  occurredAt: { type: Date, default: Date.now },

  
  context: {
    temperature: Number,
    humidity: Number,
    hour: Number,
    dayOfWeek: String,
    timeOfDay: String 
  }

}, { timestamps: true });

module.exports = mongoose.model("Activity", activitySchema);
