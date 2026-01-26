# HTML Counter

## Overview

HTML Counter is a tool that searches the current webpage for exact class matches and text matches. It supports multiple search queries simultaneously, with each search item displaying results inline.

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
         │                            │ - classList.contains()
         │                            │ - direct text match
         │  CSSSearchResult           │
         │◄───────────────────────────┤
         │                            │
         ▼                            │
┌─────────────────┐                   │
│ Display Results │                   │
│ (inline badges) │                   │
└─────────────────┘                   │
```

## Components

### Shared Types (`src/shared/types.ts`)

#### CSSSearchResult
| Field | Type | Description |
|-------|------|-------------|
| `query` | `string` | The search query entered by user |
| `classes` | `number` | Elements with exact class match |
| `textMatches` | `number` | Elements with exact text content match |

### Content Script (`src/content/index.ts`)

#### searchCSS(query: string)

Performs exact match search on the current page:

1. **Class Match**
   - Uses `classList.contains()` for exact matching
   - If query contains multiple classes (space-separated), checks if element has ALL classes
   - Single class: exact match only
   - Example: searching `btn primary` finds elements with both `btn` AND `primary` classes

2. **Text Match**
   - Searches direct text content only (not inherited from children)
   - Uses exact match comparison (`===`)
   - Trims whitespace before comparison

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
┌────────────────────────────────────────────────────────────┐
│ Tabs: [Logging] [HTML Counter] [Tab 3]                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  HTML Counter                          [Re-count All]      │
│                                                            │
│  ┌──────────────────────────┬─────────────────────┬───┐   │
│  │ search-term-1            │ 5 classes │ 2 text  │ X │   │
│  └──────────────────────────┴─────────────────────┴───┘   │
│  ┌──────────────────────────┬─────────────────────┬───┐   │
│  │ search-term-2            │ 0 classes │ 0 text  │ X │   │
│  └──────────────────────────┴─────────────────────┴───┘   │
│  ┌──────────────────────────┬─────────────────────┬───┐   │
│  │ search-term-3            │ 3 classes │ 1 text  │ X │   │
│  └──────────────────────────┴─────────────────────┴───┘   │
│                                                            │
│  [+ Add]                                                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Features

**Multiple Search Items:**
- Each search has its own input field and inline results
- Add new searches with the "+ Add" button
- Remove individual searches with the "X" button
- All searches persist to storage

**Search Input:**
- Single-line text input per search item
- Placeholder: "Enter class or text to search..."
- Triggers search on input (debounced 500ms)
- Triggers search on Enter key

**Inline Results:**
- Results displayed as badges next to input
- Shows `classes` count and `text` count
- Updates automatically on input change

**Re-count All Button:**
- Refreshes all search results
- Useful when page content changes

**Status Messages:**
- "No active tab found" - No active tab
- "Cannot search on browser internal pages" - chrome:// or about: pages

## Storage

Search items are persisted to `chrome.storage.local`:

```typescript
// Key: 'searchItems'
// Value: Array<{ id: string, query: string }>
chrome.storage.local.set({
  searchItems: searchItems.map(i => ({ id: i.id, query: i.query }))
});

// Restored on popup open
const { searchItems } = await chrome.storage.local.get('searchItems');
```

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

When the extension is reloaded, old content scripts become orphaned. Handled gracefully by checking context validity.

**User Action Required:** Refresh the webpage to load the new content script.

### Content Script Not Loaded

If the content script is not present, it will be injected programmatically before retrying the search.

## Usage Examples

| Search Query | What It Finds |
|--------------|---------------|
| `btn` | Elements with exact class `btn` |
| `btn primary` | Elements with BOTH `btn` AND `primary` classes |
| `Hello World` | Elements with exact text content "Hello World" |
| `css-abc123-Container` | Elements with exact class `css-abc123-Container` |

## Future Enhancements

- [ ] Highlight matching elements on page
- [ ] Partial/fuzzy matching option
- [ ] Export results
- [ ] Drag to reorder search items
- [ ] Search templates/presets
