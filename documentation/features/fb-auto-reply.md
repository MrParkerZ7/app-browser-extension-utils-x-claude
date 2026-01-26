# FB Auto Reply

## Overview

FB Auto Reply is an automation tool that scans browser tabs for Facebook comment URLs and automatically posts a configurable reply message to each comment. It processes tabs sequentially with customizable delays between replies.

## Architecture

```
┌─────────────────────────┐              ┌─────────────────────────┐
│        Popup            │              │     Content Script      │
│    (FB Auto Reply UI)   │              │   (Facebook Page DOM)   │
└───────────┬─────────────┘              └───────────┬─────────────┘
            │                                        │
            │  chrome.tabs.query({})                 │
            │  Scan for facebook.com + comment_id   │
            ├──────────────────────────────────────► │
            │                                        │
            │  List of FB comment tabs               │
            │◄───────────────────────────────────────┤
            │                                        │
            │  chrome.tabs.update({ active: true })  │
            │  Switch to tab                         │
            ├──────────────────────────────────────► │
            │                                        │
            │  chrome.scripting.executeScript()      │
            │  Inject content script                 │
            ├──────────────────────────────────────► │
            │                                        │
            │  FB_AUTO_REPLY                         │
            │  { message: string }                   │
            ├──────────────────────────────────────► │
            │                                        │ performFBReply()
            │                                        │ - getCommentIdFromUrl()
            │                                        │ - findCommentById()
            │                                        │ - Click "Reply" button
            │                                        │ - Type message
            │                                        │ - Submit
            │  FBReplyResult                         │
            │◄───────────────────────────────────────┤
            │                                        │
            │  chrome.tabs.remove()                  │
            │  Close tab on success                  │
            ├──────────────────────────────────────► │
            ▼                                        │
┌─────────────────────────┐                          │
│   Process next tab      │                          │
│   (with delay)          │                          │
└─────────────────────────┘                          │
```

## Components

### Shared Types (`src/shared/types.ts`)

#### FBReplyResult
| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether the reply was posted successfully |
| `error` | `string?` | Error message if failed |

#### Message Types
| Type | Payload | Description |
|------|---------|-------------|
| `FB_AUTO_REPLY` | `{ message: string }` | Request to post a reply |
| `FB_AUTO_REPLY_RESULT` | `FBReplyResult` | Response with success/error |

### Content Script (`src/content/index.ts`)

#### getCommentIdFromUrl()

Extracts the comment ID from the current URL parameters.

```typescript
function getCommentIdFromUrl(): string | null {
  const url = new URL(window.location.href);
  // Try reply_comment_id first (more specific), then comment_id
  return url.searchParams.get('reply_comment_id') || url.searchParams.get('comment_id');
}
```

#### findCommentById(commentId: string)

Locates the specific comment element on the page using multiple strategies:

1. **Link href search** - Find links containing `comment_id=` in href, then get parent `[role="article"]`
2. **Data attribute search** - Look for `[data-ft*="ID"]` or `[data-commentid="ID"]`
3. **innerHTML search** - Search all `[role="article"]` elements containing the ID
4. **Timestamp/permalink links** - Check `a[href*="permalink"]` or `a[href*="comment"]`

#### performFBReply(message: string)

Main automation function that posts a reply to a Facebook comment:

1. **Wait for page load** - 2000ms initial delay
2. **Get comment ID** - Extract from URL parameters
3. **Find target comment** - Use `findCommentById()` to locate the element
4. **Scroll to comment** - `scrollIntoView({ behavior: 'smooth', block: 'center' })`
5. **Click Reply button** - Search for buttons with text "Reply", "Phản hồi", or "Trả lời"
6. **Find input field** - Locate `contenteditable` textbox using various selectors
7. **Type message** - Append text after existing @mention tag (see Text Insertion below)
8. **Submit** - Click submit button once, or fallback to Enter key

**Text Insertion Logic:**

When clicking "Reply" on Facebook, an @mention tag is automatically inserted (e.g., `@John Doe`). The extension preserves this tag and appends the message after it:

```typescript
// Move cursor to end of existing content (after @mention if present)
const selection = window.getSelection();
const range = document.createRange();
range.selectNodeContents(input);
range.collapse(false); // false = collapse to end
selection?.removeAllRanges();
selection?.addRange(range);

// Add space before message if @mention exists
const existingText = input.textContent?.trim() || '';
const textToInsert = existingText ? ' ' + message : message;

// Insert at cursor position (end)
document.execCommand('insertText', false, textToInsert);
```

**Result:** `@John Doe your message here` (not `your message here@John Doe`)

**Reply Button Detection:**
- Text matching: `reply`, `phản hồi`, `trả lời`
- Aria-label matching: `aria-label*="reply"`
- Visibility check: `offsetParent !== null`

**Input Field Selectors:**
```typescript
const inputSelectors = [
  '[contenteditable="true"][role="textbox"]',
  '[contenteditable="true"][data-lexical-editor="true"]',
  '[aria-label*="reply" i][contenteditable="true"]',
  '[aria-label*="comment" i][contenteditable="true"]',
  '[aria-label*="Write" i][contenteditable="true"]',
  'div[contenteditable="true"]',
];
```

**Submit Button Selectors:**
```typescript
const submitSelectors = [
  '[aria-label*="Submit" i]',
  '[aria-label*="Post" i]',
  '[aria-label*="Send" i]',
  '[aria-label*="Gửi" i]',
  '[aria-label*="Đăng" i]',
  '[data-testid*="submit"]',
  '[type="submit"]',
];
```

### Popup UI (`src/popup/popup.html`, `src/popup/index.ts`)

#### Layout

```
┌────────────────────────────────────────────────────────────────┐
│ Tabs: [Logging] [HTML Counter] [FB Auto Reply]                 │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  FB Auto Reply                                                 │
│  Auto reply to Facebook comment tabs (URLs with comment_id).   │
│                                                                │
│  Reply Message:                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Enter your reply message here...                         │ │
│  │                                                          │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Delay between replies (ms): [2000]                            │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Found 3 FB comment tab(s) ready to reply.       (status) │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Facebook Tabs Found: 3                                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ #1  Facebook Post Comment...            [Pending]        │ │
│  │ #2  Facebook Post Reply...              [Done]           │ │
│  │ #3  Facebook Comment Thread...          [Error]          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [Scan Tabs]  [Start Auto Reply]  [Stop]                       │
│                                                                │
│  ████████████░░░░░░░░ 2 / 3 completed                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### FBTab Interface

```typescript
interface FBTab {
  id: number;      // Chrome tab ID
  index: number;   // Tab index in browser
  title: string;   // Tab title
  url: string;     // Full URL
  status: 'skip' | 'pending' | 'processing' | 'done' | 'error';
  error?: string;  // Error message if status is 'error'
}
```

#### Tab Status States

| Status | Style | Description |
|--------|-------|-------------|
| `skip` | Gray | Tab skipped (not a valid FB comment URL) |
| `pending` | Default | Waiting to be processed |
| `processing` | Yellow | Currently being processed |
| `done` | Green | Successfully replied and tab closed |
| `error` | Red | Failed to reply |

#### Functions

**isFacebookCommentUrl(url: string)**
- Returns `true` if URL contains `facebook.com` AND `comment_id`

**scanFBTabs()**
- Queries all browser tabs with `chrome.tabs.query({})`
- Filters for Facebook comment URLs
- Populates `fbTabs[]` array with status `pending`
- Updates UI with found tabs

**startFBAutoReply()**
- Validates message is not empty
- Sets `fbReplyRunning = true`
- For each pending tab:
  1. Switch to tab (`chrome.tabs.update`)
  2. Wait 1500ms for page to be ready
  3. Inject content script (with 3 retry attempts)
  4. Wait 1000ms for script to initialize
  5. Send `FB_AUTO_REPLY` message (with 3 retry attempts)
  6. On success: mark as `done`, close tab
  7. On failure: mark as `error`
  8. Wait for configured delay before next tab

**stopFBAutoReply()**
- Sets `fbReplyAbort = true`
- Current tab finishes processing, then loop stops

**updateFBButtonStates()**
- Dynamically enables/disables buttons based on state:
  - Scan: disabled when running
  - Start: disabled when running OR no pending tabs
  - Stop: enabled only when running

## Storage

Settings are persisted to `chrome.storage.local`:

```typescript
// Keys: 'fbReplyMessage', 'fbReplyDelay'
chrome.storage.local.set({
  fbReplyMessage: messageEl.value,
  fbReplyDelay: delayEl.value
});

// Restored on popup open
const stored = await chrome.storage.local.get(['fbReplyMessage', 'fbReplyDelay']);
if (stored.fbReplyMessage) messageEl.value = stored.fbReplyMessage;
if (stored.fbReplyDelay) delayEl.value = stored.fbReplyDelay;
```

## Permissions

Required in `manifest.json`:

```json
{
  "permissions": [
    "activeTab",
    "tabs",
    "scripting"
  ],
  "host_permissions": [
    "*://*.facebook.com/*"
  ]
}
```

- `activeTab`: Access to current tab
- `tabs`: Query and switch between tabs
- `scripting`: Inject content script into Facebook pages
- `host_permissions`: Required for Facebook domain access

## Error Handling

### Content Script Injection Failed

When the content script cannot be injected (e.g., restricted page):

**Behavior:** Retries up to 3 times with 500ms delay between attempts

**User Action:** Check if the tab is a valid Facebook page

### Message Send Failed

When the popup cannot communicate with the content script:

**Behavior:** Re-injects content script and retries up to 3 times

**User Action:** Refresh the Facebook page and try again

### Comment Element Not Found

When `findCommentById()` cannot locate the target comment:

**Behavior:** Falls back to global search for reply buttons

**User Feedback:** Warning logged, attempts to reply to any visible reply button

### Reply Input Not Found

When no comment input field is detected:

**Behavior:** Returns `{ success: false, error: 'Could not find comment input' }`

**User Action:** Check if Facebook UI has changed or if the page loaded correctly

### Submit Button Not Found

When no submit button is found after typing:

**Behavior:** Falls back to pressing Enter key to submit

**User Feedback:** Warning logged, attempts keyboard submission

## Usage Examples

| Scenario | Steps |
|----------|-------|
| Reply to multiple comments | 1. Open Facebook comment tabs, 2. Open extension, 3. Enter message, 4. Click "Scan Tabs", 5. Click "Start Auto Reply" |
| Stop mid-process | Click "Stop" button; current tab finishes, then stops |
| Retry failed tabs | Click "Scan Tabs" to refresh, then "Start Auto Reply" |
| Adjust timing | Change "Delay between replies" value (500-10000ms) |

### Valid URL Patterns

| URL Pattern | Detected |
|-------------|----------|
| `facebook.com/post?comment_id=123` | Yes |
| `facebook.com/groups/123/posts/456?comment_id=789` | Yes |
| `facebook.com/photo?reply_comment_id=123` | Yes |
| `facebook.com/post` | No (missing comment_id) |
| `m.facebook.com/comment?comment_id=123` | Yes |

## Multi-Language Support

The extension supports both English and Vietnamese button/label detection:

| Language | Reply Button | Submit Button |
|----------|--------------|---------------|
| English | Reply | Submit, Post, Send |
| Vietnamese | Phản hồi, Trả lời | Gửi, Đăng |

## Future Enhancements

- [ ] Skip already-replied comments detection
- [ ] Custom message templates with variables
- [ ] Batch import URLs from file
- [ ] Scheduled/delayed start
- [ ] Per-tab custom messages
- [ ] Reply history/log export
- [ ] Support for Facebook Messenger
