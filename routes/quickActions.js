const express = require("express");
const router = express.Router();

const QuickAction = require("../models/QuickAction");
const Device = require("../models/Device");
const { processActivityEvent } = require("../services/activityPipeline");
const { applyPowerStateChange } = require("../services/deviceState");

router.post("/add", async (req, res) => {
  try {
    const { homeId, name, deviceIds } = req.body;

    if (!homeId || !name) {
      return res.status(400).json({ error: "homeId and name are required" });
    }

    let quick = await QuickAction.findOne({ homeId, name });

    if (!quick) {
      quick = new QuickAction({ homeId, name, deviceIds: deviceIds || [] });
    } else {
      deviceIds.forEach((id) => {
        if (!quick.deviceIds.includes(id)) quick.deviceIds.push(id);
      });

      if (quick.deviceIds.length > 4) quick.deviceIds = quick.deviceIds.slice(0, 4);
    }

    await quick.save();
    await quick.populate("deviceIds");

    res.json(quick);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:homeId", async (req, res) => {
  try {
    const quick = await QuickAction.findOne({ homeId: req.params.homeId }).populate("deviceIds");
    res.json(quick ? quick.deviceIds : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:homeId/:deviceId", async (req, res) => {
  try {
    const { homeId, deviceId } = req.params;

    const quick = await QuickAction.findOne({ homeId });
    if (!quick) return res.status(404).json({ error: "Quick action not found" });

    quick.deviceIds = quick.deviceIds.filter((deviceRef) => deviceRef.toString() !== deviceId);
    await quick.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:deviceId/toggle", async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findById(deviceId);
    if (!device) return res.status(404).json({ error: "Device not found" });

    applyPowerStateChange(device, !device.isOn);
    device.lastUpdated = new Date();
    await device.save();

    await processActivityEvent({
      homeId: device.homeId,
      roomId: device.roomId,
      deviceId: device._id,
      deviceName: device.name,
      roomName: device.roomName,
      source: "quick-action",
      action: device.isOn ? "ON" : "OFF",
      value: { isOn: device.isOn },
    });

    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
