const express = require("express");
const router = express.Router();
const Routine = require("../models/Routine");
const Device = require("../models/Device");
const mqttClient = require("../mqttClient");

// 1. Get All Routines for a Home
router.get("/:homeId", async (req, res) => {
  try {
    const routines = await Routine.find({ homeId: req.params.homeId });
    res.json(routines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create or Update Routine
router.post("/", async (req, res) => {
  try {
    const { id, homeId, name, icon, time, isActive, type, actions } = req.body;
    
    let routine;
    if (id) {
      routine = await Routine.findByIdAndUpdate(id, {
        name, icon, time, isActive, type, actions
      }, { new: true });
    } else {
      routine = new Routine({
        homeId, name, icon, time, isActive, type, actions
      });
      await routine.save();
    }
    res.json(routine);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Delete Routine
router.delete("/:id", async (req, res) => {
  try {
    await Routine.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Trigger Routine
router.post("/:id/trigger", async (req, res) => {
  try {
    const routine = await Routine.findById(req.params.id).populate("actions.deviceId");
    if (!routine) return res.status(404).json({ error: "Routine not found" });

    // Execute actions
    for (let action of routine.actions) {
      const device = action.deviceId;
      if (!device) continue;

      const newState = action.action === "ON" ? true : action.action === "OFF" ? false : !device.isOn;
      
      // Update DB
      device.isOn = newState;
      await device.save();

      // Publish MQTT
      const topic = `home/${device.homeId}/${device.roomName || 'room'}/${device.name}`;
      mqttClient.publish(topic, newState ? "ON" : "OFF");
    }

    res.json({ success: true, routine });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
