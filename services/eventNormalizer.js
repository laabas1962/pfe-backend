function getDayOfWeek(date) {
  return date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
}

function getTimeOfDay(hour) {
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

function pickNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function normalizeAction(rawAction, state = {}) {
  const normalized = String(rawAction || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const aliases = {
    ON: "ON",
    OFF: "OFF",
    OPEN: "OPEN",
    CLOSE: "CLOSE",
    CLOSED: "CLOSE",
    CHANGE: "CHANGE",
    TURN_ON: "ON",
    TURNED_ON: "ON",
    TURN_OFF: "OFF",
    TURNED_OFF: "OFF",
    LOCK: "CLOSE",
    LOCKED: "CLOSE",
    UNLOCK: "OPEN",
    UNLOCKED: "OPEN",
  };

  if (aliases[normalized]) {
    return aliases[normalized];
  }

  if (typeof state?.open === "boolean") {
    return state.open ? "OPEN" : "CLOSE";
  }

  if (typeof state?.locked === "boolean") {
    return state.locked ? "CLOSE" : "OPEN";
  }

  if (typeof state?.power === "boolean") {
    return state.power ? "ON" : "OFF";
  }

  if (typeof state?.isOn === "boolean") {
    return state.isOn ? "ON" : "OFF";
  }

  return "CHANGE";
}

function normalizeValue(rawEvent) {
  if (rawEvent.value !== undefined) {
    return rawEvent.value;
  }

  if (rawEvent.state && typeof rawEvent.state === "object" && !Array.isArray(rawEvent.state)) {
    return rawEvent.state;
  }

  if (rawEvent.rawPayload && typeof rawEvent.rawPayload === "object") {
    return rawEvent.rawPayload;
  }

  if (rawEvent.rawMessage !== undefined) {
    return { raw: rawEvent.rawMessage };
  }

  return null;
}

function normalizeEvent(rawEvent = {}) {
  const eventDate = rawEvent.occurredAt ? new Date(rawEvent.occurredAt) : new Date();
  const hour = rawEvent.context?.hour ?? eventDate.getHours();
  const value = normalizeValue(rawEvent);
  const state = rawEvent.state && typeof rawEvent.state === "object" ? rawEvent.state : {};

  return {
    userId: rawEvent.userId || undefined,
    homeId: rawEvent.homeId,
    roomId: rawEvent.roomId,
    deviceId: rawEvent.deviceId,
    deviceName: rawEvent.deviceName,
    roomName: rawEvent.roomName,
    source: rawEvent.source || "system",
    action: normalizeAction(rawEvent.action, state),
    value,
    occurredAt: eventDate,
    context: {
      temperature: pickNumber(
        rawEvent.context?.temperature,
        state.temperature,
        value?.temperature,
        rawEvent.rawPayload?.temperature
      ),
      humidity: pickNumber(
        rawEvent.context?.humidity,
        state.humidity,
        value?.humidity,
        rawEvent.rawPayload?.humidity
      ),
      hour,
      dayOfWeek: rawEvent.context?.dayOfWeek || getDayOfWeek(eventDate),
      timeOfDay: rawEvent.context?.timeOfDay || getTimeOfDay(hour),
    },
  };
}

module.exports = {
  normalizeEvent,
};
