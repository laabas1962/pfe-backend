const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const Home = require("../models/Home");
const Device = require("../models/Device");
const BaseDevice = require("../devices/BaseDevice");
const LightDevice = require("../devices/LightDevice");
const ACDevice = require("../devices/ACDevice");
const { processActivityEvent } = require("../services/activityPipeline");
const { applyPowerStateChange } = require("../services/deviceState");

const DEVICE_MAP = require("../deviceMap");

async function logActivity(device, action) {
  if (!device?.homeId) return;

  await processActivityEvent({
    homeId: device.homeId,
    roomId: device.roomId,
    deviceId: device._id,
    deviceName: device.name,
    roomName: device.roomName,
    source: "dashboard",
    action,
    value: { isOn: action === "ON" },
  });
}

router.post("/", async (req, res) => {
  try {
    const { homeId, roomId, deviceId } = req.body;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const home = await Home.findById(homeId);
    if (!home) return res.status(404).json({ error: "Home not found" });

    const deviceInfo = DEVICE_MAP[deviceId];
    if (!deviceInfo) {
      return res.status(400).json({ error: "Invalid device" });
    }

    const newDevice = new Device({
      deviceId,
      name: deviceInfo.name,
      type: deviceInfo.type,
      homeId,
      homeName: home.name,
      roomId,
      roomName: room.name,
      state: {},
      isOn: false,
      power: deviceInfo.power || 0,
      totalUsageTime: 0,
      lastOnTime: 0,
    });

    await newDevice.save();

    let deviceInstance;
    switch (deviceInfo.type) {
      case "light":
        deviceInstance = new LightDevice(deviceInfo.name, room.name, homeId);
        break;
      case "ac":
        deviceInstance = new ACDevice(deviceInfo.name, room.name, homeId);
        break;
      default:
        deviceInstance = new BaseDevice(deviceInfo.name, room.name, homeId);
    }

    deviceInstance.init(newDevice._id.toString());

    res.json({ success: true, device: newDevice });
  } catch (err) {
    console.error("Error creating device:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/home/:homeId", async (req, res) => {
  try {
    const devices = await Device.find({
      homeId: req.params.homeId,
    });

    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:deviceId/toggle", async (req, res) => {
  try {
    const device = await Device.findById(req.params.deviceId);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    applyPowerStateChange(device, !device.isOn);
    device.lastUpdated = new Date();
    await device.save();
    await logActivity(device, device.isOn ? "ON" : "OFF");

    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:deviceId/state", async (req, res) => {
  try {
    const device = await Device.findById(req.params.deviceId);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const { state, isOn } = req.body || {};

    if (state && typeof state === "object" && !Array.isArray(state)) {
      device.state = { ...(device.state || {}), ...state };
    }

    if (typeof isOn === "boolean") {
      applyPowerStateChange(device, isOn);
    }

    device.lastUpdated = new Date();
    await device.save();

    if (state && typeof state === "object" && !Array.isArray(state)) {
      await processActivityEvent({
        homeId: device.homeId,
        roomId: device.roomId,
        deviceId: device._id,
        deviceName: device.name,
        roomName: device.roomName,
        source: "dashboard",
        action: "CHANGE",
        state,
        value: state,
      });
    } else if (typeof isOn === "boolean") {
      await logActivity(device, isOn ? "ON" : "OFF");
    }

    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
