require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const userRoutes = require("./routes/users");
const homeRoutes = require("./routes/homes");
const roomRoutes = require("./routes/rooms");
const deviceRoutes = require("./routes/devices");
const quickActions = require("./routes/quickActions");
const statsRoutes = require("./routes/stats");
const routineRoutes = require("./routes/routines");
const assistantVoice = require("./routes/assistant");
const activityRoutes = require("./routes/activity");
const relationshipRoutes = require("./routes/relationships");

require("./mqttClient");
const { startBroker } = require("./broker");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/users", userRoutes);
app.use("/homes", homeRoutes);
app.use("/rooms", roomRoutes);
app.use("/devices", deviceRoutes);
app.use("/quick-actions", quickActions);
app.use("/stats", statsRoutes);
app.use("/routines", routineRoutes);
app.use("/assistant-voice", assistantVoice);
app.use("/activity", activityRoutes);
app.use("/relationships", relationshipRoutes);

app.get("/weather", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing coordinates" });
  }

  try {
    if (!process.env.WEATHER_API_KEY) {
      return res.status(500).json({ error: "Missing WEATHER_API_KEY" });
    }

    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}` +
      `&units=metric` +
      `&appid=${encodeURIComponent(process.env.WEATHER_API_KEY)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.log("OpenWeather error:", response.status, data);
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (err) {
    console.log("Weather endpoint error:", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch weather", details: String(err) });
  }
});

async function initializeExistingDevices() {
  try {
    const Device = require("./models/Device");
    const BaseDevice = require("./devices/BaseDevice");
    const LightDevice = require("./devices/LightDevice");
    const ACDevice = require("./devices/ACDevice");
    const TVDevice = require("./devices/TVDevice");

    const devices = await Device.find({});

    devices.forEach((dev) => {
      let deviceInstance;

      if (dev.type === "light") {
        deviceInstance = new LightDevice(dev.name, dev.roomName, dev.homeId);
      } else if (dev.type === "ac") {
        deviceInstance = new ACDevice(dev.name, dev.roomName, dev.homeId);
      } else if (dev.type === "tv") {
        deviceInstance = new TVDevice(dev.name, dev.roomName, dev.homeId);
      } else {
        deviceInstance = new BaseDevice(dev.name, dev.roomName, dev.homeId);
      }

      if (deviceInstance?.init) {
        deviceInstance.init(dev._id.toString());
      }
    });

    console.log("All devices initialized");
  } catch (err) {
    console.error("Device initialization error:", err);
  }
}

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("Missing MONGO_URI in backend .env");
    }

    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ MongoDB connected successfully!");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, async () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🔗 Local link: http://localhost:${PORT}`);
      
      
      
      await initializeExistingDevices();
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.log("\n💡 Pro Tip: Make sure your MongoDB service is running!");
    console.log("If using local MongoDB, try running: 'services.msc' and start 'MongoDB Server'.\n");
    process.exit(1);
  }
}

startServer();
