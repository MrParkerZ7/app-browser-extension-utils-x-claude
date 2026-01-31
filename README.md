# 🧩 Browser Extension

A Chrome browser extension for Facebook automation built with TypeScript and Webpack.

## ✨ Features

### 1. 💬 FB Auto Reply
Automatically reply to Facebook comments with customizable templates.

- **Source modes:** Scan open tabs or process bookmarks from a folder
- **Template modes:** Random, Sequential, or Shuffled selection
- **Actions:** Click reply, input text, upload images, submit reply
- **Auto-close tabs** after replying

### 2. 🔔 FB Notification Listener
Monitor Facebook notifications and automatically open matching ones in new tabs.

### 3. 📹 Bulk Video Download
Detect and collect video URLs from web pages for bulk downloading.

- **Auto-detection:** Intercepts video URLs from network requests
- **Copy URLs:** Copy single or all URLs to clipboard for external download managers
- **Chrome download:** Direct download through Chrome (may have limitations)

> ⚠️ Detection works on sites with direct video URLs. Sites using DRM, blob URLs, or encrypted streams may not work.

#### 🎮 Usage:
1. Click **Start Listener** to begin detection
2. Browse pages with videos
3. Videos appear in the list as they're detected
4. Click **Copy** to copy URL, then paste into IDM/JDownloader
5. Or click **DL** to download via Chrome

ℹ️ See [docs/features/bulk-video-download.md](./docs/features/bulk-video-download.md) for detailed documentation.

#### ⚙️ Configuration Options:
- **Filters:**
  - Mentions your name
  - Reply notifications
  - All comment notifications

- **Options:**
  - **Expand previous notifications** - Click "See previous notifications" button to load older notifications before scanning
  - **Mark all as read** - Automatically mark all notifications as read after scanning
  - **Auto-start FB Auto Reply** - Automatically start the auto-reply feature when a matching notification is opened

- **Check interval** - How often to check for new notifications (in seconds, min: 10, max: 3600)

#### 🎮 Controls:
- **Start** - Start the notification listener
- **Stop** - Stop the notification listener
- **Check Now** - Manually trigger a notification check

#### 📊 Stats:
- Last check time
- Next scheduled check
- Notifications found
- Tabs opened

ℹ️ For detailed feature documentation, see [docs/features](./docs/features/).

## 🛠️ Development

### 📦 Setup
```bash
npm install
```

### 🔧 Development Mode
```bash
npm run dev
```

### 🏗️ Production Build
```bash
npm run build
```

### ✨ Linting & Formatting
```bash
npm run lint        # Check for linting errors
npm run lint:fix    # Fix linting errors
npm run format      # Check code formatting
npm run format:fix  # Format code with Prettier
npm run code:fix    # Run both lint:fix and format:fix
npm run code:check  # Check both lint and format
```

### 🧪 Testing
```bash
npm test             # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## 📥 Installation

1. Run `npm run build` to create the production build
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist` folder

## 📁 Project Structure

```
src/
  background/       # Service worker (background script)
  content/          # Content scripts injected into pages
  popup/            # Extension popup UI
    features/       # Feature modules
      fb-reply/           # FB Auto Reply feature
      fb-notif-listener/  # FB Notification Listener feature
      idm-listener/       # Bulk Video Download feature
  shared/           # Shared utilities and types
docs/
  features/         # Feature documentation
```

## 📝 TODO / Known Issues

### 🐛 FB Notification Listener - Scroll Issue
- [ ] **Expand previous notifications scroll not working** - After clicking the "See previous notifications" button, the scroll down to load more content is not functioning properly. Facebook likely uses a custom scrollable container instead of the window/body scroll.

#### 🔍 Attempted solutions:
1. `window.scrollTo(0, document.body.scrollHeight)` - Not working
2. `window.scrollBy()` + `document.documentElement.scrollTop` + `document.body.scrollTop` - Not working
3. Keyboard simulation (PageDown/End keys) - Not working

#### 👉 Next steps to try:
1. Find the actual scrollable container element on Facebook's notifications page using DevTools
2. Scroll that specific container instead of window/body
3. Or find the last notification element and use `scrollIntoView()`

### 📋 Other TODOs
- [ ] Add error handling improvements
- [ ] Add notification sound/desktop notification option
- [ ] Add filter by specific keywords
- [ ] Add exclude/ignore list for certain notifications
