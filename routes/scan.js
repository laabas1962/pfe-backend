const express = require("express");
const router = express.Router();

// Simulate scan (later replace with real discovery)
router.get("/:homeId", async (req, res) => {
  const devices = [
    { name: "Smart Lamp", type: "Light", signal: 78, isPairable: true },
    { name: "TV", type: "TV", signal: 60, isPairable: true },
    { name: "Camera", type: "Camera", signal: 30, isPairable: false },
  ];

  res.json(devices);
});

module.exports = router;