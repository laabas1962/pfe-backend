const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true },
  homeName: { type: String, required: true }, 

  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  roomName: { type: String, required: true }, 

  name: { type: String, required: true },
  type: { type: String, required: true },
  deviceId: { type: String, required: true },

  isOn: { type: Boolean, default: false }, 
  online: { type: Boolean, default: true },

  state: { type: mongoose.Mixed, default: {} }, 

  lastUpdated: Date,

  //(energy logic)
  power: { type: Number, default: 0 },   
  lastOnTime: { type: Number, default: 0 },     // timestamp
  totalUsageTime: { type: Number, default: 0 }, // cumulative milliseconds
  dailyUsageTime: { type: Number, default: 0 }, // daily milliseconds
  lastDailyReset: { type: Date, default: Date.now },
  consumptionHistory: [
    {
      date: { type: String, required: true }, // "YYYY-MM-DD"
      energy: { type: Number, required: true } // kWh
    }
  ],


}, { timestamps: true });

module.exports = mongoose.model("Device", deviceSchema);