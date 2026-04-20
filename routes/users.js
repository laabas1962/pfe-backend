// routes/users.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Sync or create user by Firebase UID
router.post("/sync", async (req, res) => {
   console.log("🔥 /users/sync called with body:", req.body);
  try {
    const { firebaseUid, name, email, profileImage, role, mode } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ success: false, message: "Missing firebaseUid or email" });
    }

    // ✅ Upsert user: create if not exists, update if exists
    // Only update fields that are provided in the request
    const updateData = { email };
    
    // Only update name if it's provided AND it's not the default "User" (unless the current name IS "User")
    if (name && name !== "User") {
      updateData.name = name;
    }
    
    if (profileImage) {
      updateData.profileImage = profileImage;
    }

    if (role) {
      updateData.role = role;
    }

    if (mode) {
      updateData.mode = mode;
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { $set: updateData },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      }
    );

    res.json({ success: true, user });
  } catch (err) {
    console.error("Error syncing user:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch user by Firebase UID
router.get("/by-firebase/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    const user = await User.findOne({ firebaseUid });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

   res.json({
  success: true,
  user: {
    name: user.name,
    email: user.email,
    profileImage: user.profileImage,
    hasSetup: user.hasSetup,
    role: user.role,
  }
});
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Update hasSetup

router.patch("/by-firebase/:firebaseUid/setup", async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const { hasSetup } = req.body;

    if (typeof hasSetup !== "boolean") {
      return res.status(400).json({ success: false, message: "hasSetup must be boolean" });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { hasSetup },
      { returnDocument: "after" }
    );

    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    console.error("Error updating hasSetup:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
// ✅ Generic update user by Firebase UID
router.patch("/by-firebase/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const updates = req.body;

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { $set: updates },
      { returnDocument: "after" }
    );

    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
