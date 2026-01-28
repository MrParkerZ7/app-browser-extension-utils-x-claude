# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev          # Development build with watch mode
npm run build        # Production build to dist/
npm run clean        # Remove dist folder
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier format
npm run code-fix     # Run both lint:fix and format
npm run code-check   # Run both lint and format checks
npm test             # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Loading the Extension

1. Run `npm run build`
2. Open Chrome → `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" → select the `dist` folder

## Architecture

This is a Chrome Manifest V3 browser extension built with TypeScript and Webpack. It automates Facebook comment interactions.

### Entry Points (Webpack bundles)

- **background/index.ts** → `dist/background/index.js` - Service worker managing state and orchestrating tabs
- **content/index.ts** → `dist/content/index.js` - Injected into pages, performs DOM manipulation
- **popup/index.ts** → `dist/popup/index.js` - Extension popup UI

### Communication Pattern

All components communicate via `chrome.runtime.sendMessage()` and `chrome.runtime.onMessage`. Message types are defined in `src/shared/types.ts` as a discriminated union (`MessageType`).

**Flow:**
1. Popup sends commands to background (e.g., `FB_START_AUTO_REPLY`, `FB_NOTIF_START`)
2. Background maintains state and broadcasts updates (e.g., `FB_STATE_UPDATE`)
3. Background injects content script into target tabs via `chrome.scripting.executeScript()`
4. Content script receives task messages and returns results

### Key Features

**FB Auto Reply** (`src/popup/features/fb-reply/`):
- Scans open tabs for Facebook comment URLs (`comment_id` in URL)
- Injects content script to click reply, enter text, upload images, submit
- Processes tabs sequentially with configurable delays

**FB Notification Listener** (`src/popup/features/fb-notif-listener/`):
- Uses `chrome.alarms` for periodic notification page checks
- Content script scans notification DOM for matching items
- Opens matched notifications in new tabs

### State Management

- Background service worker holds in-memory state (`fbState`, `notifState`, `logState`)
- Config persisted via `chrome.storage.local`
- State updates broadcast to popup, popup subscribes on open

### Content Script Injection

Content script uses a window flag (`__contentScriptInitialized`) to prevent re-initialization when injected multiple times into the same page.

## Known Issue

Facebook notification page scrolling doesn't work reliably. The scroll container is not the window/body. See README.md TODO section for attempted solutions.
