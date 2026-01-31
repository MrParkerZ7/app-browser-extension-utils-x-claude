# 💬 FB Auto Reply

## 📋 Overview

FB Auto Reply is an automation tool that scans browser tabs for Facebook comment URLs and automatically posts a configurable reply message to each comment. It processes tabs sequentially with customizable delays between replies.

**Key Feature:** The auto-reply process runs in the background service worker, so it continues even when the popup is closed.

## 🏗️ Architecture

```
┌─────────────────────────┐
│        Popup            │
│    (FB Auto Reply UI)   │
└───────────┬─────────────┘
            │
            │  FB_SCAN_TABS, FB_START_AUTO_REPLY,
            │  FB_STOP_AUTO_REPLY, FB_SELECT_TAB, etc.
            │
            ▼
┌─────────────────────────┐              ┌─────────────────────────┐
│   Background Service    │              │     Content Script      │
│       Worker            │              │   (Facebook Page DOM)   │
│  (Main Job Runner)      │              │                         │
└───────────┬─────────────┘              └───────────┬─────────────┘
            │                                        │
            │  FB_STATE_UPDATE                       │
            │  (broadcasts state to popup)           │
            ├──────────────────────────────────────► │
            │                                        │
            │  chrome.tabs.query({})                 │
            │  Scan for facebook.com + comment_id   │
            ├────────────────────────────────────────┤
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
│   (with random delay)   │                          │
└─────────────────────────┘                          │
```

## 🧩 Components

### 📦 Shared Types (`src/shared/types.ts`)

#### FBReplyResult
| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether the reply was posted successfully |
| `error` | `string?` | Error message if failed |

#### FBTab
| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Chrome tab ID |
| `index` | `number` | Tab index in browser |
| `title` | `string` | Tab title |
| `url` | `string` | Full URL |
| `status` | `FBTabStatus` | Current processing status |
| `error` | `string?` | Error message if status is 'error' |
| `selected` | `boolean` | Whether tab is selected for processing |

#### FBTabStatus
`'pending' | 'processing' | 'done' | 'error'`

#### FBReplySteps
| Field | Type | Description |
|-------|------|-------------|
| `clickReply` | `boolean` | Whether to click the Reply button |
| `inputText` | `boolean` | Whether to input the message text |
| `uploadImages` | `boolean` | Whether to upload an image |
| `submitReply` | `boolean` | Whether to submit the reply |

#### FBReplyTemplate
| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Reply message text |
| `imageUrls` | `string[]` | List of image URLs (one randomly selected per reply) |

#### FBAutoReplyConfig
| Field | Type | Description |
|-------|------|-------------|
| `templates` | `FBReplyTemplate[]` | List of reply templates (one randomly selected per reply) |
| `delayMin` | `number` | Minimum delay between tabs (ms) |
| `delayMax` | `number` | Maximum delay between tabs (ms) |
| `steps` | `FBReplySteps` | Which reply steps to perform |
| `doClose` | `boolean` | Whether to close tabs after success |

#### FBAutoReplyState
| Field | Type | Description |
|-------|------|-------------|
| `running` | `boolean` | Whether auto-reply is currently running |
| `tabs` | `FBTab[]` | List of scanned Facebook tabs |
| `completed` | `number` | Number of tabs completed |
| `total` | `number` | Total number of tabs to process |
| `currentTabId` | `number?` | ID of tab currently being processed |

#### 📨 Message Types

**Content Script Messages:**
| Type | Payload | Description |
|------|---------|-------------|
| `FB_AUTO_REPLY` | `{ template: FBReplyTemplate, steps: FBReplySteps }` | Request to post a reply with template and steps |
| `FB_AUTO_REPLY_RESULT` | `FBReplyResult` | Response with success/error |

**Background Service Messages:**
| Type | Payload | Description |
|------|---------|-------------|
| `FB_SCAN_TABS` | - | Request to scan for Facebook tabs |
| `FB_START_AUTO_REPLY` | `FBAutoReplyConfig` | Start the auto-reply process |
| `FB_STOP_AUTO_REPLY` | - | Stop the running process |
| `FB_GET_STATE` | - | Get current state |
| `FB_STATE_UPDATE` | `FBAutoReplyState` | Broadcast state update to popup |
| `FB_SELECT_TAB` | `{ tabId, selected }` | Toggle tab selection |
| `FB_SELECT_ALL_TABS` | `{ selected }` | Select/deselect all tabs |

### 📜 Content Script (`src/content/index.ts`)

#### getCommentIdsFromUrl()

Extracts comment IDs from the current URL parameters and determines the target.

```typescript
interface CommentIds {
  commentId: string | null;      // The main comment ID
  replyCommentId: string | null; // The specific reply ID (if present)
  targetId: string | null;       // The ID to target (prefers reply_comment_id)
  isReplyTarget: boolean;        // Whether we're targeting a reply
}

function getCommentIdsFromUrl(): CommentIds {
  const url = new URL(window.location.href);
  const commentId = url.searchParams.get('comment_id');
  const replyCommentId = url.searchParams.get('reply_comment_id');

  return {
    commentId,
    replyCommentId,
    targetId: replyCommentId || commentId,
    isReplyTarget: replyCommentId !== null,
  };
}
```

**URL Targeting Logic:**
- URL with only `comment_id` → Target the main comment (prefer shallowest element)
- URL with both `comment_id` and `reply_comment_id` → Target the specific reply (prefer deepest element)

#### findCommentById(targetId: string, isReplyTarget: boolean)

Locates the specific comment element on the page using multiple strategies:

1. **Exact parameter match** - For `comment_id`, matches `comment_id=ID` (not `reply_comment_id=ID`)
2. **Depth-based selection** - Main comments prefer shallowest; replies prefer deepest
3. **Data attribute search** - Look for `[data-ft*="ID"]` or `[data-commentid="ID"]`
4. **Article search** - Search all `[role="article"]` elements containing the ID

#### performFBReply(message: string, imageUrls: string[], steps: FBReplySteps)

Main automation function that posts a reply to a Facebook comment. Each step can be enabled/disabled independently for testing purposes.

**Step 1: Click Reply Button** (if `steps.clickReply`)
1. Wait for page load - 2000ms initial delay
2. Get comment IDs from URL parameters
3. Find target comment using `findCommentById()`
4. Scroll to comment - `scrollIntoView({ behavior: 'smooth', block: 'center' })`
5. Click Reply button - Search for buttons with text "Reply", "Phản hồi", or "Trả lời"

**Step 2: Input Text** (if `steps.inputText`)
1. Find input field - Locate `contenteditable` textbox
2. Check for Facebook's automatic @mention
3. If no @mention, extract profile name and insert manual @mention
4. Type message after @mention

**Step 3: Upload Image** (if `steps.uploadImages`)
1. Fetch image from URL (already randomly selected by background)
2. Convert to File/Blob object
3. Attempt paste via ClipboardEvent
4. Fallback to DragEvent drop
5. Fallback to file input element
6. Wait up to 10 seconds for image attachment confirmation

**Step 4: Submit Reply** (if `steps.submitReply`)
1. Press Enter key to submit
2. If Enter fails, find and click submit button

**Text Insertion Logic:**

When clicking "Reply" on Facebook, an @mention tag may be automatically inserted. The extension:
1. Waits and checks up to 3 times for Facebook's @mention
2. If no @mention detected, extracts profile name from comment and inserts manual @mention
3. Appends the message after the @mention

```typescript
// Check for Facebook's @mention
let hasFacebookMention = false;
for (let attempt = 0; attempt < 3; attempt++) {
  const mentionSpan = input.querySelector('[data-lexical-text="true"]');
  const inputText = input.textContent?.trim() || '';
  if (mentionSpan || inputText.startsWith('@')) {
    hasFacebookMention = true;
    break;
  }
  await wait(500);
}

// If no @mention, extract profile name and insert manually
if (!hasFacebookMention && targetComment) {
  const profileName = extractProfileName(targetComment);
  if (profileName) {
    textToInsert = `@${profileName} ${message}`;
  }
}
```

**Result:** `@John Doe your message here`

#### extractProfileName(commentElement: HTMLElement)

Extracts the commenter's profile name for manual @mention insertion:

1. **First valid link** - The first link in a comment is typically the profile name
2. **Span with link** - Look for `span[dir="auto"]` containing links
3. **Profile URL pattern** - Links matching `/user/` or `profile.php`

Filters out: timestamps, action buttons (Like/Reply), comment links, and deeply nested elements

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

### ⚙️ Background Service Worker (`src/background/index.ts`)

The background service worker is the main job runner. It maintains state and processes tabs even when the popup is closed.

#### 🗃️ State Management

```typescript
let fbState: FBAutoReplyState = {
  running: false,
  tabs: [],
  completed: 0,
  total: 0,
};

let fbAbort = false;
```

#### 🔧 Functions

**isFacebookCommentUrl(url: string)**
- Returns `true` if URL contains `facebook.com` AND `comment_id`

**getRandomDelay(min: number, max: number)**
- Returns a random integer between min and max (inclusive)
- Used for varying delay between tab processing

**broadcastState()**
- Sends `FB_STATE_UPDATE` message to all extension pages
- Called after any state change to keep popup in sync

**scanFBTabs()**
- Queries all browser tabs with `chrome.tabs.query({})`
- Filters for Facebook comment URLs
- Populates `fbState.tabs` with status `pending` and `selected: true`
- Returns the list of found tabs

**startFBAutoReply(config: FBAutoReplyConfig)**
- Validates at least one action is selected
- Validates message is not empty (if Reply action is enabled)
- Sets `fbState.running = true`
- For each **selected** pending tab:
  1. Switch to tab (`chrome.tabs.update`) - only if Reply action is enabled
  2. Wait 1500ms for page to be ready
  3. Inject content script (with 3 retry attempts)
  4. Wait 1000ms for script to initialize
  5. If Reply enabled: Send `FB_AUTO_REPLY` message (with 3 retry attempts)
  6. If Close enabled: Close tab (`chrome.tabs.remove`)
  7. On success: mark as `done`, increment `completed`
  8. On failure: mark as `error` with error message
  9. Wait for random delay (between delayMin and delayMax) before next tab
- Broadcasts state after each tab

**stopFBAutoReply()**
- Sets `fbAbort = true`
- Current tab finishes processing, then loop stops

**selectTab(tabId: number, selected: boolean)**
- Updates selection state for a specific tab
- Only affects tabs with `pending` status

**selectAllTabs(selected: boolean)**
- Updates selection state for all tabs with `pending` status

### 🖥️ Popup UI (`src/popup/popup.html`, `src/popup/index.ts`)

#### 📐 Layout

```
┌────────────────────────────────────────────────────────────────┐
│ Tabs: [Logging] [HTML Counter] [FB Auto Reply]                 │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  FB Auto Reply                                                 │
│  Auto reply to Facebook comment tabs (URLs with comment_id).   │
│                                                                │
│  Reply steps to perform:                                       │
│  [✓] Click Reply button                                        │
│  [✓] Input text                                                │
│  [ ] Upload images                                             │
│  [✓] Submit reply                                              │
│                                                                │
│  After completion:                                             │
│  [✓] Close tab                                                 │
│                                                                │
│  Reply Templates (random per reply):                           │
│  [+] [1] [2 ×] [3 ×]                                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Message:                                                 │ │
│  │ ┌──────────────────────────────────────────────────────┐ │ │
│  │ │ Enter your reply message here...                     │ │ │
│  │ └──────────────────────────────────────────────────────┘ │ │
│  │                                                          │ │
│  │ Image URLs (random per reply):                           │ │
│  │ ┌────────────────────────────────────────────────┬────┐ │ │
│  │ │ https://example.com/image1.jpg                 │ ×  │ │ │
│  │ └────────────────────────────────────────────────┴────┘ │ │
│  │ [+ Add Image URL]                                        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Delay between replies (ms): [1500] to [3000]                  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Found 3 FB comment tab(s) ready to reply.       (status) │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Facebook Tabs Found: 3 (Selected: 2)   [Select All][Deselect] │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ [✓] #1  Facebook Post Comment...            [Pending]    │ │
│  │ [ ] #2  Facebook Post Reply...              [Pending]    │ │
│  │ [✓] #3  Facebook Comment Thread...          [Pending]    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [Scan Tabs]  [Reply & Close]  [Stop]                          │
│                                                                │
│  ████████████░░░░░░░░ 2 / 3 completed                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Note:** The "Stop" button is only visible when a job is running.
**Note:** Uncheck steps to test individual parts of the reply flow without submitting.
**Note:** Template tabs appear when "Input text" or "Upload images" is checked.

#### 🗂️ Local State

The popup maintains a local copy of the state that mirrors the background service worker:

```typescript
let fbState: FBAutoReplyState = {
  running: false,
  tabs: [],
  completed: 0,
  total: 0,
};
```

This state is updated via `FB_STATE_UPDATE` messages from the background.

#### 🏷️ Tab Status States

| Status | Style | Description |
|--------|-------|-------------|
| `pending` | Default | Waiting to be processed |
| `processing` | Yellow | Currently being processed |
| `done` | Green | Successfully replied and tab closed |
| `error` | Red | Failed to reply |

#### 🔧 Functions

All tab processing logic runs in the background service worker. The popup functions send messages to the background:

**scanFBTabs()**
- Sends `FB_SCAN_TABS` message to background
- Background scans tabs and broadcasts state update

**startFBAutoReply()**
- Validates at least one action is selected
- Validates message is not empty (if Reply action is enabled)
- Sends `FB_START_AUTO_REPLY` message with config to background
- Background processes tabs and broadcasts state updates

**stopFBAutoReply()**
- Sends `FB_STOP_AUTO_REPLY` message to background
- Background stops after current tab finishes

**selectTab(tabId, selected) / selectAllTabs(selected)**
- Sends `FB_SELECT_TAB` or `FB_SELECT_ALL_TABS` message to background
- Background updates state and broadcasts update

**applyFBState(state: FBAutoReplyState)**
- Updates local state from background state update
- Calls render functions to update UI

**State Sync Listener:**
```typescript
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'FB_STATE_UPDATE' && message.payload) {
    applyFBState(message.payload as FBAutoReplyState);
  }
});
```

#### 🎨 UI Functions

**updateFBButtonStates()**
- Dynamically enables/disables buttons based on state:
  - Scan: disabled when running
  - Start: disabled when running OR no **selected** pending tabs; label changes based on selected actions
  - Stop: hidden when not running, visible only when running
  - Select All / Deselect All: disabled when running or no tabs

**updateFBActionUI()**
- Updates UI based on selected actions:
  - Shows/hides message input based on Reply checkbox
  - Updates button states via `updateFBButtonStates()`

**renderFBTabs()**
- Renders tab list with checkboxes for selection
- Shows selected count in header
- Checkboxes disabled for non-pending tabs or when running
- Unselected tabs appear dimmed

**updateFBStatus() / updateFBProgress()**
- Updates status text and progress bar based on current state

## 💾 Storage

Settings are persisted to `chrome.storage.local`:

```typescript
// Keys for step checkboxes and settings
chrome.storage.local.set({
  fbTemplates: templates,                    // Array of FBReplyTemplate
  fbActiveTemplateIndex: activeTemplateIndex, // Currently selected tab
  fbReplyDelayMin: delayMinEl.value,
  fbReplyDelayMax: delayMaxEl.value,
  fbStepClickReply: stepClickReply.checked,
  fbStepInputText: stepInputText.checked,
  fbStepUploadImages: stepUploadImages.checked,
  fbStepSubmit: stepSubmit.checked,
  fbActionClose: closeCheckbox.checked
});

// Restored on popup open
const stored = await chrome.storage.local.get([
  'fbTemplates', 'fbActiveTemplateIndex',
  'fbReplyDelayMin', 'fbReplyDelayMax',
  'fbStepClickReply', 'fbStepInputText', 'fbStepUploadImages', 'fbStepSubmit', 'fbActionClose'
]);
```

## 🔐 Permissions

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

## ⚠️ Error Handling

### 🔌 Content Script Injection Failed

When the content script cannot be injected (e.g., restricted page):

**Behavior:** Retries up to 3 times with 500ms delay between attempts

**User Action:** Check if the tab is a valid Facebook page

### 📡 Message Send Failed

When the background cannot communicate with the content script:

**Behavior:** Re-injects content script and retries up to 3 times

**User Action:** Refresh the Facebook page and try again

### 🔍 Comment Element Not Found

When `findCommentById()` cannot locate the target comment:

**Behavior:** Falls back to global search for reply buttons

**User Feedback:** Warning logged, attempts to reply to any visible reply button

### 📝 Reply Input Not Found

When no comment input field is detected:

**Behavior:** Returns `{ success: false, error: 'Could not find comment input' }`

**User Action:** Check if Facebook UI has changed or if the page loaded correctly

### 🔘 Submit Button Not Found

When no submit button is found after typing:

**Behavior:** Falls back to pressing Enter key to submit

**User Feedback:** Warning logged, attempts keyboard submission

## 📝 Reply Templates

The extension supports multiple reply templates. For each reply, one template is randomly selected, providing variety in automated responses.

### 📄 Template Structure

Each template contains:
- **Message**: The text to post as a reply
- **Image URLs**: A list of image URLs (one randomly selected per reply)

### 🗂️ Template Tabs UI

```
[+] [1] [2 ×] [3 ×]
```

- **[+]** - Add new template (on the left)
- **[1]** - Template 1 (active, no remove button if only one template)
- **[2 ×]** - Template 2 with remove button
- **[3 ×]** - Template 3 with remove button

### 🎲 Random Selection Logic

1. **Per Reply**: One template is randomly selected from the list
2. **Per Image**: If the selected template has multiple image URLs, one is randomly selected

Example with 3 templates:
- Template 1: "Thanks!" + [img1.jpg, img2.jpg]
- Template 2: "Great post!" + [img3.jpg]
- Template 3: "Nice!" + []

For each tab, the system might select:
- Tab 1 → Template 2 → "Great post!" + img3.jpg
- Tab 2 → Template 1 → "Thanks!" + img2.jpg (random from 2 images)
- Tab 3 → Template 3 → "Nice!" (no image)

## 📖 Usage Examples

| Scenario | Steps |
|----------|-------|
| Reply to all comments | 1. Open Facebook comment tabs, 2. Open extension, 3. Enter message, 4. Click "Scan Tabs", 5. Click "Reply & Close" |
| Reply without closing | 1. Uncheck "Close tab", 2. Click "Scan Tabs", 3. Click "Reply" |
| Close tabs only | 1. Uncheck all reply steps, 2. Check "Close tab", 3. Click "Scan Tabs", 4. Click "Close Tabs" |
| Test click only | 1. Uncheck "Input text" and "Submit reply", 2. Keep "Click Reply button" checked, 3. Run to test reply button detection |
| Test input without submitting | 1. Uncheck "Submit reply", 2. Keep other steps checked, 3. Run to see text input without posting |
| Reply to specific tabs | 1. Click "Scan Tabs", 2. Uncheck tabs you want to skip, 3. Click start button |
| Select/deselect all | Use "Select All" or "Deselect All" buttons to quickly toggle all tabs |
| Stop mid-process | Click "Stop" button; current tab finishes, then stops |
| Retry failed tabs | Click "Scan Tabs" to refresh, then click start button |
| Adjust timing | Set min and max delay values (500-10000ms) for random delay between tabs |
| Close popup while running | The process continues in background; reopen popup to see progress |
| Multiple reply variations | 1. Click [+] to add templates, 2. Enter different messages in each tab, 3. Run - one is randomly selected per reply |
| Reply with images | 1. Check "Upload images", 2. Add image URLs, 3. Run - images are fetched and pasted into comment |
| Random images | 1. Add multiple image URLs to a template, 2. Run - one image is randomly selected per reply |

### 🔗 Valid URL Patterns

| URL Pattern | Detected | Target |
|-------------|----------|--------|
| `facebook.com/post?comment_id=123` | Yes | Main comment 123 |
| `facebook.com/post?comment_id=123&reply_comment_id=456` | Yes | Reply 456 within comment 123 |
| `facebook.com/groups/123/posts/456?comment_id=789` | Yes | Main comment 789 |
| `facebook.com/photo?reply_comment_id=123` | Yes | Reply 123 |
| `facebook.com/post` | No | (missing comment_id) |
| `m.facebook.com/comment?comment_id=123` | Yes | Main comment 123 |

**Important:** The extension strictly follows URL parameters:
- URL with only `comment_id` → Replies to that specific comment (ignores nested replies)
- URL with `reply_comment_id` → Replies to that specific nested reply

## 🌐 Multi-Language Support

The extension supports both English and Vietnamese button/label detection:

| Language | Reply Button | Submit Button |
|----------|--------------|---------------|
| English | Reply | Submit, Post, Send |
| Vietnamese | Phản hồi, Trả lời | Gửi, Đăng |

## 🚀 Future Enhancements

- [ ] Skip already-replied comments detection
- [x] Custom message templates with variables (implemented as template tabs)
- [ ] Batch import URLs from file
- [ ] Scheduled/delayed start
- [x] Per-tab custom messages (implemented via random template selection)
- [ ] Reply history/log export
- [ ] Support for Facebook Messenger
- [x] Image upload support (implemented with URL-based images)
