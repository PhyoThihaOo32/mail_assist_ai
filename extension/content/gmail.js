(() => {
  const tryInit = () => {
    if (typeof window.__mailAssistantInit !== "function") {
      return;
    }

    window.__mailAssistantInit({
      provider: "gmail",
      fabLabel: "AI Draft",
      contextSelectors: [
        "div[data-message-id] div.a3s.aiL",
        "div.a3s.aiL",
        "div.ii.gt"
      ],
      eventContextSelectors: [
        "h2.hP",
        "div[role='main'] span.g3",
        "div[role='main'] div[data-message-id]",
        "div[role='main']"
      ],
      editorSelectors: [
        "div[role='textbox'][g_editable='true']",
        "div[aria-label='Message Body'][role='textbox']",
        "div[aria-label='message body'][role='textbox']",
        "div[contenteditable='true'][aria-label='Message Body']",
        "div[contenteditable='true'][aria-label='message body']",
        "div[contenteditable='true'][aria-label*='Body']",
        "div[contenteditable='true'][aria-label*='body']",
        "div[contenteditable='true'][aria-label*='Message']",
        "div[contenteditable='true'][g_editable='true']",
        "div[contenteditable='true'][role='textbox']"
      ],
      replyButtonSelectors: [
        "div[role='button'][aria-label='Reply']",
        "div[role='button'][aria-label^='Reply']",
        "span[role='link'][aria-label^='Reply']",
        "span[role='button'][aria-label^='Reply']",
        "[data-tooltip^='Reply']",
        "[aria-label*='Reply'][role='button']"
      ],
      replyShortcut: { key: "r", code: "KeyR" },
      replyFallbackKeywords: ["reply", "reply all"],
      sendButtonSelectors: [
        "div[role='button'][aria-label^='Send']",
        "div[role='button'][data-tooltip^='Send']",
        "button[aria-label^='Send']",
        "button[data-tooltip^='Send']"
      ],
      sendFallbackKeywords: ["send", "send & archive"],
      sendShortcuts: [
        { key: "Enter", code: "Enter", metaKey: true },
        { key: "Enter", code: "Enter", ctrlKey: true }
      ],
      sendStatusSelectors: [
        "div[role='alert']",
        "span[role='alert']",
        "div[role='status']",
        "span[role='status']",
        "div[aria-live='assertive']",
        "div[aria-live='polite']"
      ],
      sendStatusKeywords: ["message sent", "your message has been sent", "email sent"],
      sendStatusTimeoutMs: 7000,
      draftStatusSelectors: [
        "div[role='status']",
        "span[role='status']",
        "div[aria-live='polite']",
        "div[aria-live='assertive']",
        "span[aria-live='polite']",
        "span[aria-live='assertive']"
      ],
      draftStatusKeywords: ["saved to drafts", "saved to draft", "draft saved"],
      draftStatusTimeoutMs: 5000
    });
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    tryInit();
  } else {
    window.addEventListener("DOMContentLoaded", tryInit, { once: true });
  }

  const observer = new MutationObserver(() => {
    tryInit();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
