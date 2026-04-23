const mqttClient = require("../mqttClient");
const Device = require("../models/Device");
const { processActivityEvent } = require("../services/activityPipeline");

class BaseDevice {
  constructor(name, roomName, homeId) {
    this.name = name;
    this.roomName = roomName;
    this.homeId = homeId;
    this.topic = `home/${homeId}/${roomName}/${name}`;
    this.deviceId = null;
    this.boundMessageHandler = this.handleIncomingMessage.bind(this);
  }

  init(deviceId) {
    this.deviceId = deviceId;
    mqttClient.subscribe(this.topic);
    mqttClient.off?.("message", this.boundMessageHandler);
    mqttClient.on("message", this.boundMessageHandler);
  }

  async handleIncomingMessage(topic, message) {
    if (topic !== this.topic || !this.deviceId) return;

    try {
      const device = await Device.findById(this.deviceId);
      if (!device) return;

      const msg = message.toString();
      let parsedState = null;
      let activityAction = "CHANGE";
      let activityValue = null;
      const now = Date.now();
      const today = new Date().toISOString().split("T")[0];
      const lastResetDate = device.lastDailyReset
        ? new Date(device.lastDailyReset)
        : new Date();
      const lastResetStr = lastResetDate.toISOString().split("T")[0];

      if (lastResetStr !== today) {
        const powerKW = (device.power || 0) / 1000;
        const hours = (device.dailyUsageTime || 0) / 3600000;
        const energy = powerKW * hours;

        device.consumptionHistory.push({
          date: lastResetStr,
          energy,
        });

        device.dailyUsageTime = 0;
        device.lastDailyReset = now;
      }

      if (msg === "ON") {
        if (!device.isOn) {
          device.lastOnTime = now;
        }
        device.isOn = true;
        activityAction = "ON";
        activityValue = { isOn: true };
      } else if (msg === "OFF") {
        if (device.isOn && device.lastOnTime) {
          const sessionTime = now - device.lastOnTime;
          device.totalUsageTime = (device.totalUsageTime || 0) + sessionTime;
          device.dailyUsageTime = (device.dailyUsageTime || 0) + sessionTime;
        }
        device.lastOnTime = 0;
        device.isOn = false;
        activityAction = "OFF";
        activityValue = { isOn: false };
      } else {
        try {
          parsedState = JSON.parse(msg);
          device.state = { ...(device.state || {}), ...parsedState };
          activityValue = parsedState;
        } catch {
          device.state = { ...(device.state || {}), raw: msg };
          activityValue = { raw: msg };
        }
      }

      device.lastUpdated = new Date();
      await device.save();

      await processActivityEvent({
        homeId: device.homeId,
        roomId: device.roomId,
        deviceId: device._id,
        deviceName: device.name,
        roomName: device.roomName,
        source: "mqtt",
        action: activityAction,
        state: parsedState,
        value: activityValue,
        occurredAt: new Date(now),
      });
    } catch (err) {
      console.error("Error updating device state in DB:", err);
    }
  }

  publishState() {
    mqttClient.publish(this.topic, JSON.stringify(this.state || {}));
  }

  sendCommand(command) {
    mqttClient.publish(this.topic, command);
  }
}

module.exports = BaseDevice;
