// Background service worker
import { LogEntry, LogState, MessageType, MessageResponse } from '../shared/types';
import { createLogger } from '../shared/logger';

const logger = createLogger('background');

// In-memory log storage
const logState: LogState = {
  logs: [],
  maxLogs: 1000, // Keep last 1000 logs
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function addLog(entry: Omit<LogEntry, 'id'>): void {
  const logEntry: LogEntry = {
    ...entry,
    id: generateId(),
  };

  logState.logs.push(logEntry);

  // Trim if exceeds max
  if (logState.logs.length > logState.maxLogs) {
    logState.logs = logState.logs.slice(-logState.maxLogs);
  }

  // Broadcast to all extension pages (popup)
  chrome.runtime.sendMessage({ type: 'LOGS_UPDATED', payload: logState.logs }).catch(() => {
    // Ignore errors when popup is closed
  });
}

// Expose addLog globally for background logger
(globalThis as any).__addLog = addLog;

chrome.runtime.onInstalled.addListener(() => {
  logger.info('Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  logger.info('Extension started');
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  const url = sender.tab?.url;

  switch (message.type) {
    case 'LOG_ENTRY':
      // Add tab info for content script logs
      const logPayload = {
        ...message.payload,
        tabId: tabId ?? message.payload.tabId,
        url: url ?? message.payload.url,
      };
      addLog(logPayload);
      sendResponse({ success: true } as MessageResponse);
      break;

    case 'GET_LOGS':
      sendResponse({ success: true, data: logState.logs } as MessageResponse<LogEntry[]>);
      break;

    case 'CLEAR_LOGS':
      logState.logs = [];
      logger.info('Logs cleared');
      chrome.runtime.sendMessage({ type: 'LOGS_UPDATED', payload: [] }).catch(() => {});
      sendResponse({ success: true } as MessageResponse);
      break;

    case 'GET_DATA':
      logger.debug('GET_DATA request received', { tabId, url });
      sendResponse({ success: true, data: 'Hello from background!' } as MessageResponse);
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' } as MessageResponse);
  }

  return true; // Keep the message channel open for async response
});

// Log when tabs are updated (example of background activity)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    logger.debug('Tab loaded', { tabId, url: tab.url });
  }
});

export {};
