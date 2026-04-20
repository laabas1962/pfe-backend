require("dotenv").config();
const mqtt = require("mqtt");

const brokerUrl = process.env.MQTT_URL;

const options = {
  clientId: `smart_home_backend_${Math.random().toString(16).substr(2, 8)}`,
  clean: true,
  connectTimeout: 5000,
  reconnectPeriod: 3000,
  // Connecting to self-hosted Aedes on localhost
  username: process.env.MQTT_USER || "",
  password: process.env.MQTT_PASS || "",
};

const client = mqtt.connect(brokerUrl, options);

// Increase max listeners to handle many devices (BaseDevice.js listeners)
client.setMaxListeners(100);

client.on("connect", () => {
  console.log("✅ Connected to HiveMQ Cloud!");
  
  // Example: subscribe to a test topic
  client.subscribe("test/topic", (err) => {
    if (err) console.error("❌ Subscribe error:", err);
    else console.log("✅ Subscribed to test/topic");
  });

  // Example: publish a message
  client.publish("test/topic", "Hello HiveMQ!", (err) => {
    if (err) console.error("❌ Publish error:", err);
    else console.log("📤 Message sent to test/topic");
  });
});

client.on("message", (topic, message) => {
  console.log(`📥 Message received from ${topic}: ${message.toString()}`);
});

client.on("error", (err) => {
  console.error("❌ MQTT Connection error:", err);
  client.end();
});

client.on("reconnect", () => console.log("🔄 Reconnecting..."));
client.on("close", () => console.log("⚠️ Connection closed"));

module.exports = client;