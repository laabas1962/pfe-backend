const mongoose = require("mongoose");

const relationshipSchema = new mongoose.Schema({
  guardianId: { type: String, required: true }, // Firebase UID of Legal Guardian
  caregiverId: { type: String },               // Firebase UID of Caregiver (Optional)
  residentId: { type: String, required: true },  // Firebase UID of Resident (Elderly)
  
  // "active" means the relationship is functional
  status: { type: String, enum: ["pending", "active", "rejected"], default: "active" },
  
  nickname: { type: String }, // Optional nickname for the resident
  
  permissions: {
    canControlDevices: { type: Boolean, default: true },
    canViewHistory: { type: Boolean, default: true },
    canEditRoutines: { type: Boolean, default: false }
  },
  
  createdAt: { type: Date, default: Date.now }
});

relationshipSchema.index({ guardianId: 1, residentId: 1, caregiverId: 1 }, { unique: true });

module.exports = mongoose.model("Relationship", relationshipSchema);
