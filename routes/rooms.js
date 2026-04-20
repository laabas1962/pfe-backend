const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const Home = require("../models/Home");

function normalizeRoomName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

router.post("/", async (req, res) => {
  try {
    const { homeId, rooms } = req.body;

    const home = await Home.findById(homeId);
    if (!home) {
      console.warn("Room Post: Home not found for homeId:", homeId);
      return res.status(404).json({ error: "Home not found" });
    }

    const existingRooms = await Room.find({ homeId });
    const existingNames = existingRooms.map((room) => normalizeRoomName(room.name));

    const newRooms = rooms.filter(
      (room) => !existingNames.includes(normalizeRoomName(room.name))
    );

    if (newRooms.length > 0) {
      const createdRooms = await Room.insertMany(
        newRooms.map((room) => ({
          homeId,
          homeName: home.name,
          name: room.name,
          icon: room.icon || "home-outline",
        }))
      );

      console.log(
        `Rooms added to home '${home.name}':`,
        createdRooms.map((room) => room.name)
      );
      return res.json(createdRooms);
    }

    return res.json([]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/home/:homeId", async (req, res) => {
  try {
    const rooms = await Room.find({ homeId: req.params.homeId });
    return res.json(rooms);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/:roomId", async (req, res) => {
  try {
    const deleted = await Room.findByIdAndDelete(req.params.roomId);
    if (!deleted) {
      return res.status(404).json({ message: "Room not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting room:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
