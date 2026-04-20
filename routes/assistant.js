const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { GoogleGenAI, createPartFromUri, Type } = require("@google/genai");
const Device = require("../models/Device");
const Activity = require("../models/Activity");

fs.mkdirSync("uploads", { recursive: true });
const upload = multer({ dest: "uploads/" });

const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
const GEMINI_RETRYABLE_MARKERS = [
  "429",
  "500",
  "503",
  "RESOURCE_EXHAUSTED",
  "UNAVAILABLE",
  "INTERNAL",
  "DEADLINE_EXCEEDED",
];
const MAX_RETRIES_PER_MODEL = 2;

const ALLOWED_INTENTS = [
  "turn_on",
  "turn_off",
  "temperature",
  "weather",
  "greeting",
  "emergency",
  "call",
  "unknown",
];

const COMMAND_SCHEMA = {
  type: Type.OBJECT,
  propertyOrdering: ["intent", "device", "room"],
  required: ["intent", "device", "room"],
  properties: {
    intent: {
      type: Type.STRING,
      description: "The requested assistant action.",
      enum: ALLOWED_INTENTS,
    },
    device: {
      type: Type.STRING,
      description:
        "The device name mentioned by the user. Use an empty string if omitted.",
    },
    room: {
      type: Type.STRING,
      description:
        "The room name mentioned by the user. Use an empty string if omitted.",
    },
  },
};

const mqttClient = require("../mqttClient");

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function getGeminiClient() {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function stringifyError(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error.message) return String(error.message);

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isRetryableGeminiError(error) {
  const message = stringifyError(error).toUpperCase();
  return GEMINI_RETRYABLE_MARKERS.some((marker) =>
    message.includes(marker.toUpperCase())
  );
}

function getAudioMimeType(filePath, fallbackMimeType) {
  if (fallbackMimeType && fallbackMimeType !== "application/octet-stream") {
    return fallbackMimeType;
  }

  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".wav") return "audio/wav";
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".caf") return "audio/x-caf";
  if (extension === ".ogg") return "audio/ogg";
  if (extension === ".aac") return "audio/aac";
  return "audio/mp4";
}

function normalizeParsedCommand(parsed) {
  const intent = ALLOWED_INTENTS.includes(parsed?.intent)
    ? parsed.intent
    : "unknown";

  return {
    intent,
    device: String(parsed?.device ?? "").trim(),
    room: String(parsed?.room ?? "").trim(),
  };
}

function inferFallbackIntent(userText, parsedIntent) {
  if (parsedIntent && parsedIntent !== "unknown") {
    return parsedIntent;
  }

  const normalized = String(userText || "").toLowerCase();

  if (/\b(hello|hi|hey|good morning|good afternoon|good evening)\b/.test(normalized)) {
    return "greeting";
  }

  if (/\bweather\b/.test(normalized)) {
    return "weather";
  }

  if (/\btemperature\b/.test(normalized)) {
    return "temperature";
  }

  return "unknown";
}

async function withGeminiRetries(label, callback) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt += 1) {
    try {
      return await callback(attempt);
    } catch (error) {
      lastError = error;

      if (!isRetryableGeminiError(error) || attempt === MAX_RETRIES_PER_MODEL) {
        throw error;
      }

      const delayMs = 800 * attempt;
      console.warn(
        `${label} failed on attempt ${attempt}. Retrying in ${delayMs}ms...`,
        stringifyError(error)
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function generateContentWithFallback(buildRequest) {
  const ai = getGeminiClient();
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      return await withGeminiRetries(`Gemini ${model}`, () =>
        ai.models.generateContent(buildRequest(model))
      );
    } catch (error) {
      lastError = error;

      if (!isRetryableGeminiError(error)) {
        throw error;
      }

      console.warn(`Switching Gemini model after failure from ${model}`);
    }
  }

  throw lastError;
}

async function findMatchingDevice(deviceName, roomName) {
  if (!deviceName && !roomName) return null;

  const devices = await Device.find({});

  return (
    devices.find((device) => {
      const roomMatches =
        !roomName ||
        normalizeText(device.roomName).includes(normalizeText(roomName));
      const deviceMatches =
        !deviceName ||
        normalizeText(device.name).includes(normalizeText(deviceName));

      return roomMatches && deviceMatches;
    }) || null
  );
}

async function findTemperatureDevice(roomName) {
  const devices = await Device.find({});

  return (
    devices.find((device) => {
      const hasTemperature =
        typeof device?.state?.temperature === "number" ||
        typeof device?.state?.temperature === "string";
      const roomMatches =
        !roomName ||
        normalizeText(device.roomName).includes(normalizeText(roomName));

      return hasTemperature && roomMatches;
    }) || null
  );
}

function formatIndoorTemperatureResponse(device) {
  if (!device || device?.state?.temperature === undefined) {
    return null;
  }

  const roomLabel = device.roomName || "the room";
  return `${roomLabel} is ${device.state.temperature} degrees indoors.`;
}

async function transcribeAudioWithGemini(filePath, mimeType) {
  const ai = getGeminiClient();
  const uploadedFile = await withGeminiRetries("Gemini file upload", () =>
    ai.files.upload({
      file: filePath,
      config: { mimeType },
    })
  );

  try {
    const transcriptResponse = await generateContentWithFallback((model) => ({
      model,
      contents: [
        createPartFromUri(uploadedFile.uri, uploadedFile.mimeType || mimeType),
        "Transcribe the spoken words in this audio. Return only the transcript as plain text.",
      ],
      config: {
        temperature: 0,
      },
    }));

    return String(transcriptResponse.text || "").trim();
  } finally {
    if (uploadedFile?.name) {
      try {
        await ai.files.delete({ name: uploadedFile.name });
      } catch (deleteError) {
        console.warn("Failed to delete Gemini upload:", stringifyError(deleteError));
      }
    }
  }
}

async function parseCommandWithGemini(userText) {
  const commandResponse = await generateContentWithFallback((model) => ({
    model,
    contents: [
      `You are a smart home assistant.

Return a JSON object that matches the provided schema.

Allowed intents:
- turn_on
- turn_off
- temperature
- weather
- greeting
- emergency
- call
- unknown

Rules:
- Use only one intent.
- Use "greeting" for hello, hi, or similar greetings.
- Use "weather" when the user asks about weather, forecast, rain, sun, or outside temperature.
- Use "temperature" for indoor room/device temperature requests.
- Set "device" to the spoken device name, or "" if none was mentioned.
- Set "room" to the spoken room name, or "" if none was mentioned.
- If the request is unclear, use "unknown".

User request: ${userText}`,
    ],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: COMMAND_SCHEMA,
    },
  }));

  const parsed = JSON.parse(commandResponse.text || "{}");
  return normalizeParsedCommand(parsed);
}

router.post("/", upload.single("audio"), async (req, res) => {
  try {
    if (!getGeminiApiKey()) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is missing on the backend",
      });
    }

    console.log("Receiving audio file:", req.file ? req.file.path : "No file");

    if (!req.file?.path) {
      console.error("No file uploaded");
      return res.status(400).json({
        success: false,
        error: "No audio file was uploaded",
      });
    }

    const mimeType = getAudioMimeType(req.file.path, req.file.mimetype);
    const userText = await transcribeAudioWithGemini(req.file.path, mimeType);

    console.log("Transcribed text:", userText);

    if (!userText) {
      return res.status(400).json({
        success: false,
        error: "The audio could not be transcribed",
      });
    }

    const parsed = await parseCommandWithGemini(userText);
    const effectiveIntent = inferFallbackIntent(userText, parsed.intent);
    const normalizedParsed = { ...parsed, intent: effectiveIntent };
    const matchedDevice = await findMatchingDevice(
      normalizedParsed.device,
      normalizedParsed.room
    );

    let responseText =
      "I can help with lights, air conditioner, TV, temperature, weather, emergencies, and calls.";

    if (effectiveIntent === "turn_on") {
      if (!matchedDevice) {
        responseText = "I could not find that device.";
      } else {
        const topic = `home/${matchedDevice.homeId}/${matchedDevice.roomName}/${matchedDevice.name}`;
        mqttClient.publish(topic, "ON");
        matchedDevice.isOn = true;
        matchedDevice.lastUpdated = new Date();
        await matchedDevice.save();

        await Activity.create({
          homeId: matchedDevice.homeId,
          deviceId: matchedDevice._id,
          deviceName: matchedDevice.name,
          roomName: matchedDevice.roomName,
          action: "turned on from voice assistant",
        });

        responseText = `Turning on ${matchedDevice.name} in ${matchedDevice.roomName}`;
      }
    } else if (effectiveIntent === "turn_off") {
      if (!matchedDevice) {
        responseText = "I could not find that device.";
      } else {
        const topic = `home/${matchedDevice.homeId}/${matchedDevice.roomName}/${matchedDevice.name}`;
        mqttClient.publish(topic, "OFF");
        matchedDevice.isOn = false;
        matchedDevice.lastUpdated = new Date();
        await matchedDevice.save();

        await Activity.create({
          homeId: matchedDevice.homeId,
          deviceId: matchedDevice._id,
          deviceName: matchedDevice.name,
          roomName: matchedDevice.roomName,
          action: "turned off from voice assistant",
        });

        responseText = `Turning off ${matchedDevice.name} in ${matchedDevice.roomName}`;
      }
    } else if (effectiveIntent === "temperature") {
      const temperatureDevice =
        matchedDevice?.state?.temperature !== undefined
          ? matchedDevice
          : await findTemperatureDevice(normalizedParsed.room);

      responseText =
        formatIndoorTemperatureResponse(temperatureDevice) ||
        "I could not read a room temperature right now.";
    } else if (effectiveIntent === "weather") {
      const temperatureDevice = await findTemperatureDevice(normalizedParsed.room);
      const indoorMessage = formatIndoorTemperatureResponse(temperatureDevice);

      responseText = indoorMessage
        ? `${indoorMessage} Live outdoor weather is not connected yet.`
        : "I can tell indoor room temperature, but live outdoor weather is not connected yet.";
    } else if (effectiveIntent === "greeting") {
      responseText =
        "Hello. I am ready to help with your smart home.";
    } else if (effectiveIntent === "emergency") {
      responseText = "Emergency mode activated";
    } else if (effectiveIntent === "call") {
      responseText = "Calling your contact";
    }

    res.json({
      success: true,
      text: userText,
      response: responseText,
      parsed: normalizedParsed,
    });
  } catch (err) {
    console.error("Voice assistant error:", err);

    if (isRetryableGeminiError(err)) {
      return res.status(503).json({
        success: false,
        error: "Gemini is busy right now. Please try again in a few seconds.",
      });
    }

    res.status(500).json({
      success: false,
      error: stringifyError(err) || "Voice assistant failed",
    });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

module.exports = router;
