const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true },

  homeName: { type: String, required: true }, 

  name: { type: String, required: true },
  icon: { type: String, default: "home-outline" },

}, { timestamps: true });

module.exports = mongoose.model("Room", roomSchema);
