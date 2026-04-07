(() => {
  const tryInit = () => {
    if (typeof window.__mailAssistantInit !== "function") {
      return;
    }

    window.__mailAssistantInit({
      provider: "outlook",
      fabLabel: "AI Draft",
      contextSelectors: [
        "div[aria-label='Message body']",
        "div[role='document']",
        "div[data-app-section='MailReadCompose'] div[dir='ltr']"
      ],
      editorSelectors: [
        "div[contenteditable='true'][aria-label='Message body']",
        "div[role='textbox'][aria-label='Message body']",
        "div[contenteditable='true'][id*='editor']",
        "div[contenteditable='true'][role='textbox']"
      ],
      replyButtonSelectors: [
        "button[aria-label='Reply']",
        "button[aria-label^='Reply']",
        "button[aria-label='Reply all']",
        "button[aria-label^='Reply all']",
        "div[role='button'][aria-label='Reply']",
        "div[role='button'][aria-label^='Reply']",
        "button[title='Reply']"
      ],
      replyShortcut: { key: "r", code: "KeyR" },
      replyFallbackKeywords: ["reply", "reply all", "reply to all"],
      sendButtonSelectors: [
        "button[aria-label='Send']",
        "button[aria-label^='Send']",
        "div[role='button'][aria-label='Send']",
        "div[role='button'][aria-label^='Send']",
        "button[title='Send']"
      ],
      sendFallbackKeywords: ["send", "send now", "send email"],
      sendShortcuts: [
        { key: "Enter", code: "Enter", ctrlKey: true },
        { key: "Enter", code: "Enter", metaKey: true }
      ],
      sendStatusSelectors: [
        "div[role='alert']",
        "span[role='alert']",
        "div[role='status']",
        "span[role='status']",
        "div[aria-live='assertive']",
        "div[aria-live='polite']"
      ],
      sendStatusKeywords: ["message sent", "your message has been sent", "email sent", "sent successfully"],
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

  const intervalId = window.setInterval(() => {
    tryInit();
  }, 1500);

  window.addEventListener(
    "pagehide",
    () => {
      observer.disconnect();
      window.clearInterval(intervalId);
    },
    { once: true }
  );
})();
