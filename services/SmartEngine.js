const Activity = require("../models/Activity");
const Device = require("../models/Device");

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const NINETY_MINUTES_MS = 90 * 60 * 1000;

function asDate(value) {
  return value ? new Date(value) : null;
}

function sameId(a, b) {
  return String(a || "") === String(b || "");
}

function clampConfidence(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatHour(hour) {
  if (typeof hour !== "number" || hour < 0 || hour > 23) {
    return "this time";
  }

  return `${String(hour).padStart(2, "0")}:00`;
}

function buildSuggestion(base) {
  return {
    userId: base.userId,
    homeId: base.homeId,
    type: base.type,
    priority: base.priority,
    confidence: clampConfidence(base.confidence),
    message: base.message,
    deviceId: base.deviceId,
    autoExecutable: Boolean(base.autoExecutable),
    dedupeKey: base.dedupeKey,
    contextSnapshot: base.contextSnapshot || {},
  };
}

function detectComfortRule(currentActivity, devices, homeId, userId) {
  const temperature = currentActivity?.context?.temperature;
  if (typeof temperature !== "number" || temperature <= 28) {
    return [];
  }

  const acDevice = devices.find((device) => device.type === "ac");
  if (!acDevice || acDevice.isOn) {
    return [];
  }

  return [
    buildSuggestion({
      homeId,
      userId,
      type: "comfort",
      priority: 2,
      confidence: 70 + Math.min((temperature - 28) * 6, 24),
      message: `It is ${temperature}C in ${currentActivity.roomName || "this room"}. Consider turning on ${acDevice.name}.`,
      deviceId: acDevice._id,
      autoExecutable: true,
      dedupeKey: `comfort:high-temp:${currentActivity.roomId || currentActivity.roomName || "home"}:${acDevice._id}`,
      contextSnapshot: {
        temperature,
        sourceDeviceId: currentActivity.deviceId,
      },
    }),
  ];
}

function detectHabitRule(currentActivity, activities, devices, homeId, userId) {
  const currentDevice = devices.find((device) => sameId(device._id, currentActivity?.deviceId));
  if (!currentActivity || currentActivity.action !== "ON" || currentDevice?.type !== "ac") {
    return [];
  }

  const currentHour = currentActivity.context?.hour;
  if (typeof currentHour !== "number") {
    return [];
  }

  const sameHourEvents = activities.filter(
    (activity) =>
      sameId(activity.deviceId, currentActivity.deviceId) &&
      activity.action === "ON" &&
      activity.context?.hour === currentHour
  );

  const uniqueDays = new Set(
    sameHourEvents
      .map((activity) => {
        const activityDate = asDate(activity.occurredAt || activity.createdAt);
        return activityDate ? activityDate.toISOString().slice(0, 10) : null;
      })
      .filter(Boolean)
  );

  if (uniqueDays.size < 3) {
    return [];
  }

  return [
    buildSuggestion({
      homeId,
      userId,
      type: "habit",
      priority: 3,
      confidence: 55 + Math.min(uniqueDays.size * 8, 35),
      message: `You often turn on ${currentDevice.name} around ${formatHour(currentHour)}.`,
      deviceId: currentDevice._id,
      autoExecutable: true,
      dedupeKey: `habit:${currentDevice._id}:${currentHour}`,
      contextSnapshot: {
        hour: currentHour,
        occurrences: uniqueDays.size,
      },
    }),
  ];
}

function detectSafetyRule(activities, devices, homeId, userId) {
  const now = Date.now();
  const suggestions = [];

  for (const device of devices.filter((entry) => ["lock", "door"].includes(entry.type))) {
    const deviceEvents = activities
      .filter((activity) => sameId(activity.deviceId, device._id))
      .sort((a, b) => new Date(b.occurredAt || b.createdAt) - new Date(a.occurredAt || a.createdAt));

    const latestEvent = deviceEvents[0];
    if (!latestEvent || latestEvent.action !== "OPEN") {
      continue;
    }

    const openedAt = asDate(latestEvent.occurredAt || latestEvent.createdAt);
    if (!openedAt || now - openedAt.getTime() < FIVE_MINUTES_MS) {
      continue;
    }

    suggestions.push(
      buildSuggestion({
        homeId,
        userId,
        type: "safety",
        priority: 1,
        confidence: 95,
        message: `${device.name} in ${device.roomName} has been open for more than 5 minutes.`,
        deviceId: device._id,
        autoExecutable: false,
        dedupeKey: `safety:open-too-long:${device._id}`,
        contextSnapshot: {
          openedAt,
        },
      })
    );
  }

  return suggestions;
}

function detectEnergyRule(devices, homeId, userId) {
  const now = Date.now();
  const suggestions = [];

  for (const device of devices.filter((entry) => ["ac", "light", "tv"].includes(entry.type))) {
    if (!device.isOn || !device.lastOnTime) {
      continue;
    }

    const onDuration = now - Number(device.lastOnTime || 0);
    if (onDuration < NINETY_MINUTES_MS) {
      continue;
    }

    const hoursOn = Math.round((onDuration / 3600000) * 10) / 10;

    suggestions.push(
      buildSuggestion({
        homeId,
        userId,
        type: "energy",
        priority: 4,
        confidence: 65 + Math.min((hoursOn - 1.5) * 10, 25),
        message: `${device.name} has been on for about ${hoursOn} hours. Consider turning it off to save energy.`,
        deviceId: device._id,
        autoExecutable: true,
        dedupeKey: `energy:left-on:${device._id}`,
        contextSnapshot: {
          hoursOn,
        },
      })
    );
  }

  return suggestions;
}

async function runSmartEngine({ homeId, userId, activity }) {
  if (!homeId) {
    return [];
  }

  const [activities, devices] = await Promise.all([
    Activity.find({ homeId })
      .sort({ occurredAt: -1, createdAt: -1 })
      .limit(500)
      .lean(),
    Device.find({ homeId }).lean(),
  ]);

  const suggestions = [];
  suggestions.push(...detectComfortRule(activity, devices, homeId, userId));
  suggestions.push(...detectHabitRule(activity, activities, devices, homeId, userId));
  suggestions.push(...detectSafetyRule(activities, devices, homeId, userId));
  suggestions.push(...detectEnergyRule(devices, homeId, userId));

  return suggestions;
}

module.exports = {
  runSmartEngine,
};
