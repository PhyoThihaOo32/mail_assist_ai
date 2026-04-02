(() => {
  if (window.__mailAssistantInit) {
    return;
  }

  function createElement(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === "className") {
        el.className = value;
      } else if (key === "text") {
        el.textContent = value;
      } else if (key === "html") {
        el.innerHTML = value;
      } else {
        el.setAttribute(key, value);
      }
    });
    children.forEach((child) => child && el.appendChild(child));
    return el;
  }

  function ensureStyles() {
    if (document.getElementById("mail-assistant-lite-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "mail-assistant-lite-style";
    style.textContent = `
      .ma-lite-fab {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483640;
        border: 0;
        border-radius: 999px;
        background: #0f172a;
        color: #ffffff;
        font-size: 13px;
        font-weight: 600;
        padding: 10px 14px;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
      }
      .ma-lite-panel {
        position: fixed;
        right: 20px;
        bottom: 72px;
        width: 360px;
        max-height: min(82vh, 760px);
        overflow: auto;
        z-index: 2147483641;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 12px;
        box-shadow: 0 10px 35px rgba(15, 23, 42, 0.25);
        font-family: Arial, sans-serif;
        color: #111827;
      }
      .ma-lite-panel[hidden] {
        display: none;
      }
      .ma-lite-title {
        margin: 0 0 10px;
        font-size: 14px;
        font-weight: 700;
      }
      .ma-lite-label {
        display: block;
        font-size: 12px;
        margin: 0 0 4px;
        color: #374151;
      }
      .ma-lite-field {
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 12px;
        padding: 8px;
        box-sizing: border-box;
        margin-bottom: 8px;
        background: #f8fafc;
      }
      .ma-lite-field[readonly] {
        background: #f1f5f9;
      }
      .ma-lite-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin-bottom: 8px;
      }
      .ma-lite-btn {
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        font-size: 12px;
        background: #ffffff;
      }
      .ma-lite-btn.primary {
        background: #0f172a;
        color: #ffffff;
        border-color: #0f172a;
      }
      .ma-lite-btn.danger {
        background: #b91c1c;
        color: #ffffff;
        border-color: #b91c1c;
      }
      .ma-lite-status {
        font-size: 11px;
        color: #475569;
        margin-top: 4px;
        min-height: 14px;
      }
      .ma-lite-links {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 11px;
        margin-top: 6px;
      }
      .ma-lite-links a {
        color: #1d4ed8;
        text-decoration: none;
      }
      @media (max-width: 640px) {
        .ma-lite-panel {
          right: 8px;
          left: 8px;
          bottom: 64px;
          width: auto;
        }
        .ma-lite-fab {
          right: 8px;
          bottom: 10px;
        }
      }
    `;

    document.documentElement.appendChild(style);
  }

  function collectText(selectors, maxChars = 12000) {
    const chunks = [];
    const seen = new Set();

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        const text = (node.innerText || node.textContent || "").trim();
        if (!text || seen.has(text)) {
          return;
        }
        seen.add(text);
        chunks.push(text);
      });
    });

    const merged = chunks.join("\n\n---\n\n");
    return merged.length > maxChars ? merged.slice(0, maxChars) : merged;
  }

  function isInsideAssistantUi(element) {
    return Boolean(element?.closest?.("[id^='ma-lite-root-']"));
  }

  function isEditableField(element) {
    return Boolean(
      element &&
        (element.isContentEditable ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLInputElement)
    );
  }

  function isVisibleElement(element) {
    if (!element || isInsideAssistantUi(element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (!style || style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    return element.getClientRects().length > 0;
  }

  function scoreEditorCandidate(element) {
    if (!element) {
      return Number.NEGATIVE_INFINITY;
    }

    const aria = String(element.getAttribute("aria-label") || "").toLowerCase();
    const rect = element.getBoundingClientRect();

    let score = 0;
    if (element === document.activeElement) {
      score += 1000;
    }
    if (element.getAttribute("role") === "textbox") {
      score += 120;
    }
    if (element.getAttribute("g_editable") === "true") {
      score += 120;
    }
    if (aria.includes("message")) {
      score += 100;
    }
    if (aria.includes("body")) {
      score += 100;
    }

    score += Math.min((rect.width * rect.height) / 800, 600);
    score += Math.min((element.textContent || "").length, 120) / 10;

    return score;
  }

  function findEditor(selectors = []) {
    const active = document.activeElement;
    if (isEditableField(active) && isVisibleElement(active)) {
      return active;
    }

    const candidates = [];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (isEditableField(element) && isVisibleElement(element)) {
          candidates.push(element);
        }
      });
    });

    if (candidates.length === 0) {
      const fallbackSelectors = [
        "div[contenteditable='true'][role='textbox']",
        "div[contenteditable='true'][g_editable='true']",
        "div[contenteditable='true'][aria-label*='Body']",
        "div[contenteditable='true'][aria-label*='body']",
        "div[contenteditable='true']",
        "textarea"
      ];

      fallbackSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
          if (isEditableField(element) && isVisibleElement(element)) {
            candidates.push(element);
          }
        });
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => scoreEditorCandidate(b) - scoreEditorCandidate(a));
    return candidates[0] || null;
  }

  function clickActionButton(selectors = []) {
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (!isVisibleElement(element) || isInsideAssistantUi(element)) {
          continue;
        }
        if (clickUiElement(element)) {
          return true;
        }
      }
    }
    return false;
  }

  function clickUiElement(element) {
    if (!element) {
      return false;
    }

    const target = element.closest("button, [role='button'], [role='link'], a, [tabindex]") || element;
    if (!isVisibleElement(target) || isInsideAssistantUi(target)) {
      return false;
    }

    try {
      target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      target.click();
      return true;
    } catch (_error) {
      return false;
    }
  }

  function normalizeActionText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function findActionButtonByKeywords(keywords = []) {
    const normalizedKeywords = keywords
      .map((keyword) => normalizeActionText(keyword))
      .filter(Boolean);

    if (normalizedKeywords.length === 0) {
      return null;
    }

    const selector = [
      "button",
      "a",
      "div[role='button']",
      "span[role='button']",
      "span[role='link']",
      "div",
      "span",
      "[aria-label]",
      "[data-tooltip]",
      "[title]"
    ].join(",");

    const candidates = [];

    document.querySelectorAll(selector).forEach((element) => {
      if (!isVisibleElement(element) || isInsideAssistantUi(element)) {
        return;
      }

      const style = window.getComputedStyle(element);
      const hasButtonRole = element.getAttribute("role") === "button" || element.getAttribute("role") === "link";
      const maybeClickable =
        element.tagName === "BUTTON" ||
        element.tagName === "A" ||
        hasButtonRole ||
        typeof element.onclick === "function" ||
        element.tabIndex >= 0 ||
        style.cursor === "pointer";

      if (!maybeClickable) {
        return;
      }

      const isDisabled =
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true";

      if (isDisabled) {
        return;
      }

      const text = normalizeActionText(element.innerText || element.textContent || "");
      const aria = normalizeActionText(element.getAttribute("aria-label") || "");
      const tooltip = normalizeActionText(
        element.getAttribute("data-tooltip") || element.getAttribute("data-tooltip-content") || ""
      );
      const title = normalizeActionText(element.getAttribute("title") || "");

      const fields = [text, aria, tooltip, title].filter(Boolean);
      if (fields.length === 0) {
        return;
      }
      if (fields.every((field) => field.length > 120)) {
        return;
      }

      let matchScore = 0;

      for (const keyword of normalizedKeywords) {
        for (const field of fields) {
          if (field === keyword) {
            matchScore = Math.max(matchScore, 420);
            continue;
          }

          if (field.startsWith(`${keyword} `) || field.startsWith(`${keyword}:`)) {
            matchScore = Math.max(matchScore, 360);
            continue;
          }

          if (field.includes(keyword)) {
            matchScore = Math.max(matchScore, 240);
          }
        }
      }

      if (matchScore <= 0) {
        return;
      }

      if (normalizedKeywords.includes("send") && fields.some((field) => field.includes("feedback"))) {
        return;
      }

      const rect = element.getBoundingClientRect();
      let score = matchScore;

      if (element.tagName === "BUTTON") {
        score += 40;
      }

      // Prefer action buttons lower in the thread area over toolbar icons.
      score += Math.max(0, rect.top) / 8;
      score += Math.min((rect.width * rect.height) / 300, 120);

      candidates.push({ element, score });
    });

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].element || null;
  }

  function findElementByExactText(texts = []) {
    const textSet = new Set(
      texts
        .map((text) => normalizeActionText(text))
        .filter(Boolean)
    );

    if (textSet.size === 0) {
      return null;
    }

    let best = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    document.querySelectorAll("button, a, div, span").forEach((element) => {
      if (!isVisibleElement(element) || isInsideAssistantUi(element)) {
        return;
      }

      const text = normalizeActionText(element.innerText || element.textContent || "");
      if (!textSet.has(text)) {
        return;
      }

      const rect = element.getBoundingClientRect();
      let score = Math.max(0, rect.top);

      if (element.tagName === "BUTTON") {
        score += 60;
      }

      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    });

    return best;
  }

  function clickReplyButton(selectors = [], config = {}) {
    const fallbackKeywords =
      Array.isArray(config.replyFallbackKeywords) && config.replyFallbackKeywords.length > 0
        ? config.replyFallbackKeywords
        : ["reply", "reply all"];

    if (clickActionButton(selectors)) {
      return true;
    }

    const fallback = findActionButtonByKeywords(fallbackKeywords);
    if (fallback && clickUiElement(fallback)) {
      return true;
    }

    const exactTextFallback = findElementByExactText(fallbackKeywords);
    if (exactTextFallback && clickUiElement(exactTextFallback)) {
      return true;
    }

    return false;
  }

  function clickSendButton(selectors = [], config = {}) {
    const fallbackKeywords =
      Array.isArray(config.sendFallbackKeywords) && config.sendFallbackKeywords.length > 0
        ? config.sendFallbackKeywords
        : ["send", "send & archive"];

    if (clickActionButton(selectors)) {
      return true;
    }

    const fallback = findActionButtonByKeywords(fallbackKeywords);
    if (fallback && clickUiElement(fallback)) {
      return true;
    }

    const exactTextFallback = findElementByExactText(fallbackKeywords);
    if (exactTextFallback && clickUiElement(exactTextFallback)) {
      return true;
    }

    return false;
  }

  function dispatchShortcut(target, shortcut) {
    if (!shortcut || !shortcut.key) {
      return false;
    }

    const eventInit = {
      key: shortcut.key,
      code: shortcut.code || shortcut.key,
      ctrlKey: Boolean(shortcut.ctrlKey),
      metaKey: Boolean(shortcut.metaKey),
      altKey: Boolean(shortcut.altKey),
      shiftKey: Boolean(shortcut.shiftKey),
      bubbles: true,
      cancelable: true
    };

    const dispatchTarget = target || document;
    dispatchTarget.dispatchEvent(new KeyboardEvent("keydown", eventInit));
    dispatchTarget.dispatchEvent(new KeyboardEvent("keyup", eventInit));
    return true;
  }

  function tryReplyShortcut(config) {
    const shortcuts = [];

    if (Array.isArray(config?.replyShortcuts)) {
      shortcuts.push(...config.replyShortcuts);
    }
    if (config?.replyShortcut) {
      shortcuts.push(config.replyShortcut);
    }

    for (const shortcut of shortcuts) {
      if (dispatchShortcut(document, shortcut)) {
        return true;
      }
    }

    return false;
  }

  function trySendShortcuts(target, shortcuts = []) {
    for (const shortcut of shortcuts) {
      if (dispatchShortcut(target, shortcut)) {
        return true;
      }
    }
    return false;
  }

  function wait(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  function collectDraftStatusTexts(config) {
    const selectors =
      Array.isArray(config?.draftStatusSelectors) && config.draftStatusSelectors.length > 0
        ? config.draftStatusSelectors
        : ["[role='status']", "[aria-live='polite']", "[aria-live='assertive']"];

    const texts = [];
    const seen = new Set();

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!isVisibleElement(element) || isInsideAssistantUi(element)) {
          return;
        }

        const candidates = [
          element.innerText,
          element.textContent,
          element.getAttribute("aria-label"),
          element.getAttribute("title")
        ];

        candidates.forEach((raw) => {
          const normalized = normalizeActionText(raw);
          if (!normalized || seen.has(normalized)) {
            return;
          }
          seen.add(normalized);
          texts.push(normalized);
        });
      });
    });

    return texts;
  }

  function findDraftSaveConfirmation(config) {
    const keywords =
      Array.isArray(config?.draftStatusKeywords) && config.draftStatusKeywords.length > 0
        ? config.draftStatusKeywords
        : ["saved to drafts", "saved to draft", "draft saved"];

    const normalizedKeywords = keywords
      .map((keyword) => normalizeActionText(keyword))
      .filter(Boolean);

    if (normalizedKeywords.length === 0) {
      return null;
    }

    const statusTexts = collectDraftStatusTexts(config);
    for (const statusText of statusTexts) {
      if (normalizedKeywords.some((keyword) => statusText.includes(keyword))) {
        return statusText;
      }
    }

    return null;
  }

  async function waitForDraftSaveConfirmation(config) {
    const timeoutMs = Number(config?.draftStatusTimeoutMs) || 4500;
    const startedAt = Date.now();

    let confirmation = findDraftSaveConfirmation(config);
    if (confirmation) {
      return confirmation;
    }

    const waits = [120, 220, 320, 420, 600, 800, 1000, 1200];
    for (const delay of waits) {
      if (Date.now() - startedAt >= timeoutMs) {
        break;
      }

      const remaining = timeoutMs - (Date.now() - startedAt);
      await wait(Math.max(10, Math.min(delay, remaining)));
      confirmation = findDraftSaveConfirmation(config);
      if (confirmation) {
        return confirmation;
      }
    }

    return null;
  }

  function collectSendStatusTexts(config) {
    const selectors =
      Array.isArray(config?.sendStatusSelectors) && config.sendStatusSelectors.length > 0
        ? config.sendStatusSelectors
        : ["[role='alert']", "[role='status']", "[aria-live='polite']", "[aria-live='assertive']"];

    const texts = [];
    const seen = new Set();

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!isVisibleElement(element) || isInsideAssistantUi(element)) {
          return;
        }

        const candidates = [
          element.innerText,
          element.textContent,
          element.getAttribute("aria-label"),
          element.getAttribute("title")
        ];

        candidates.forEach((raw) => {
          const normalized = normalizeActionText(raw);
          if (!normalized || seen.has(normalized)) {
            return;
          }
          seen.add(normalized);
          texts.push(normalized);
        });
      });
    });

    return texts;
  }

  function findSendConfirmation(config) {
    const keywords =
      Array.isArray(config?.sendStatusKeywords) && config.sendStatusKeywords.length > 0
        ? config.sendStatusKeywords
        : ["message sent", "your message has been sent", "email sent", "sent successfully"];

    const normalizedKeywords = keywords
      .map((keyword) => normalizeActionText(keyword))
      .filter(Boolean);

    if (normalizedKeywords.length === 0) {
      return null;
    }

    const statusTexts = collectSendStatusTexts(config);
    for (const statusText of statusTexts) {
      if (normalizedKeywords.some((keyword) => statusText.includes(keyword))) {
        return statusText;
      }
    }

    return null;
  }

  function isEditorDismissed(editor) {
    if (!editor || !editor.isConnected) {
      return true;
    }
    return !isVisibleElement(editor);
  }

  async function waitForSendConfirmation(config, editor) {
    const timeoutMs = Number(config?.sendStatusTimeoutMs) || 7000;
    const startedAt = Date.now();

    let confirmation = findSendConfirmation(config);
    if (confirmation) {
      return "status";
    }

    if (isEditorDismissed(editor)) {
      return "editor-closed";
    }

    const waits = [120, 220, 320, 420, 600, 800, 1000, 1200, 1400];
    for (const delay of waits) {
      if (Date.now() - startedAt >= timeoutMs) {
        break;
      }

      const remaining = timeoutMs - (Date.now() - startedAt);
      await wait(Math.max(10, Math.min(delay, remaining)));

      confirmation = findSendConfirmation(config);
      if (confirmation) {
        return "status";
      }

      if (isEditorDismissed(editor)) {
        return "editor-closed";
      }
    }

    return null;
  }

  async function ensureReplyEditor(config, options = {}) {
    const forceOpenReply = Boolean(options.forceOpenReply);
    let editor = findEditor(config.editorSelectors || []);

    if (editor) {
      return editor;
    }

    if (!forceOpenReply) {
      return null;
    }

    const clicked = clickReplyButton(config.replyButtonSelectors || [], config);
    if (clicked) {
      const waits = [220, 350, 500, 800];
      for (const delay of waits) {
        await wait(delay);
        editor = findEditor(config.editorSelectors || []);
        if (editor) {
          return editor;
        }
      }
    }

    if (tryReplyShortcut(config)) {
      const waits = [220, 350, 500, 800];
      for (const delay of waits) {
        await wait(delay);
        editor = findEditor(config.editorSelectors || []);
        if (editor) {
          return editor;
        }
      }
    }

    return editor;
  }

  function insertTextIntoEditor(editor, text) {
    const clean = String(text || "").trim();
    if (!clean) {
      return false;
    }

    if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
      editor.value = clean;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    editor.focus();

    let inserted = false;
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      inserted = document.execCommand("insertText", false, clean);
    } catch (_error) {
      inserted = false;
    }

    if (!inserted) {
      editor.innerHTML = "";
      const lines = clean.split(/\n/);
      lines.forEach((line, index) => {
        if (index > 0) {
          editor.appendChild(document.createElement("br"));
        }
        editor.appendChild(document.createTextNode(line));
      });
    }

    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function sendMessage(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(payload, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "Unknown error"));
          return;
        }
        resolve(response);
      });
    });
  }

  function formatGoogleCalendarDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const mi = String(date.getUTCMinutes()).padStart(2, "0");
    const ss = String(date.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
  }

  function escapeFilename(name) {
    const normalized = String(name || "event")
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return normalized || "event";
  }

  function openWindow(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  window.__mailAssistantInit = function initMailAssistant(config) {
    const rootId = `ma-lite-root-${config.provider}`;
    if (document.getElementById(rootId)) {
      return;
    }

    ensureStyles();

    const root = createElement("div", { id: rootId });
    const fab = createElement("button", { className: "ma-lite-fab", type: "button", text: config.fabLabel || "AI Draft" });

    const panel = createElement("div", { className: "ma-lite-panel", hidden: "true" });
    const title = createElement("h3", { className: "ma-lite-title", text: `Mail Assistant Lite (${config.provider})` });

    const contextLabel = createElement("label", { className: "ma-lite-label", text: "Email Context" });
    const contextField = createElement("textarea", {
      className: "ma-lite-field",
      rows: "6",
      placeholder: "Email content to respond to..."
    });

    const instructionLabel = createElement("label", { className: "ma-lite-label", text: "Reply Guidance (optional)" });
    const instructionField = createElement("textarea", {
      className: "ma-lite-field",
      rows: "2",
      placeholder: "Example: keep it short and friendly."
    });

    const draftLabel = createElement("label", { className: "ma-lite-label", text: "Draft Reply" });
    const draftField = createElement("textarea", {
      className: "ma-lite-field",
      rows: "7",
      placeholder: "Generated draft appears here..."
    });

    const buttons = createElement("div", { className: "ma-lite-buttons" });
    const refreshBtn = createElement("button", { className: "ma-lite-btn", type: "button", text: "Refresh Context" });
    const draftBtn = createElement("button", { className: "ma-lite-btn primary", type: "button", text: "Generate Draft" });
    const insertBtn = createElement("button", { className: "ma-lite-btn", type: "button", text: "Insert Reply" });
    const sendBtn = createElement("button", { className: "ma-lite-btn danger", type: "button", text: "Send Email" });
    const eventBtn = createElement("button", { className: "ma-lite-btn", type: "button", text: "Create .ics" });

    buttons.appendChild(refreshBtn);
    buttons.appendChild(draftBtn);
    buttons.appendChild(insertBtn);
    buttons.appendChild(sendBtn);
    buttons.appendChild(eventBtn);

    const status = createElement("div", { className: "ma-lite-status", text: "Ready." });
    const links = createElement("div", { className: "ma-lite-links" });

    panel.appendChild(title);
    panel.appendChild(contextLabel);
    panel.appendChild(contextField);
    panel.appendChild(instructionLabel);
    panel.appendChild(instructionField);
    panel.appendChild(draftLabel);
    panel.appendChild(draftField);
    panel.appendChild(buttons);
    panel.appendChild(status);
    panel.appendChild(links);

    root.appendChild(fab);
    root.appendChild(panel);
    document.documentElement.appendChild(root);

    function setStatus(message) {
      status.textContent = message;
    }

    function setBusy(isBusy) {
      [refreshBtn, draftBtn, insertBtn, sendBtn, eventBtn].forEach((btn) => {
        btn.disabled = isBusy;
      });
      if (isBusy) {
        setStatus("Working...");
      }
    }

    function refreshContext() {
      contextField.value = collectText(config.contextSelectors);
      if (!contextField.value.trim()) {
        setStatus("No email text found. Open an email thread and retry.");
        return;
      }
      setStatus("Context refreshed.");
    }

    refreshContext();

    fab.addEventListener("click", () => {
      if (panel.hasAttribute("hidden")) {
        panel.removeAttribute("hidden");
        refreshContext();
      } else {
        panel.setAttribute("hidden", "true");
      }
    });

    refreshBtn.addEventListener("click", refreshContext);

    draftBtn.addEventListener("click", async () => {
      setBusy(true);
      links.innerHTML = "";
      try {
        const response = await sendMessage({
          type: "GENERATE_DRAFT",
          provider: config.provider,
          context: contextField.value,
          instruction: instructionField.value
        });
        draftField.value = response.draft || "";
        setStatus("Draft generated. Edit if needed, then insert.");
      } catch (error) {
        setStatus(`Draft error: ${error.message}`);
      } finally {
        setBusy(false);
      }
    });

    insertBtn.addEventListener("click", async () => {
      const draft = (draftField.value || "").trim();
      if (!draft) {
        setStatus("Generate or type a draft first.");
        return;
      }

      setBusy(true);
      try {
        const editor = await ensureReplyEditor(config, { forceOpenReply: true });

        if (!editor) {
          setStatus("Reply editor not found. Could not open reply automatically. Try again.");
          return;
        }

        const ok = insertTextIntoEditor(editor, draft);
        if (!ok) {
          setStatus("Insert failed.");
          return;
        }

        editor.focus();

        const draftSaveSignal = await waitForDraftSaveConfirmation(config);
        if (draftSaveSignal) {
          setStatus("Draft replaced and auto-saved.");
        } else {
          setStatus("Draft replaced. Waiting for autosave confirmation.");
        }
      } finally {
        setBusy(false);
      }
    });

    sendBtn.addEventListener("click", async () => {
      setBusy(true);
      try {
        const editor = await ensureReplyEditor(config, { forceOpenReply: true });
        if (!editor) {
          setStatus("Reply editor not found. Could not open reply automatically.");
          return;
        }

        editor.focus();

        const selectors =
          config.sendButtonSelectors || [
            "div[role='button'][aria-label^='Send']",
            "button[aria-label^='Send']",
            "button[title^='Send']"
          ];

        let sent = clickSendButton(selectors, config);

        if (!sent) {
          const fallbackShortcuts =
            config.sendShortcuts || [
              { key: "Enter", code: "Enter", metaKey: true },
              { key: "Enter", code: "Enter", ctrlKey: true }
            ];
          sent = trySendShortcuts(editor, fallbackShortcuts);
        }

        if (!sent) {
          setStatus("Send button not found. Use the native Send button.");
          return;
        }

        const sendSignal = await waitForSendConfirmation(config, editor);
        if (sendSignal) {
          draftField.value = "";
          setStatus("Email sent. Draft cleaned up.");
        } else {
          setStatus("Send triggered. Waiting for send confirmation.");
        }
      } finally {
        setBusy(false);
      }
    });

    eventBtn.addEventListener("click", async () => {
      setBusy(true);
      links.innerHTML = "";
      try {
        const eventContext = [
          (contextField.value || "").trim(),
          collectText(config.eventContextSelectors || [], 20000)
        ]
          .filter(Boolean)
          .join("\n\n---\n\n");

        const response = await sendMessage({
          type: "CREATE_EVENT",
          provider: config.provider,
          context: eventContext,
          instruction: instructionField.value
        });

        const event = response.event;
        const filenameBase = `${escapeFilename(event.title)}-${new Date(event.start).toISOString().slice(0, 10)}`;

        await sendMessage({
          type: "DOWNLOAD_ICS",
          ics: response.ics,
          filename: `${filenameBase}.ics`
        });

        const gStart = formatGoogleCalendarDate(event.start);
        const gEnd = formatGoogleCalendarDate(event.end);
        const gLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${gStart}/${gEnd}&details=${encodeURIComponent(event.description || "")}&location=${encodeURIComponent(event.location || "")}`;
        const oLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${encodeURIComponent(event.start)}&enddt=${encodeURIComponent(event.end)}&body=${encodeURIComponent(event.description || "")}&location=${encodeURIComponent(event.location || "")}`;

        const gAnchor = createElement("a", { href: "#", text: "Open in Google Calendar" });
        const oAnchor = createElement("a", { href: "#", text: "Open in Outlook Calendar" });
        gAnchor.addEventListener("click", (e) => {
          e.preventDefault();
          openWindow(gLink);
        });
        oAnchor.addEventListener("click", (e) => {
          e.preventDefault();
          openWindow(oLink);
        });

        links.appendChild(gAnchor);
        links.appendChild(oAnchor);

        setStatus("Event draft created. .ics downloaded for Apple Calendar import.");
      } catch (error) {
        setStatus(`Event error: ${error.message}`);
      } finally {
        setBusy(false);
      }
    });
  };
})();
