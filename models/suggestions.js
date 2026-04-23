const mongoose = require("mongoose");

const suggestionSchema = new mongoose.Schema({
  userId: { type: String },
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: "Home" },

  type: {
    type: String,
    enum: ["habit", "energy", "safety", "comfort", "reminder"]
  },

  priority: {
    type: Number,
    min: 1,
    max: 4,
    default: 4
  },

  message: { type: String, required: true },

  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Device" },

  confidence: { type: Number, default: 0 },
  autoExecutable: { type: Boolean, default: false },
  dedupeKey: { type: String, required: true },
  occurrenceCount: { type: Number, default: 1 },
  lastTriggeredAt: { type: Date, default: Date.now },
  contextSnapshot: { type: mongoose.Mixed },

  status: {
    type: String,
    enum: ["pending", "accepted", "ignored"],
    default: "pending"
  }

}, { timestamps: true });

suggestionSchema.index({ homeId: 1, dedupeKey: 1, status: 1 });

module.exports = mongoose.model("Suggestion", suggestionSchema);
