const Activity = require("../models/Activity");
const Home = require("../models/Home");
const Suggestion = require("../models/suggestions");
const { normalizeEvent } = require("./eventNormalizer");
const { runSmartEngine } = require("./SmartEngine");

function stableValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return JSON.stringify(value);
  }

  const sorted = Object.keys(value)
    .sort()
    .reduce((accumulator, key) => {
      accumulator[key] = value[key];
      return accumulator;
    }, {});

  return JSON.stringify(sorted);
}

async function resolveUserId(homeId, providedUserId) {
  if (providedUserId || !homeId) {
    return providedUserId;
  }

  const home = await Home.findById(homeId).select("userId").lean();
  return home?.userId;
}

async function findRecentDuplicate(event, dedupeWindowMs) {
  if (!event.homeId || !event.deviceId) {
    return null;
  }

  const threshold = new Date(event.occurredAt.getTime() - dedupeWindowMs);
  const candidates = await Activity.find({
    homeId: event.homeId,
    deviceId: event.deviceId,
    action: event.action,
    occurredAt: { $gte: threshold },
  })
    .sort({ occurredAt: -1 })
    .limit(5);

  const eventValue = stableValue(event.value);

  return candidates.find((candidate) => stableValue(candidate.value) === eventValue) || null;
}

async function upsertSuggestion(suggestion) {
  const existing = await Suggestion.findOne({
    homeId: suggestion.homeId,
    dedupeKey: suggestion.dedupeKey,
    status: "pending",
  });

  if (!existing) {
    return Suggestion.create({
      ...suggestion,
      lastTriggeredAt: new Date(),
      occurrenceCount: 1,
    });
  }

  existing.type = suggestion.type;
  existing.priority = Math.min(existing.priority || 4, suggestion.priority || 4);
  existing.message = suggestion.message;
  existing.deviceId = suggestion.deviceId || existing.deviceId;
  existing.confidence = Math.max(existing.confidence || 0, suggestion.confidence || 0);
  existing.autoExecutable = suggestion.autoExecutable ?? existing.autoExecutable;
  existing.lastTriggeredAt = new Date();
  existing.occurrenceCount = (existing.occurrenceCount || 1) + 1;
  existing.contextSnapshot = suggestion.contextSnapshot || existing.contextSnapshot;

  if (!existing.userId && suggestion.userId) {
    existing.userId = suggestion.userId;
  }

  await existing.save();
  return existing;
}

async function refreshSuggestionsForHome({ homeId, userId }) {
  if (!homeId) {
    return [];
  }

  const latestActivity = await Activity.findOne({ homeId })
    .sort({ occurredAt: -1, createdAt: -1 });

  const smartSuggestions = await runSmartEngine({
    homeId,
    userId,
    activity: latestActivity || null,
  });

  const savedSuggestions = [];
  for (const suggestion of smartSuggestions) {
    savedSuggestions.push(
      await upsertSuggestion({
        ...suggestion,
        homeId,
        userId,
      })
    );
  }

  return savedSuggestions;
}

async function processActivityEvent(rawEvent, options = {}) {
  const userId = await resolveUserId(rawEvent.homeId, rawEvent.userId);
  const event = normalizeEvent({ ...rawEvent, userId });
  const dedupeWindowMs = options.dedupeWindowMs ?? 1500;

  const duplicate = await findRecentDuplicate(event, dedupeWindowMs);
  if (duplicate) {
    return {
      activity: duplicate,
      suggestions: [],
      deduped: true,
    };
  }

  const activity = await Activity.create(event);
  const smartSuggestions = await runSmartEngine({
    homeId: event.homeId,
    userId,
    activity,
  });

  const savedSuggestions = [];
  for (const suggestion of smartSuggestions) {
    savedSuggestions.push(
      await upsertSuggestion({
        ...suggestion,
        homeId: event.homeId,
        userId,
      })
    );
  }

  return {
    activity,
    suggestions: savedSuggestions,
    deduped: false,
  };
}

module.exports = {
  processActivityEvent,
  refreshSuggestionsForHome,
  upsertSuggestion,
};
