const express = require("express");
const router = express.Router();
const Suggestion = require("../models/suggestions");
const Home = require("../models/Home");
const { refreshSuggestionsForHome } = require("../services/activityPipeline");

router.get("/:homeId", async (req, res) => {
  try {
    const shouldRefresh = req.query.refresh !== "false";

    if (shouldRefresh) {
      const home = await Home.findById(req.params.homeId).select("userId").lean();
      await refreshSuggestionsForHome({
        homeId: req.params.homeId,
        userId: home?.userId,
      });
    }

    const filter = { homeId: req.params.homeId };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const suggestions = await Suggestion.find(filter)
      .sort({ priority: 1, confidence: -1, updatedAt: -1 })
      .limit(50);

    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:suggestionId/status", async (req, res) => {
  try {
    const { status } = req.body || {};

    if (!["pending", "accepted", "ignored"].includes(status)) {
      return res.status(400).json({ error: "Invalid suggestion status" });
    }

    const suggestion = await Suggestion.findByIdAndUpdate(
      req.params.suggestionId,
      { status },
      { new: true }
    );

    if (!suggestion) {
      return res.status(404).json({ error: "Suggestion not found" });
    }

    res.json({ success: true, suggestion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
