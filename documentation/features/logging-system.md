# Logging System

## Overview

Centralized logging system that captures, stores, and displays logs from all extension components (background service worker, content scripts, and popup) in a unified dashboard.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Popup     │     │   Content   │     │  Background │
│   Script    │     │   Script    │     │   (Store)   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  LOG_ENTRY        │  LOG_ENTRY        │
       └───────────────────┴───────────────────┤
                                               ▼
                                    ┌──────────────────┐
                                    │   Log Storage    │
                                    │  (In-Memory)     │
                                    │   Max: 1000      │
                                    └────────┬─────────┘
                                             │
                                             │ LOGS_UPDATED
                                             ▼
                                    ┌──────────────────┐
                                    │  Popup Dashboard │
                                    │   (Real-time)    │
                                    └──────────────────┘
```

## Components

### Shared Types (`src/shared/types.ts`)

#### LogEntry
| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (timestamp + random) |
| `timestamp` | `number` | Unix timestamp in milliseconds |
| `source` | `LogSource` | Origin: `background` \| `content` \| `popup` |
| `level` | `LogLevel` | Severity: `debug` \| `info` \| `warn` \| `error` |
| `message` | `string` | Log message text |
| `data` | `unknown` | Optional structured data (JSON serializable) |
| `tabId` | `number` | Browser tab ID (content scripts only) |
| `url` | `string` | Page URL (content scripts only) |

#### Message Types
| Type | Direction | Description |
|------|-----------|-------------|
| `LOG_ENTRY` | → Background | Submit a new log entry |
| `GET_LOGS` | → Background | Request all stored logs |
| `CLEAR_LOGS` | → Background | Delete all logs |
| `LOGS_UPDATED` | ← Background | Broadcast log updates to popup |

### Logger Utility (`src/shared/logger.ts`)

#### Usage
```typescript
import { createLogger } from '../shared/logger';

const logger = createLogger('content'); // 'background' | 'content' | 'popup'

logger.debug('Debug message', { optional: 'data' });
logger.info('User action completed');
logger.warn('Deprecated API used', { api: 'oldMethod' });
logger.error('Failed to fetch', { status: 500, url: '/api' });
```

#### Methods
| Method | Level | Console Output |
|--------|-------|----------------|
| `debug(message, data?)` | debug | `console.log` |
| `info(message, data?)` | info | `console.log` |
| `warn(message, data?)` | warn | `console.warn` |
| `error(message, data?)` | error | `console.error` |

#### Helper Functions
```typescript
import { getLogs, clearLogs } from '../shared/logger';

const logs = await getLogs();    // Fetch all logs from background
await clearLogs();               // Clear all logs
```

### Background Service Worker (`src/background/index.ts`)

**Responsibilities:**
- Store logs in memory (max 1000 entries, FIFO)
- Handle `LOG_ENTRY`, `GET_LOGS`, `CLEAR_LOGS` messages
- Broadcast `LOGS_UPDATED` to popup on changes
- Auto-log extension lifecycle events

**Storage:**
```typescript
const logState: LogState = {
  logs: LogEntry[],
  maxLogs: 1000
};
```

### Content Script (`src/content/index.ts`)

**Auto-logged Events:**
- Script initialization (with URL and title)
- Page visibility changes
- Uncaught errors (`window.onerror`)
- Unhandled promise rejections

### Popup Dashboard (`src/popup/popup.html`, `src/popup/index.ts`)

**Size:**
- **Popup mode:** 780 x 580 pixels (Chrome's max popup limit)
- **Window mode:** Responsive, fills entire window (1280 x 800 default)

**Layout:**
```
┌────────────────────────────────────────────────┐
│ Header: Browser Extension              [↗]     │
├────────────────────────────────────────────────┤
│ Tabs: [Logging] [CSS Counter] [Tab 3]         │
├────────────────────────────────────────────────┤
│ Toolbar:                                       │
│ [All][Debug][Info][Warn][Error]               │
│ [All Sources][Background][Content][Popup]      │
│ [Search...] [✓ Auto-scroll]                   │
│ [Columns ▼] [Refresh][Clear]                  │
├────────────────────────────────────────────────┤
│ Stats: Debug: 0 | Info: 0 | Warn: 0 | Error: 0│
├────────────────────────────────────────────────┤
│ Log Table (sortable headers)                   │
│ ┌──────┬────────┬───────┬─────────┬────┬─────┐│
│ │Time▼ │ Source │ Level │ Message │Data│ URL ││
│ ├──────┼────────┼───────┼─────────┼────┼─────┤│
│ │ ...  │ ...    │ ...   │ ...     │... │ ... ││
│ └──────┴────────┴───────┴─────────┴────┴─────┘│
└────────────────────────────────────────────────┘
```

**Open in Window:**
The ↗ button in the header opens the dashboard in a separate browser window (1280 x 800) for a larger workspace. Content automatically fills the window size.

## Features

### Filtering
- **By Level:** All, Debug, Info, Warn, Error
- **By Source:** All Sources, Background, Content, Popup
- **Search:** Filter by message, data, or URL (debounced 200ms)

### Real-time Updates
- Logs appear instantly via `chrome.runtime.onMessage`
- Auto-scroll option keeps latest logs visible

### UI Elements
| Element | Description |
|---------|-------------|
| Time | Format: `MM/DD HH:mm:ss.ms` |
| Source badge | Color-coded: blue (background), purple (content), teal (popup) |
| Level badge | Color-coded: gray (debug), teal (info), yellow (warn), red (error) |
| Data cell | Truncated JSON, expands on hover |
| URL cell | Truncated, full path on hover |

### Column Customization

**Visibility (Hide/Show):**
- Click "Columns" button in toolbar to open dropdown
- Toggle checkboxes to show/hide individual columns
- Available columns: Time, Source, Level, Message, Data, URL
- Settings persist to `chrome.storage.local`

**Sorting:**
- Click any sortable column header to sort
- First click: descending order (▼)
- Second click: ascending order (▲)
- Third click: clear sorting
- Sortable columns: Time, Source, Level, Message, URL
- Sort indicator shows current state (▲▼)

**Reset:**
- Click "Reset All Settings" in Columns dropdown
- Restores all columns to visible
- Clears any active sorting

### Actions
| Button | Action |
|--------|--------|
| ↗ Open in Window | Open dashboard in separate window (1280x800) |
| Columns | Toggle column visibility dropdown |
| Reset All Settings | Clear visibility and sorting settings |
| Refresh | Reload logs from background |
| Clear Logs | Delete all logs (with confirmation) |

## Configuration

### Log Retention
Default: 1000 entries (configurable in `background/index.ts`)

```typescript
const logState: LogState = {
  logs: [],
  maxLogs: 1000  // Adjust as needed
};
```

## Future Enhancements

- [ ] Persist logs to `chrome.storage.local`
- [ ] Export logs as JSON/CSV
- [ ] Log level filtering at source (reduce noise)
- [ ] Timestamp range filtering
- [ ] Collapsible data viewer with syntax highlighting
- [ ] Log entry detail modal
- [ ] Performance metrics integration
