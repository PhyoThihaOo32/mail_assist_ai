const statusEl = document.getElementById("status");
const openOptionsBtn = document.getElementById("open-options");

openOptionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.sync.get(["backendUrl", "openaiApiKey", "model"], (data) => {
  const hasBackend = Boolean((data.backendUrl || "").trim());
  const hasKey = Boolean((data.openaiApiKey || "").trim());
  const model = (data.model || "gpt-4.1-mini").trim();

  if (hasBackend || hasKey) {
    statusEl.textContent = `Configured. Model: ${model}.`;
  } else {
    statusEl.textContent = "Not configured. Add backend URL or OpenAI API key in Settings.";
  }
});
