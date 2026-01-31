# Bulk Video Download

Automatically detect video links on web pages and collect them for download.

## How It Works

1. **Start Listener** - Activates video detection on all browser tabs
2. **Browse Pages** - Visit pages with videos (TikTok, Facebook, Instagram, etc.)
3. **Videos Detected** - Extension intercepts video URLs from network requests
4. **Copy & Download** - Copy URLs to clipboard and paste into your download manager

## Usage

### Starting the Listener

1. Open the extension popup
2. Go to **Video DL** tab
3. Click **Start Listener**
4. Browse pages with videos

### Downloading Videos

- **Copy single URL**: Click **Copy** button next to a video
- **Copy all URLs**: Click **Copy All** button to copy all URLs (one per line)
- **Download via Chrome**: Click **DL** button to download through Chrome

### Settings

| Setting | Description |
|---------|-------------|
| Download path | Directory for Chrome downloads (not used for copy) |
| Auto-download | Automatically download when video is detected |

## Supported Sites

The extension attempts to detect video URLs from network requests. Detection may work on sites that use direct video URLs.

**Note:** Many modern sites use:
- Blob URLs (browser-only, cannot be downloaded)
- DRM/encrypted streams
- Dynamic token-based URLs that expire quickly

Detection is best-effort and not guaranteed for any specific site.

## Detection Methods

### Network Request Interception

Uses `chrome.webRequest` API to intercept actual video URLs before they become blob URLs.

Detected patterns:
- Direct video files: `.mp4`, `.webm`, `.mkv`, `.avi`, `.mov`, `.flv`
- Streaming formats: `.m3u8`, `.mpd`, `.ts`
- Common video URL patterns in paths and parameters

### Content Script Scanning

Scans page DOM for:
- `<video>` elements with `src` attribute
- `<source>` elements within videos
- Links to video files

**Note:** `blob:` URLs are filtered out as they cannot be downloaded externally.

## Limitations

1. **Blob URLs** - Cannot download `blob:` URLs (browser-only references)
2. **DRM Content** - Protected content cannot be intercepted
3. **Authentication** - Some CDN URLs require cookies/auth and may fail
4. **Chrome Download API** - May show "No permission" error for cross-origin URLs

## Tips

### For Best Results

1. Use **Copy** button and paste into external download manager (IDM, JDownloader, etc.)
2. Start listener before opening the page with videos
3. Play the video to trigger network requests

### Using with IDM

1. Copy the video URL
2. Open IDM → **Tasks** → **Add URL** (or press `Ctrl+D`)
3. Paste the URL
4. Click **OK** to start download

### Using with JDownloader

1. Click **Copy All** to copy all URLs
2. JDownloader automatically detects clipboard URLs
3. Videos appear in LinkGrabber

## Troubleshooting

### No videos detected

- Make sure listener is running (status shows "Listening")
- Play the video on the page to trigger network requests
- Some sites use DRM or encrypted streams

### Download fails with "No permission"

- Use **Copy** button instead and paste into external download manager
- The URL may require authentication cookies

### Video URL is a blob

- Blob URLs cannot be downloaded externally
- The actual video URL should be detected from network requests
- Try refreshing the page with listener already running
