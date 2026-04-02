const defaults = {
  backendUrl: "",
  backendAuthKey: "",
  openaiApiKey: "",
  model: "gpt-4.1-mini",
  temperature: 0.2
};

const backendUrlEl = document.getElementById("backendUrl");
const backendAuthKeyEl = document.getElementById("backendAuthKey");
const openaiApiKeyEl = document.getElementById("openaiApiKey");
const modelEl = document.getElementById("model");
const temperatureEl = document.getElementById("temperature");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("save");
const resetBtn = document.getElementById("reset");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#0f766e";
}

function normalizeTemperature(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return defaults.temperature;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 1) {
    return 1;
  }
  return Math.round(parsed * 10) / 10;
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

function loadSettings() {
  chrome.storage.sync.get(Object.keys(defaults), (stored) => {
    const data = { ...defaults, ...stored };
    backendUrlEl.value = data.backendUrl || "";
    backendAuthKeyEl.value = data.backendAuthKey || "";
    openaiApiKeyEl.value = data.openaiApiKey || "";
    modelEl.value = data.model || defaults.model;
    temperatureEl.value = String(data.temperature ?? defaults.temperature);
  });
}

saveBtn.addEventListener("click", () => {
  const normalizedBackendAuthKey = normalizeSecretInput(backendAuthKeyEl.value);
  const normalizedOpenAiApiKey = normalizeSecretInput(openaiApiKeyEl.value);

  const payload = {
    backendUrl: backendUrlEl.value.trim(),
    backendAuthKey: normalizedBackendAuthKey,
    openaiApiKey: normalizedOpenAiApiKey,
    model: modelEl.value.trim() || defaults.model,
    temperature: normalizeTemperature(temperatureEl.value)
  };

  chrome.storage.sync.set(payload, () => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message, true);
      return;
    }
    backendAuthKeyEl.value = normalizedBackendAuthKey;
    openaiApiKeyEl.value = normalizedOpenAiApiKey;
    setStatus("Settings saved.");
  });
});

resetBtn.addEventListener("click", () => {
  chrome.storage.sync.set(defaults, () => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message, true);
      return;
    }
    loadSettings();
    setStatus("Defaults restored.");
  });
});

loadSettings();
