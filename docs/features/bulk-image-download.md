# Bulk Image Download

Automatically detect image links on web pages and collect them for download.

## How It Works

1. **Start Listener** - Activates image detection on all browser tabs
2. **Browse Pages** - Visit pages with images (social media, galleries, etc.)
3. **Images Detected** - Extension intercepts image URLs from network requests
4. **Copy & Download** - Copy URLs to clipboard or download directly

## Usage

### Starting the Listener

1. Open the extension popup
2. Go to **Image DL** tab
3. Click **Start Listener**
4. Browse pages with images

### Downloading Images

- **Copy single URL**: Click **Copy** button next to an image
- **Copy all URLs**: Click **Copy All** button to copy all URLs (one per line)
- **Download via Chrome**: Click **DL** button to download through Chrome
- **Download all**: Click **Download All** to download all undownloaded images

### Settings

| Setting | Description |
|---------|-------------|
| Download path | Directory for Chrome downloads (not used for copy) |
| Auto-download | Automatically download when image is detected |

## Supported Sites

The extension attempts to detect image URLs from network requests. Detection may work on sites that use direct image URLs.

**Note:** Many modern sites use:
- Blob URLs (browser-only, cannot be downloaded)
- Lazy loading (images load as you scroll)
- Dynamic token-based URLs that expire quickly

Detection is best-effort and not guaranteed for any specific site.

## Detection Methods

### Network Request Interception

Uses `chrome.webRequest` API to intercept actual image URLs before they become blob URLs.

Detected patterns:
- Direct image files: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`, `.tiff`, `.avif`
- Common image URL patterns in paths (`/image/`, `/images/`, `/photo/`, `/img/`)
- Image CDN patterns

### Exclusions

The following are automatically filtered out:
- Favicons
- Small icons (icon-16x16, etc.)
- Sprites
- Placeholder images
- Loading spinners

## Limitations

1. **Blob URLs** - Cannot download `blob:` URLs (browser-only references)
2. **Data URLs** - Inline data URLs are filtered out
3. **Authentication** - Some CDN URLs require cookies/auth and may fail
4. **Chrome Download API** - May show "No permission" error for cross-origin URLs

## Tips

### For Best Results

1. Use **Copy** button and paste into external download manager (IDM, JDownloader, etc.)
2. Start listener before opening the page with images
3. Scroll through the page to trigger lazy-loaded images

### Using with IDM

1. Copy the image URL
2. Open IDM -> **Tasks** -> **Add URL** (or press `Ctrl+D`)
3. Paste the URL
4. Click **OK** to start download

### Using with JDownloader

1. Click **Copy All** to copy all URLs
2. JDownloader automatically detects clipboard URLs
3. Images appear in LinkGrabber

## Troubleshooting

### No images detected

- Make sure listener is running (status shows "Listening")
- Scroll through the page to trigger lazy-loaded images
- Some sites use blob URLs or data URLs

### Download fails with "No permission"

- Use **Copy** button instead and paste into external download manager
- The URL may require authentication cookies

### Image URL is a blob

- Blob URLs cannot be downloaded externally
- The actual image URL should be detected from network requests
- Try refreshing the page with listener already running

### Too many small images

- The extension filters out common icon patterns
- Small favicon-like images should be excluded automatically
