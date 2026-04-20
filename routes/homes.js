const express = require("express");
const router = express.Router();

const Home = require("../models/Home");
const Room = require("../models/Room");
const Device = require("../models/Device");

// ================= GET HOMES BY USER =================
router.get("/user/:userId", async (req, res) => {
  try {
    const { mode } = req.query;
    const query = { userId: req.params.userId };
    if (mode) query.mode = mode;

    const homes = await Home.find(query);
    res.json(homes);
  } catch (err) {
    console.error("Error fetching homes:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= CREATE HOME =================
router.post("/", async (req, res) => {
  try {
    const { userId, name, type, mode } = req.body;

    const newHome = new Home({
      userId,
      name,
      type,
      mode: mode || "normal"
    });

    await newHome.save();

    res.json(newHome);
  } catch (err) {
    console.error("Error creating home:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= DELETE HOME =================
router.delete("/:homeId", async (req, res) => {
  try {
    const deletedHome = await Home.findByIdAndDelete(req.params.homeId);
    if (!deletedHome) {
      return res.status(404).json({ error: "Home not found" });
    }
    await Room.deleteMany({ homeId: req.params.homeId });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting home:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= DASHBOARD =================
router.get("/dashboard/:homeId", async (req, res) => {
  try {
    const rooms = await Room.find({ homeId: req.params.homeId });

    const devices = await Device.find({
      roomId: { $in: rooms.map((r) => r._id) },
    });

    const devicesByRoom = rooms.map((room) => ({
      room: room.name,
      devices: devices.filter(
        (d) => d.roomId.toString() === room._id.toString()
      ),
    }));

    res.json({ success: true, rooms, devicesByRoom });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// the 2 active room 
router.get("/top-rooms/:homeId", async (req, res) => {
  try {
    const rooms = await Room.find({ homeId: req.params.homeId });
    const devices = await Device.find({ homeId: req.params.homeId });

    const roomStats = rooms.map(room => {
      const roomDevices = devices.filter(
        d => d.roomId.toString() === room._id.toString()
      );

      return {
        roomId: room._id,
        roomName: room.name,
        total: roomDevices.length,
        active: roomDevices.filter(d => d.isOn).length
      };
    });

    // 🔥 SORT by active devices
    const topRooms = roomStats
      .sort((a, b) => b.active - a.active)
      .slice(0, 2);

    res.json(topRooms);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;