const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

loadEnvFile(path.join(__dirname, ".env.local"));
loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const EXTENSION_API_KEY = normalizeSecretInput(process.env.EXTENSION_API_KEY || "");
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const TEMPERATURE = Number(process.env.OPENAI_TEMPERATURE || 0.2);
const DEFAULT_TIMEZONE =
  process.env.DEFAULT_TIMEZONE ||
  Intl.DateTimeFormat().resolvedOptions().timeZone ||
  "America/New_York";

const TIMEZONE_ALIASES = {
  "utc": "Etc/UTC",
  "gmt": "Etc/UTC",
  "z": "Etc/UTC",
  "eastern": "America/New_York",
  "eastern time": "America/New_York",
  "eastern standard time": "America/New_York",
  "eastern daylight time": "America/New_York",
  "et": "America/New_York",
  "est": "America/New_York",
  "edt": "America/New_York",
  "central": "America/Chicago",
  "central time": "America/Chicago",
  "central standard time": "America/Chicago",
  "central daylight time": "America/Chicago",
  "ct": "America/Chicago",
  "cst": "America/Chicago",
  "cdt": "America/Chicago",
  "mountain": "America/Denver",
  "mountain time": "America/Denver",
  "mountain standard time": "America/Denver",
  "mountain daylight time": "America/Denver",
  "mt": "America/Denver",
  "mst": "America/Denver",
  "mdt": "America/Denver",
  "pacific": "America/Los_Angeles",
  "pacific time": "America/Los_Angeles",
  "pacific standard time": "America/Los_Angeles",
  "pacific daylight time": "America/Los_Angeles",
  "pt": "America/Los_Angeles",
  "pst": "America/Los_Angeles",
  "pdt": "America/Los_Angeles"
};

if (typeof fetch !== "function") {
  throw new Error("Global fetch is not available. Use Node.js 18+.");
}

const server = http.createServer(async (req, res) => {
  try {
    applyCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "mail-assistant-lite-backend",
        time: new Date().toISOString()
      });
      return;
    }

    if (req.method === "POST" && req.url === "/v1/draft") {
      assertKey();
      assertExtensionAuth(req);
      const body = await readJsonBody(req);
      const draft = await generateDraft(body);
      sendJson(res, 200, { draft });
      return;
    }

    if (req.method === "POST" && req.url === "/v1/event") {
      assertKey();
      assertExtensionAuth(req);
      const body = await readJsonBody(req);
      const event = await generateEvent(body);
      sendJson(res, 200, { event });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    sendJson(res, status, { error: error.message || "Internal server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Mail Assistant Lite backend listening on http://${HOST}:${PORT}`);
});

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Extension-Key");
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function assertKey() {
  if (!OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not set.");
    error.statusCode = 500;
    throw error;
  }
}

function assertExtensionAuth(req) {
  if (!EXTENSION_API_KEY) {
    return;
  }

  const headerValue = req.headers["x-extension-key"] || req.headers.authorization || "";
  const provided = normalizeSecretInput(headerValue);
  if (!provided) {
    const error = new Error("Missing extension auth key.");
    error.statusCode = 401;
    throw error;
  }

  if (!safeEqual(provided, EXTENSION_API_KEY)) {
    const error = new Error("Invalid extension auth key.");
    error.statusCode = 401;
    throw error;
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      const error = new Error("Request body too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    const error = new Error("Invalid JSON body.");
    error.statusCode = 400;
    throw error;
  }
}

async function generateDraft({ provider, context, instruction }) {
  const cleanContext = String(context || "").trim();
  const cleanInstruction = String(instruction || "").trim();

  if (!cleanContext) {
    const error = new Error("context is required.");
    error.statusCode = 400;
    throw error;
  }

  const system = [
    "You are an email assistant.",
    "Write a professional and concise reply email draft.",
    "Output only the email body text.",
    "No markdown code fences and no extra commentary."
  ].join(" ");

  const user = [
    `Provider: ${provider || "unknown"}`,
    "Email context:",
    cleanContext,
    cleanInstruction ? `Guidance: ${cleanInstruction}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  const text = await callOpenAI(system, user);
  if (!text) {
    throw new Error("Model returned empty draft.");
  }

  return text.trim();
}

async function generateEvent({ provider, context, instruction }) {
  const cleanContext = String(context || "").trim();
  const cleanInstruction = String(instruction || "").trim();

  if (!cleanContext) {
    const error = new Error("context is required.");
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const system = [
    "Extract one calendar event from email content.",
    "Return strict JSON with keys: title,start,end,timezone,location,description.",
    "Use ISO 8601 for start and end.",
    "Use an IANA timezone name for timezone, for example America/New_York.",
    "If timezone is not explicitly stated, assume the user's local timezone.",
    "Prefer returning start/end with explicit UTC offset, for example 2026-04-07T11:00:00-04:00.",
    "Preserve the exact date and clock time from the invite whenever available.",
    "Output JSON only."
  ].join(" ");

  const user = [
    `Provider: ${provider || "unknown"}`,
    `Current time: ${now.toISOString()}`,
    `User local timezone: ${DEFAULT_TIMEZONE}`,
    "Email context:",
    cleanContext,
    cleanInstruction ? `Guidance: ${cleanInstruction}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  const text = await callOpenAI(system, user);
  const parsed = parseJsonLoose(text);

  return normalizeEvent(parsed);
}

async function callOpenAI(system, user) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: TEMPERATURE,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `OpenAI request failed (${response.status})`;
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }

  return extractText(data);
}

function extractText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  const output = Array.isArray(data?.output) ? data.output : [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function parseJsonLoose(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("Empty event payload from model.");
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Could not parse event JSON payload.");
    }
    return JSON.parse(match[0]);
  }
}

function normalizeEvent(input) {
  const now = new Date();
  const fallbackStart = new Date(now.getTime() + 60 * 60 * 1000);
  const fallbackEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const start = safeDate(input?.start, fallbackStart);
  const endCandidate = safeDate(input?.end, fallbackEnd);
  const end = endCandidate.getTime() <= start.getTime() ? new Date(start.getTime() + 60 * 60 * 1000) : endCandidate;

  return {
    title: sanitize(input?.title || "New Event"),
    start: start.toISOString(),
    end: end.toISOString(),
    timezone: sanitizeTimeZone(input?.timezone, DEFAULT_TIMEZONE),
    location: sanitize(input?.location || ""),
    description: sanitize(input?.description || "Created by Mail Assistant Lite")
  };
}

function safeDate(value, fallback) {
  if (typeof value === "string") {
    const raw = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const fallbackDate = new Date(fallback);
      const hh = String(fallbackDate.getHours()).padStart(2, "0");
      const mm = String(fallbackDate.getMinutes()).padStart(2, "0");
      const ss = String(fallbackDate.getSeconds()).padStart(2, "0");
      const localDate = new Date(`${raw}T${hh}:${mm}:${ss}`);
      if (!Number.isNaN(localDate.getTime())) {
        return localDate;
      }
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date(fallback);
  }
  return date;
}

function sanitizeTimeZone(value, fallback) {
  const candidate = normalizeTimeZoneName(value);
  if (!candidate) {
    return fallback;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: candidate });
    return candidate;
  } catch (_error) {
    return fallback;
  }
}

function normalizeTimeZoneName(value) {
  const raw = sanitize(value || "");
  if (!raw) {
    return "";
  }

  const key = raw
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

  return TIMEZONE_ALIASES[key] || raw;
}

function sanitize(value) {
  return String(value || "").replace(/[\r\0]/g, "").trim();
}

function normalizeSecretInput(value) {
  let text = sanitize(value);
  if (!text) {
    return "";
  }

  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (firstLine) {
    text = firstLine;
  }

  const assignmentMatch = text.match(/^[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.+)$/);
  if (assignmentMatch) {
    text = assignmentMatch[1].trim();
  }

  text = text.replace(/^Bearer\s+/i, "").trim();

  if (
    (text.startsWith("\"") && text.endsWith("\"")) ||
    (text.startsWith("'") && text.endsWith("'")) ||
    (text.startsWith("`") && text.endsWith("`"))
  ) {
    text = text.slice(1, -1).trim();
  }

  return sanitize(text);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalIndex = line.indexOf("=");
    if (equalIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
