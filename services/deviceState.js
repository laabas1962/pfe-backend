function applyPowerStateChange(device, nextIsOn, timestamp = Date.now()) {
  if (typeof nextIsOn !== "boolean" || !device) {
    return;
  }

  if (nextIsOn) {
    if (!device.isOn) {
      device.lastOnTime = timestamp;
    }
    device.isOn = true;
    return;
  }

  if (device.isOn && device.lastOnTime) {
    const sessionTime = timestamp - device.lastOnTime;
    if (sessionTime > 0) {
      device.totalUsageTime = (device.totalUsageTime || 0) + sessionTime;
      device.dailyUsageTime = (device.dailyUsageTime || 0) + sessionTime;
    }
  }

  device.lastOnTime = 0;
  device.isOn = false;
}

module.exports = {
  applyPowerStateChange,
};
