# Cloud Deployment (Secure)

This backend can run on any cloud provider that supports Docker web services.

## 1) Create a backend auth secret

Generate a long random key:

```bash
openssl rand -hex 32
```

Save this value. You will use it in:

- Cloud env var: `EXTENSION_API_KEY`
- Extension setting: `Backend Auth Key`

## 2) Deploy backend container

Use the repository root `Dockerfile`.

Required environment variables:

- `OPENAI_API_KEY` = your OpenAI API key
- `EXTENSION_API_KEY` = shared secret from step 1
- `OPENAI_MODEL` = `gpt-4.1-mini` (or your choice)
- `OPENAI_TEMPERATURE` = `0.2`
- `HOST` = `0.0.0.0`
- `PORT` = provider port (or leave default and let provider set `PORT`)

Health endpoint:

- `GET /health`

## 3) Set extension options

In extension Settings:

- `Backend URL` = your cloud URL (for example `https://your-app.onrender.com`)
- `Backend Auth Key` = exact same `EXTENSION_API_KEY`
- Keep `OpenAI API Key` empty (backend mode)

## 4) Verify

From terminal:

```bash
curl -s https://YOUR_BACKEND_DOMAIN/health
```

Expected:

```json
{"ok":true,"service":"mail-assistant-lite-backend","time":"..."}
```

If your provider supports custom domains, use your own domain and add it to extension `host_permissions` in `extension/manifest.json` before final packaging.

