
# Mail Assistant Lite

Lightweight browser extension MVP for:
- Gmail + Outlook Web reply draft generation
- Human-in-the-loop review/edit before send
- Calendar event extraction and `.ics` download for Apple Calendar import

## What this MVP does

1. Adds an `AI Draft` floating button in Gmail and Outlook web.
2. Reads visible email content from the page.
3. Generates a suggested reply draft.
4. Inserts draft into the open reply editor.
5. Relies on Gmail/Outlook native autosave to keep it as a draft.
6. Extracts one event from email content and downloads an `.ics` file for Apple Calendar.

## Folder structure

- `extension/`: Chrome Manifest V3 extension
- `backend/server.js`: Optional zero-dependency Node backend

## Quick start

### 1) Load extension

1. Open Chrome/Edge: `chrome://extensions` or `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select: `mail-assistant-lite/extension`

### 2) Configure settings

1. Open the extension popup
2. Click **Open Settings**
3. Set either:
   - `Backend URL` (recommended), e.g. `http://localhost:8787`
   - Optional `Backend Auth Key` (required for cloud-secure mode)
   - or `OpenAI API Key` directly in extension settings
4. Keep model default (`gpt-4.1-mini`) for low cost

### 3) Use in Gmail/Outlook

1. Open an email thread
2. Click `AI Draft`
3. Click `Generate Draft`
4. Edit draft if needed
5. Click `Insert Reply` (it opens reply box automatically and pastes draft)
6. Wait for status `Draft replaced and auto-saved.` before sending
7. Review and send manually

### 4) Create Apple Calendar event draft

1. In the same panel, click `Create .ics`
2. A calendar file downloads
3. Open it with Apple Calendar to add the event

## Optional backend setup (recommended)

Run from `mail-assistant-lite/backend`:

```bash
cp .env.example .env.local
# edit .env.local and set OPENAI_API_KEY
node server.js
```

Health check:

```bash
curl -s http://localhost:8787/health
```

## Notes and limitations

- This is intentionally lightweight and DOM-based for fast integration.
- It supports Gmail and Outlook **web** today.
- Apple Calendar integration is currently `.ics` import based.
- It does not auto-send emails.
- Never commit API keys. Use `backend/.env.local` (ignored by git).

## Build release ZIP (for Web Store signing)

```bash
chmod +x scripts/build-extension-package.sh
./scripts/build-extension-package.sh
```

Then follow:

- `release/CHROME_WEB_STORE_SIGNING.md`

## Run backend on cloud

1. Deploy Docker image from project root `Dockerfile`
2. Set cloud env vars:
   - `OPENAI_API_KEY`
   - `EXTENSION_API_KEY` (long random shared secret)
   - `HOST=0.0.0.0`
3. In extension Settings:
   - Set `Backend URL` to your cloud URL
   - Set `Backend Auth Key` to same `EXTENSION_API_KEY`
4. Follow:
   - `release/CLOUD_DEPLOY.md`

## Next upgrades (if you want phase 2)

1. Gmail API OAuth + `users.drafts.create` for API-level draft control.
2. Microsoft Graph OAuth + `createReply`/`createReplyAll` draft flow.
3. CalDAV connector for direct iCloud calendar event creation.
4. Team templates, tone presets, and reply QA rules.
=======
# mail_assist_ai
Mail Assistant Lite is an AI-driven email assistant built with a backend API and browser extension. It leverages OpenAI models to generate context-aware replies, supporting secure API communication, environment-based configuration, and Docker deployment.

