const DEFAULT_SETTINGS = {
  backendUrl: "",
  backendAuthKey: "",
  openaiApiKey: "",
  model: "gpt-4.1-mini",
  temperature: 0.2
};

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

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  handleMessage(request)
    .then((data) => sendResponse({ ok: true, ...data }))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

async function handleMessage(request) {
  if (!request || !request.type) {
    throw new Error("Invalid request.");
  }

  if (request.type === "GENERATE_DRAFT") {
    const draft = await generateDraft(request);
    return { draft };
  }

  if (request.type === "CREATE_EVENT") {
    const event = await generateEvent(request);
    const ics = buildIcs(event);
    return { event, ics };
  }

  if (request.type === "DOWNLOAD_ICS") {
    await downloadIcs(request.ics, request.filename || "mail-assistant-event.ics");
    return { downloaded: true };
  }

  throw new Error(`Unsupported message type: ${request.type}`);
}

async function generateDraft({ provider, context, instruction }) {
  const settings = await getSettings();
  const cleanContext = (context || "").trim();
  const cleanInstruction = (instruction || "").trim();

  if (!cleanContext) {
    throw new Error("Email context is empty.");
  }

  if (settings.backendUrl) {
    const result = await postJson(
      `${trimTrailingSlash(settings.backendUrl)}/v1/draft`,
      {
        provider,
        context: cleanContext,
        instruction: cleanInstruction
      },
      settings
    );
    if (!result.draft) {
      throw new Error("Backend returned empty draft.");
    }
    return result.draft;
  }

  if (!settings.openaiApiKey) {
    throw new Error("Open Options and set OpenAI API key or backend URL.");
  }

  const system = [
    "You are an email assistant.",
    "Write a professional and concise reply email draft.",
    "Output only the email body text, no extra commentary, no markdown fencing.",
    "Do not claim actions that were not requested."
  ].join(" ");

  const user = [
    `Provider: ${provider || "unknown"}`,
    "Email thread/context:",
    cleanContext,
    cleanInstruction ? `User guidance: ${cleanInstruction}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  const draft = await callOpenAIText({
    apiKey: settings.openaiApiKey,
    model: settings.model,
    temperature: settings.temperature,
    system,
    user
  });

  if (!draft) {
    throw new Error("Model returned empty draft.");
  }

  return draft.trim();
}

async function generateEvent({ provider, context, instruction }) {
  const settings = await getSettings();
  const cleanContext = (context || "").trim();
  const cleanInstruction = (instruction || "").trim();

  if (!cleanContext) {
    throw new Error("Email context is empty.");
  }

  if (settings.backendUrl) {
    const result = await postJson(
      `${trimTrailingSlash(settings.backendUrl)}/v1/event`,
      {
        provider,
        context: cleanContext,
        instruction: cleanInstruction
      },
      settings
    );
    return normalizeEvent(result.event || result);
  }

  if (!settings.openaiApiKey) {
    throw new Error("Open Options and set OpenAI API key or backend URL.");
  }

  const now = new Date();
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const defaultEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const system = [
    "Extract one calendar event from the email context.",
    "Return strict JSON with keys: title,start,end,timezone,location,description.",
    "Use ISO 8601 for start and end.",
    "Use an IANA timezone name for timezone, for example America/New_York.",
    "If timezone is not explicitly stated, assume the user's local timezone.",
    "Prefer returning start/end with explicit UTC offset, for example 2026-04-07T11:00:00-04:00.",
    "Preserve the exact date and clock time from the invite whenever available.",
    "If uncertain, pick the most likely event and include short assumptions in description.",
    "Output JSON only."
  ].join(" ");

  const user = [
    `Provider: ${provider || "unknown"}`,
    `Current time: ${now.toISOString()}`,
    `User local timezone: ${localTimezone}`,
    `Fallback start: ${defaultStart}`,
    `Fallback end: ${defaultEnd}`,
    "Email thread/context:",
    cleanContext,
    cleanInstruction ? `User guidance: ${cleanInstruction}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await callOpenAIText({
    apiKey: settings.openaiApiKey,
    model: settings.model,
    temperature: settings.temperature,
    system,
    user
  });

  const parsed = parseJsonLoose(raw);
  return normalizeEvent(parsed);
}

function normalizeEvent(event) {
  const now = new Date();
  const fallbackStart = new Date(now.getTime() + 60 * 60 * 1000);
  const fallbackEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const start = safeDate(event?.start, fallbackStart);
  const endFallback = fallbackEnd.getTime() <= start.getTime() ? new Date(start.getTime() + 60 * 60 * 1000) : fallbackEnd;
  const end = safeDate(event?.end, endFallback);

  const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const title = sanitizeText(event?.title || "New Event");
  const description = sanitizeText(event?.description || "Created by Mail Assistant Lite");
  const location = sanitizeText(event?.location || "");
  const timezone = sanitizeTimeZone(event?.timezone, defaultTimezone);

  return {
    title,
    description,
    location,
    timezone,
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function buildIcs(event) {
  const uid = `mail-assistant-${Date.now()}@local`;
  const timezone = sanitizeTimeZone(event?.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const dtStamp = toIcsUtcDate(new Date());
  const dtStart = toIcsLocalDate(new Date(event.start), timezone);
  const dtEnd = toIcsLocalDate(new Date(event.end), timezone);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mail Assistant Lite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${escapeIcs(timezone)}`,
    "BEGIN:VEVENT",
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${escapeIcs(timezone)}:${dtStart}`,
    `DTEND;TZID=${escapeIcs(timezone)}:${dtEnd}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`,
    `LOCATION:${escapeIcs(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return lines.join("\r\n");
}

async function downloadIcs(ics, filename) {
  if (!ics || !ics.trim()) {
    throw new Error("ICS content is empty.");
  }

  const safeName = sanitizeFilename(filename || "mail-assistant-event.ics");
  const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;

  await chrome.downloads.download({
    url: dataUrl,
    filename: safeName,
    saveAs: true
  });
}

async function callOpenAIText({ apiKey, model, temperature, system, user }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = data?.error?.message || `OpenAI request failed (${response.status})`;
    throw new Error(msg);
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

async function postJson(url, payload, settings = {}) {
  const headers = { "Content-Type": "application/json" };
  const backendAuthKey = normalizeSecretInput(settings.backendAuthKey);
  if (backendAuthKey) {
    headers["X-Extension-Key"] = backendAuthKey;
  }

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
  } catch (_error) {
    const error = new Error(
      `Failed to reach backend at ${url}. Check Backend URL and extension site access permissions.`
    );
    error.statusCode = 0;
    throw error;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = String(data?.error || data?.message || `Request failed (${response.status})`);
    if (response.status === 401 && /extension auth key/i.test(msg)) {
      throw new Error(
        "Invalid backend auth key. Open extension settings and paste the same EXTENSION_API_KEY used by the backend."
      );
    }
    if (response.status === 401 && /missing extension auth key/i.test(msg)) {
      throw new Error(
        "Backend auth key missing. Open extension settings and set Backend Auth Key to your EXTENSION_API_KEY."
      );
    }
    throw new Error(msg);
  }

  return data;
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const backendUrl = trimTrailingSlash(String(stored.backendUrl || ""));
  const backendAuthKey = normalizeSecretInput(stored.backendAuthKey);
  const openaiApiKey = normalizeSecretInput(stored.openaiApiKey);

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    backendUrl,
    backendAuthKey,
    openaiApiKey
  };
}

function trimTrailingSlash(value) {
  return (value || "").replace(/\/+$/, "");
}

function parseJsonLoose(text) {
  const raw = (text || "").trim();
  if (!raw) {
    throw new Error("No JSON returned for event extraction.");
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Could not parse JSON event payload.");
    }
    return JSON.parse(match[0]);
  }
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

function toIcsUtcDate(date) {
  const d = safeDate(date, new Date());
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function toIcsLocalDate(date, timezone) {
  const d = safeDate(date, new Date());
  const parts = getDatePartsInTimeZone(d, timezone);
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function getDatePartsInTimeZone(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const mapped = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      mapped[part.type] = part.value;
    }
  }

  return {
    year: mapped.year || "1970",
    month: mapped.month || "01",
    day: mapped.day || "01",
    hour: mapped.hour || "00",
    minute: mapped.minute || "00",
    second: mapped.second || "00"
  };
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
  const raw = sanitizeText(value || "");
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

function escapeIcs(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function sanitizeText(value) {
  return String(value || "").replace(/[\r\0]/g, "").trim();
}

function sanitizeFilename(value) {
  const normalized = String(value || "mail-assistant-event.ics")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!normalized) {
    return "mail-assistant-event.ics";
  }

  return normalized.endsWith(".ics") ? normalized : `${normalized}.ics`;
}

function normalizeSecretInput(value) {
  let text = String(value || "").trim();
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

  return text.replace(/[\r\0]/g, "").trim();
}
