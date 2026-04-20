const express = require("express");
const router = express.Router();
const Relationship = require("../models/Relationship");
const User = require("../models/User");
const Home = require("../models/Home");

// Create a relationship (Link Guardian/Caregiver to Resident)
router.post("/", async (req, res) => {
  try {
    const { guardianId, residentId, caregiverId, nickname } = req.body;
    const relationship = new Relationship({
      guardianId,
      residentId,
      caregiverId,
      nickname,
      status: "active"
    });
    await relationship.save();
    res.json({ success: true, relationship });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get residents managed by a specific user (Guardian or Caregiver)
router.get("/:role/:uid", async (req, res) => {
  try {
    const { role, uid } = req.params;
    let query = {};
    
    if (role === "caregiver") {
      query = { caregiverId: uid, status: "active" };
    } else if (role === "guardian") {
      query = { guardianId: uid, status: "active" };
    } else {
      return res.status(400).json({ error: "Invalid role specified" });
    }

    const relationships = await Relationship.find(query);
    
    // Enrich with user profile and home details
    const residents = await Promise.all(
      relationships.map(async (rel) => {
        const user = await User.findOne({ firebaseUid: rel.residentId });
        const home = await Home.findOne({ userId: rel.residentId }); // Home owned by the elderly user
        
        return {
          relationshipId: rel._id,
          firebaseUid: rel.residentId,
          name: rel.nickname || (user ? user.name : "Unknown Resident"),
          email: user ? user.email : "",
          profileImage: user ? user.profileImage : null,
          homeId: home ? home._id : null,
          permissions: rel.permissions
        };
      })
    );

    res.json({ success: true, residents });
  } catch (err) {
    console.error("Error fetching residents:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
