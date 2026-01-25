# CSS Counter

## Overview

CSS Counter is a tool that searches the current webpage for CSS-related elements including selectors, classes, IDs, inline styles, and stylesheet rules. It communicates with the content script to analyze the active tab's DOM and stylesheets.

## Architecture

```
┌─────────────────┐          ┌─────────────────┐
│     Popup       │          │  Content Script │
│   (Tab 2 UI)    │          │  (Page Context) │
└────────┬────────┘          └────────┬────────┘
         │                            │
         │  CSS_SEARCH                │
         │  { query: string }         │
         ├───────────────────────────►│
         │                            │ searchCSS()
         │                            │ - querySelector
         │                            │ - classList scan
         │                            │ - stylesheet rules
         │  CSSSearchResult           │
         │◄───────────────────────────┤
         │                            │
         ▼                            │
┌─────────────────┐                   │
│ Display Results │                   │
│ (count > 0 only)│                   │
└─────────────────┘                   │
```

## Components

### Shared Types (`src/shared/types.ts`)

#### CSSSearchResult
| Field | Type | Description |
|-------|------|-------------|
| `query` | `string` | The search query entered by user |
| `elements` | `number` | Elements matching as CSS selector |
| `classes` | `number` | Unique class names containing query |
| `ids` | `number` | Unique IDs containing query |
| `inlineStyles` | `number` | Elements with inline styles containing query |
| `stylesheetRules` | `number` | CSS rules containing query in text |
| `computedMatches` | `number` | Elements with computed style properties matching query |

### Content Script (`src/content/index.ts`)

#### searchCSS(query: string)

Performs comprehensive CSS search on the current page:

1. **Element Selector Match**
   - Attempts `document.querySelectorAll(query)`
   - Counts matching elements
   - Gracefully handles invalid selectors

2. **Class Name Search**
   - Scans all elements' `classList`
   - Case-insensitive substring match
   - Returns unique class count

3. **ID Search**
   - Scans all elements' `id` attribute
   - Case-insensitive substring match
   - Returns unique ID count

4. **Inline Style Search**
   - Checks `style` attribute of all elements
   - Case-insensitive substring match
   - Counts elements with matching inline styles

5. **Stylesheet Rules Search**
   - Iterates through `document.styleSheets`
   - Searches `cssText` of each rule
   - Skips cross-origin stylesheets (security restriction)

6. **Computed Style Search**
   - Samples common elements (body, div, span, p, a, h1-h3)
   - Searches property names in computed styles
   - Counts elements with matching properties

#### Message Handler

```typescript
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CSS_SEARCH') {
    const result = searchCSS(message.payload?.query || '');
    sendResponse({ success: true, data: result });
  }
  return true; // Keep channel open for async response
});
```

### Popup UI (`src/popup/popup.html`, `src/popup/index.ts`)

#### Layout

```
┌────────────────────────────────────────────────┐
│ Tabs: [Logging] [CSS Counter] [Tab 3]          │
├────────────────────────────────────────────────┤
│                                                │
│  CSS Counter                                   │
│  Search for CSS classes, IDs, selectors...    │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ Enter CSS selector or search term...     │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Results:                                      │
│  ┌────────────────┬────────────────┐          │
│  │ Elements: 5    │ Classes: 12    │          │
│  ├────────────────┼────────────────┤          │
│  │ IDs: 2         │ Inline: 3      │          │
│  ├────────────────┼────────────────┤          │
│  │ Rules: 8       │ Computed: 4    │          │
│  └────────────────┴────────────────┘          │
│                                                │
│  Status: Found results                         │
│                                                │
└────────────────────────────────────────────────┘
```

#### Features

**Input Field:**
- Single-line text input
- Placeholder: "Enter CSS selector or search term..."
- Triggers search on input (debounced 300ms)
- Persisted to `chrome.storage.local`

**Results Grid:**
- 2-column responsive grid
- Only shows results with count > 0
- Result types:
  - **Elements:** Direct selector matches
  - **Classes:** Matching class names
  - **IDs:** Matching element IDs
  - **Inline Styles:** Elements with matching inline styles
  - **Stylesheet Rules:** CSS rules containing query
  - **Computed Styles:** Elements with matching computed properties

**Status Messages:**
- "Enter a search term..." - Empty input
- "Searching..." - During search
- "Found results" - Results returned (any count > 0)
- "No matches found" - All counts are 0
- Error messages for failures

## Permissions

Required in `manifest.json`:

```json
{
  "permissions": [
    "activeTab",
    "tabs",
    "scripting"
  ]
}
```

- `activeTab`: Access to current tab
- `tabs`: Query tab information
- `scripting`: Programmatic script injection fallback

## Error Handling

### Extension Context Invalidated

When the extension is reloaded, old content scripts become orphaned. The logger handles this gracefully:

```typescript
// Check context validity before messaging
if (!chrome.runtime?.id) {
  return; // Silently skip
}

// Suppress lastError in callbacks
chrome.runtime.sendMessage(msg, () => {
  void chrome.runtime.lastError;
});
```

**User Action Required:** Refresh the webpage to load the new content script.

### Content Script Not Loaded

If the content script is not present (e.g., new tab opened after extension install):

```typescript
try {
  // Try normal message
  response = await chrome.tabs.sendMessage(tabId, message);
} catch {
  // Inject content script programmatically
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/index.js']
  });
  // Retry message
  response = await chrome.tabs.sendMessage(tabId, message);
}
```

### Cross-Origin Stylesheets

External stylesheets from different origins cannot be read due to browser security. These are silently skipped in the search.

## Storage

Search input is persisted to `chrome.storage.local`:

```typescript
// Key: 'cssSearchQuery'
chrome.storage.local.set({ cssSearchQuery: query });

// Restored on popup open
const { cssSearchQuery } = await chrome.storage.local.get('cssSearchQuery');
```

## Usage Examples

| Search Query | What It Finds |
|--------------|---------------|
| `.btn` | Elements matching `.btn` selector, classes containing "btn" |
| `#header` | Element with id="header", IDs containing "header" |
| `flex` | Classes/IDs with "flex", inline styles with "flex", CSS rules with "flex" |
| `color` | CSS properties containing "color" in stylesheets and computed styles |
| `div.container` | Elements matching compound selector |

## Future Enhancements

- [ ] Highlight matching elements on page
- [ ] Show matched class/ID names list
- [ ] Export results
- [ ] Search history
- [ ] RegEx support
- [ ] Specificity calculator
- [ ] CSS rule preview
