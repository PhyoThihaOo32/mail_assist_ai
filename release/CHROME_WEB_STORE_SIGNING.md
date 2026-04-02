# Chrome Web Store Signing

You cannot create a Chrome Web Store "signed install" fully offline.
For public distribution, signing happens when you publish through the Chrome Web Store.

## 1) Build the release ZIP

From project root:

```bash
chmod +x scripts/build-extension-package.sh
./scripts/build-extension-package.sh
```

This creates:

- `dist/mail-assistant-lite-extension-v<version>.zip`

## 2) Prepare store listing assets

- Extension name and description
- At least one screenshot
- Privacy policy URL
- Support/contact URL

## 3) Upload in Chrome Web Store Developer Dashboard

1. Open [https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
2. Create item / select existing item
3. Upload the ZIP from `dist/`
4. Complete listing + privacy fields
5. Submit for review

## 4) Publish

Once approved and published:

- Users install from Chrome Web Store
- Google serves signed extension packages to users automatically

## Notes

- Keep `manifest.json` `version` increasing on every update.
- If you change host permissions, expect additional review scrutiny.
- For local development, continue using unpacked extension from `extension/`.

