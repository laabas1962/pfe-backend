// routes/quickAction.js
const express = require("express");
const router = express.Router();

const QuickAction = require("../models/QuickAction");
const Device = require("../models/Device");
const Activity = require("../models/Activity");

// ===============================
// ADD DEVICE TO QUICK ACTION
// ===============================
router.post("/add", async (req, res) => {
  try {
    const { homeId, name, deviceIds } = req.body;

    if (!homeId || !name) {
      return res.status(400).json({ error: "homeId and name are required" });
    }

    // Check if a QuickAction with the same name exists for the home
    let quick = await QuickAction.findOne({ homeId, name });

    if (!quick) {
      quick = new QuickAction({ homeId, name, deviceIds: deviceIds || [] });
    } else {
      // Merge devices but prevent duplicates
      deviceIds.forEach(id => {
        if (!quick.deviceIds.includes(id)) quick.deviceIds.push(id);
      });
      // Limit devices
      if (quick.deviceIds.length > 4) quick.deviceIds = quick.deviceIds.slice(0, 4);
    }

    await quick.save();
    await quick.populate("deviceIds");

    res.json(quick);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ===============================
// GET QUICK DEVICES FOR HOME
// ===============================
router.get("/:homeId", async (req, res) => {
  try {
    const quick = await QuickAction.findOne({ homeId: req.params.homeId }).populate("deviceIds");
    res.json(quick ? quick.deviceIds : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// REMOVE DEVICE FROM QUICK ACTION
// ===============================
router.delete("/:homeId/:deviceId", async (req, res) => {
  try {
    const { homeId, deviceId } = req.params;

    const quick = await QuickAction.findOne({ homeId });
    if (!quick) return res.status(404).json({ error: "Quick action not found" });

    quick.deviceIds = quick.deviceIds.filter(d => d.toString() !== deviceId);
    await quick.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// TOGGLE DEVICE ON/OFF
// ===============================
router.post("/:deviceId/toggle", async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findById(deviceId);
    if (!device) return res.status(404).json({ error: "Device not found" });

    device.isOn = !device.isOn;
    await device.save();

    await Activity.create({
      homeId: device.homeId,
      deviceId: device._id,
      deviceName: device.name,
      roomName: device.roomName,
      action: device.isOn ? "turned on from quick actions" : "turned off from quick actions",
    });

    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
