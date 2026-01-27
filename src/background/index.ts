// Background service worker
import {
  LogEntry,
  LogState,
  MessageType,
  MessageResponse,
  FBTab,
  FBAutoReplyState,
  FBAutoReplyConfig,
} from '../shared/types';
import { createLogger } from '../shared/logger';
import { generateId, getRandomDelay } from '../shared/utils';

const logger = createLogger('background');

// In-memory log storage
const logState: LogState = {
  logs: [],
  maxLogs: 1000,
};

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
(globalThis as unknown as { __addLog: typeof addLog }).__addLog = addLog;

// ============================================
// FB Auto Reply Service
// ============================================

const fbState: FBAutoReplyState = {
  running: false,
  tabs: [],
  completed: 0,
  total: 0,
};

let fbAbort = false;

function isFacebookCommentUrl(url: string): boolean {
  return url.includes('facebook.com') && url.includes('comment_id');
}

function broadcastState(): void {
  chrome.runtime.sendMessage({ type: 'FB_STATE_UPDATE', payload: fbState }).catch(() => {
    // Ignore errors when popup is closed
  });
}

async function scanFBTabs(): Promise<FBTab[]> {
  logger.info('FB Auto Reply: Scanning for Facebook tabs');

  const tabs = await chrome.tabs.query({});
  const fbTabsFound = tabs.filter(t => t.url && isFacebookCommentUrl(t.url));

  fbState.tabs = fbTabsFound.map(tab => ({
    id: tab.id!,
    index: tab.index,
    title: tab.title || 'Facebook',
    url: tab.url || '',
    status: 'pending' as const,
    selected: true,
  }));

  fbState.completed = 0;
  fbState.total = 0;

  logger.info('FB Auto Reply: Scan complete', {
    totalTabs: fbState.tabs.length,
  });

  broadcastState();
  return fbState.tabs;
}

async function startFBAutoReply(config: FBAutoReplyConfig): Promise<void> {
  const { templates, delayMin, delayMax, steps, doClose } = config;

  // Validate: at least one action must be selected
  const hasAnyStep = steps.clickReply || steps.inputText || steps.uploadImages || steps.submitReply;
  if (!hasAnyStep && !doClose) {
    logger.error('FB Auto Reply: No action selected');
    return;
  }

  // Validate templates if needed
  if ((steps.inputText || steps.uploadImages) && (!templates || templates.length === 0)) {
    logger.error('FB Auto Reply: No templates provided');
    return;
  }

  fbState.running = true;
  fbAbort = false;

  const selectedPendingTabs = fbState.tabs.filter(t => t.status === 'pending' && t.selected);
  fbState.completed = 0;
  fbState.total = selectedPendingTabs.length;

  const actionDesc = hasAnyStep && doClose ? 'Reply & Close' : hasAnyStep ? 'Reply' : 'Close Tabs';

  logger.info(`FB Auto Reply: Starting ${actionDesc}`, {
    steps,
    doClose,
    templateCount: templates.length,
    delayRange: `${delayMin}-${delayMax}ms`,
    totalTabs: fbState.total,
  });

  broadcastState();

  for (const tab of selectedPendingTabs) {
    if (fbAbort) {
      logger.warn('FB Auto Reply: Stopped by user', {
        completed: fbState.completed,
        total: fbState.total,
      });
      break;
    }

    const tabIndex = selectedPendingTabs.indexOf(tab) + 1;
    logger.info(`FB Auto Reply: Processing tab ${tabIndex}/${fbState.total}`, {
      steps,
      doClose,
      tabId: tab.id,
      title: tab.title,
      url: tab.url,
    });

    // Update status to processing
    tab.status = 'processing';
    fbState.currentTabId = tab.id;
    broadcastState();

    try {
      let actionSuccess = true;
      const needsTabSwitch = hasAnyStep;

      // Switch to tab and inject script if needed for reply
      if (needsTabSwitch) {
        logger.debug('FB Auto Reply: Switching to tab', { tabId: tab.id });
        await chrome.tabs.update(tab.id, { active: true });
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Inject content script with retry
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content/index.js'],
            });
            logger.debug('FB Auto Reply: Content script injected', { tabId: tab.id, attempt });
            break;
          } catch (injectError) {
            const errMsg = injectError instanceof Error ? injectError.message : String(injectError);
            if (errMsg.includes('Cannot access') || errMsg.includes('not be scripted')) {
              logger.error('FB Auto Reply: Cannot inject script (restricted page)', {
                tabId: tab.id,
              });
              throw new Error('Cannot inject script on this page');
            }
            logger.debug('FB Auto Reply: Script injection attempt failed', {
              tabId: tab.id,
              attempt,
              error: errMsg,
            });
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        // Wait for script to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Reply action (if any step is selected)
      if (hasAnyStep && actionSuccess) {
        // Randomly select a template for this reply
        const randomTemplateIndex = Math.floor(Math.random() * templates.length);
        const selectedTemplate = templates[randomTemplateIndex];

        // If there are multiple image URLs in the template, randomly select one
        const templateToSend = { ...selectedTemplate };
        if (templateToSend.imageUrls.length > 1) {
          const randomImageIndex = Math.floor(Math.random() * templateToSend.imageUrls.length);
          templateToSend.imageUrls = [templateToSend.imageUrls[randomImageIndex]];
        }

        logger.info('FB Auto Reply: Selected template', {
          templateIndex: randomTemplateIndex,
          totalTemplates: templates.length,
          message: templateToSend.message.substring(0, 50),
          imageUrls: templateToSend.imageUrls,
        });

        let response = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            logger.debug('FB Auto Reply: Sending reply message', {
              tabId: tab.id,
              steps,
              template: templateToSend,
              attempt,
            });
            response = await chrome.tabs.sendMessage(tab.id, {
              type: 'FB_AUTO_REPLY',
              payload: { template: templateToSend, steps },
            });
            break;
          } catch (sendError) {
            const errMsg = sendError instanceof Error ? sendError.message : String(sendError);
            logger.warn('FB Auto Reply: Message send failed', {
              tabId: tab.id,
              attempt,
              error: errMsg,
            });
            if (attempt < 3) {
              try {
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ['content/index.js'],
                });
              } catch {
                // Ignore injection errors on retry
              }
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              throw sendError;
            }
          }
        }

        if (response?.success) {
          logger.info(`FB Auto Reply: Tab ${tabIndex} reply successful`, { tabId: tab.id });
        } else {
          actionSuccess = false;
          tab.status = 'error';
          tab.error = response?.error || 'Unknown error';
          logger.error(`FB Auto Reply: Tab ${tabIndex} reply failed`, {
            tabId: tab.id,
            error: tab.error,
          });
        }
      }

      // Close action (only if previous actions succeeded or not selected)
      if (doClose && actionSuccess) {
        if (hasAnyStep) {
          // Wait a bit after actions before closing
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        logger.debug('FB Auto Reply: Closing tab', { tabId: tab.id });
        await chrome.tabs.remove(tab.id);
        logger.info(`FB Auto Reply: Tab ${tabIndex} closed`, { tabId: tab.id });
      }

      // Mark as done if all actions succeeded
      if (actionSuccess) {
        tab.status = 'done';
        fbState.completed++;
        logger.info(`FB Auto Reply: Tab ${tabIndex} completed successfully`, { tabId: tab.id });
      }
    } catch (error) {
      tab.status = 'error';
      tab.error = error instanceof Error ? error.message : String(error);
      logger.error(`FB Auto Reply: Tab ${tabIndex} exception`, {
        tabId: tab.id,
        error: tab.error,
      });
    }

    broadcastState();

    // Wait before next tab with random delay
    if (!fbAbort && selectedPendingTabs.indexOf(tab) < selectedPendingTabs.length - 1) {
      const randomDelay = getRandomDelay(delayMin, delayMax);
      logger.debug('FB Auto Reply: Waiting before next tab', { randomDelay, delayMin, delayMax });
      await new Promise(resolve => setTimeout(resolve, randomDelay));
    }
  }

  fbState.running = false;
  fbState.currentTabId = undefined;
  broadcastState();

  if (!fbAbort) {
    logger.info(`FB Auto Reply: ${actionDesc} completed`, {
      completed: fbState.completed,
      total: fbState.total,
    });
  }
}

function stopFBAutoReply(): void {
  logger.warn('FB Auto Reply: Stop requested by user');
  fbAbort = true;
}

function selectTab(tabId: number, selected: boolean): void {
  const tab = fbState.tabs.find(t => t.id === tabId);
  if (tab && tab.status === 'pending') {
    tab.selected = selected;
    broadcastState();
  }
}

function selectAllTabs(selected: boolean): void {
  fbState.tabs.forEach(tab => {
    if (tab.status === 'pending') {
      tab.selected = selected;
    }
  });
  broadcastState();
}

// ============================================
// Extension lifecycle
// ============================================

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
    case 'LOG_ENTRY': {
      // Add tab info for content script logs
      const logPayload = {
        ...message.payload,
        tabId: tabId ?? message.payload.tabId,
        url: url ?? message.payload.url,
      };
      addLog(logPayload);
      sendResponse({ success: true } as MessageResponse);
      break;
    }

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

    // FB Auto Reply commands
    case 'FB_SCAN_TABS':
      scanFBTabs().then(tabs => {
        sendResponse({ success: true, data: tabs } as MessageResponse<FBTab[]>);
      });
      return true; // Keep channel open for async

    case 'FB_START_AUTO_REPLY':
      if (fbState.running) {
        sendResponse({ success: false, error: 'Already running' } as MessageResponse);
      } else {
        startFBAutoReply(message.payload);
        sendResponse({ success: true } as MessageResponse);
      }
      break;

    case 'FB_STOP_AUTO_REPLY':
      stopFBAutoReply();
      sendResponse({ success: true } as MessageResponse);
      break;

    case 'FB_GET_STATE':
      sendResponse({ success: true, data: fbState } as MessageResponse<FBAutoReplyState>);
      break;

    case 'FB_SELECT_TAB':
      selectTab(message.payload.tabId, message.payload.selected);
      sendResponse({ success: true } as MessageResponse);
      break;

    case 'FB_SELECT_ALL_TABS':
      selectAllTabs(message.payload.selected);
      sendResponse({ success: true } as MessageResponse);
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
