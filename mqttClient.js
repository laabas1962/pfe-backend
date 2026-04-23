require("dotenv").config();
const mqtt = require("mqtt");

const brokerUrl = process.env.MQTT_URL;

const client = mqtt.connect(brokerUrl, {
  clientId: `smart_home_backend_${Math.random().toString(16).substr(2, 8)}`,
  clean: true,
  connectTimeout: 8000,
  reconnectPeriod: 3000,
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  rejectUnauthorized: false, 
});

// allow many device listeners
client.setMaxListeners(100);

client.on("connect", () => {
  console.log("✅ Connected to EMQX MQTT Broker");

  // subscribe to smart home topics (optional base subscription)
  client.subscribe("home/+/+/+", (err) => {
    if (err) console.error("❌ Subscribe error:", err);
    else console.log("📡 Subscribed to smart home topics");
  });
});

client.on("message", (topic, message) => {
  console.log(`📥 ${topic}: ${message.toString()}`);
});

client.on("error", (err) => {
  console.error("❌ MQTT error:", err.message);
});

client.on("reconnect", () => console.log("🔄 Reconnecting MQTT..."));
client.on("close", () => console.log("⚠️ MQTT connection closed"));

module.exports = client;