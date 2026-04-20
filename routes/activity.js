const express = require("express");
const router = express.Router();
const Activity = require("../models/Activity");

router.get("/:homeId", async (req, res) => {
  const activities = await Activity.find({ homeId: req.params.homeId })
    .sort({ createdAt: -1 })
    .limit(10);

  res.json(activities);
});

module.exports = router;