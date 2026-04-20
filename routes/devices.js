const express = require("express");
const router = express.Router();
const getDb = require("../db");
const { ObjectId } = require("mongodb");
const Room = require("../models/Room");
const Home = require("../models/Home");
const Device = require("../models/Device");
const Activity = require("../models/Activity");
const BaseDevice = require("../devices/BaseDevice");
const LightDevice = require("../devices/LightDevice");
const ACDevice = require("../devices/ACDevice");


const DEVICE_MAP = require("../deviceMap");

async function logActivity(device, action) {
  if (!device?.homeId) return;

  await Activity.create({
    homeId: device.homeId,
    deviceId: device._id,
    deviceName: device.name,
    roomName: device.roomName,
    action,
  });
}

router.post("/", async (req, res) => {
  try {
    const { homeId, roomId, deviceId } = req.body;

    // 1️⃣ Get room + home
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const home = await Home.findById(homeId);
    if (!home) return res.status(404).json({ error: "Home not found" });

    // 2️⃣ Get device info from map
    const deviceInfo = DEVICE_MAP[deviceId];
    if (!deviceInfo) {
      return res.status(400).json({ error: "Invalid device" });
    }

    // 3️⃣ Save device in DB FIRST
    const newDevice = new Device({
      deviceId: deviceId,
      name: deviceInfo.name,
      type: deviceInfo.type,

      homeId,
      homeName: home.name,

      roomId,
      roomName: room.name,

      state: {},
      isOn: false,

      // ⚡ ENERGY
      power: deviceInfo.power || 0,
      totalUsageTime: 0,
      lastOnTime: 0,
    });

    await newDevice.save();

    // 4️⃣ Create MQTT device
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

// ✅ GET devices by home
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

    device.isOn = !device.isOn;
    device.lastUpdated = new Date();
    await device.save();
    await logActivity(device, device.isOn ? "turned on" : "turned off");

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

    if (typeof isOn === "boolean") {
      device.isOn = isOn;
    }

    if (state && typeof state === "object" && !Array.isArray(state)) {
      device.state = { ...(device.state || {}), ...state };
    }

    device.lastUpdated = new Date();
    await device.save();

    if (state?.temperature !== undefined) {
      await logActivity(device, `temperature set to ${state.temperature}°C`);
    } else if (state?.mode) {
      await logActivity(device, `mode changed to ${state.mode}`);
    } else if (typeof isOn === "boolean") {
      await logActivity(device, isOn ? "turned on" : "turned off");
    }

    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
