// Background service worker
import {
  LogEntry,
  LogState,
  MessageType,
  MessageResponse,
  FBTab,
  FBAutoReplyState,
  FBAutoReplyConfig,
  FBNotificationListenerState,
  FBNotificationListenerConfig,
  FBNotificationScanResult,
  BookmarkFolder,
  FBTemplateSelectionMode,
  FBReplyTemplate,
  IDMListenerConfig,
  IDMListenerState,
  IDMVideoLink,
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
  mode: 'tabs',
  skippedBookmarks: 0,
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

// Template selector for different selection modes
class TemplateSelector {
  private templates: FBReplyTemplate[];
  private mode: FBTemplateSelectionMode;
  private sequentialIndex: number = 0;
  private shuffledOrder: number[] = [];
  private shuffledIndex: number = 0;

  constructor(templates: FBReplyTemplate[], mode: FBTemplateSelectionMode) {
    this.templates = templates;
    this.mode = mode;
    if (mode === 'shuffled') {
      this.reshuffleOrder();
    }
  }

  private reshuffleOrder(): void {
    // Create array of indices and shuffle using Fisher-Yates
    this.shuffledOrder = this.templates.map((_, i) => i);
    for (let i = this.shuffledOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledOrder[i], this.shuffledOrder[j]] = [
        this.shuffledOrder[j],
        this.shuffledOrder[i],
      ];
    }
    this.shuffledIndex = 0;
    logger.debug('FB Auto Reply: Shuffled template order', { order: this.shuffledOrder });
  }

  getNext(): { template: FBReplyTemplate; index: number } {
    let index: number;

    switch (this.mode) {
      case 'random':
        index = Math.floor(Math.random() * this.templates.length);
        break;

      case 'sequential':
        index = this.sequentialIndex;
        this.sequentialIndex = (this.sequentialIndex + 1) % this.templates.length;
        break;

      case 'shuffled':
        index = this.shuffledOrder[this.shuffledIndex];
        this.shuffledIndex++;
        // Reset and reshuffle when all templates have been used
        if (this.shuffledIndex >= this.shuffledOrder.length) {
          this.reshuffleOrder();
        }
        break;

      default:
        index = 0;
    }

    return { template: this.templates[index], index };
  }
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
  const { templates, delayMin, delayMax, steps, doClose, mode, templateMode } = config;

  // Handle bookmark mode separately
  if (mode === 'bookmarks') {
    return startFBBookmarkMode(config);
  }

  fbState.mode = 'tabs';
  fbState.skippedBookmarks = 0;

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

  // Create template selector based on mode
  const templateSelector = new TemplateSelector(templates, templateMode || 'random');

  const actionDesc = hasAnyStep && doClose ? 'Reply & Close' : hasAnyStep ? 'Reply' : 'Close Tabs';

  logger.info(`FB Auto Reply: Starting ${actionDesc}`, {
    steps,
    doClose,
    templateCount: templates.length,
    templateMode: templateMode || 'random',
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
        // Select template based on mode
        const { template: selectedTemplate, index: templateIndex } = templateSelector.getNext();

        // If there are multiple image URLs in the template, randomly select one
        const templateToSend = { ...selectedTemplate };
        if (templateToSend.imageUrls.length > 1) {
          const randomImageIndex = Math.floor(Math.random() * templateToSend.imageUrls.length);
          templateToSend.imageUrls = [templateToSend.imageUrls[randomImageIndex]];
        }

        logger.info('FB Auto Reply: Selected template', {
          templateIndex,
          totalTemplates: templates.length,
          templateMode: templateMode || 'random',
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
// Bookmark Functions
// ============================================

async function getBookmarkFolders(): Promise<BookmarkFolder[]> {
  const folders: BookmarkFolder[] = [];

  async function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[], path: string): Promise<void> {
    for (const node of nodes) {
      if (node.children) {
        // This is a folder
        const folderPath = path ? `${path} / ${node.title}` : node.title;
        if (node.id !== '0') {
          // Skip root node
          folders.push({
            id: node.id,
            title: node.title,
            path: folderPath,
          });
        }
        await traverse(node.children, folderPath);
      }
    }
  }

  const tree = await chrome.bookmarks.getTree();
  await traverse(tree, '');

  return folders;
}

async function getBookmarksInFolder(
  folderId: string
): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  const children = await chrome.bookmarks.getChildren(folderId);
  // Only return bookmarks (not subfolders)
  return children.filter(child => child.url);
}

async function startFBBookmarkMode(config: FBAutoReplyConfig): Promise<void> {
  const { templates, delayMin, delayMax, steps, doClose, bookmarkFolderId, templateMode } = config;

  if (!bookmarkFolderId) {
    logger.error('FB Auto Reply: No bookmark folder selected');
    return;
  }

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

  // Get bookmarks from selected folder
  const bookmarks = await getBookmarksInFolder(bookmarkFolderId);

  if (bookmarks.length === 0) {
    logger.warn('FB Auto Reply: No bookmarks found in selected folder');
    broadcastState();
    return;
  }

  fbState.running = true;
  fbState.mode = 'bookmarks';
  fbAbort = false;
  fbState.completed = 0;
  fbState.total = bookmarks.length;
  fbState.skippedBookmarks = 0;
  fbState.tabs = [];

  // Create template selector based on mode
  const templateSelector = new TemplateSelector(templates, templateMode || 'random');

  const actionDesc = hasAnyStep && doClose ? 'Reply & Close' : hasAnyStep ? 'Reply' : 'Close Tabs';

  logger.info(`FB Auto Reply (Bookmark Mode): Starting ${actionDesc}`, {
    steps,
    doClose,
    templateCount: templates.length,
    templateMode: templateMode || 'random',
    delayRange: `${delayMin}-${delayMax}ms`,
    totalBookmarks: bookmarks.length,
    folderId: bookmarkFolderId,
  });

  broadcastState();

  for (let i = 0; i < bookmarks.length; i++) {
    if (fbAbort) {
      logger.warn('FB Auto Reply: Stopped by user', {
        completed: fbState.completed,
        skipped: fbState.skippedBookmarks,
        total: fbState.total,
      });
      break;
    }

    const bookmark = bookmarks[i];
    const bookmarkIndex = i + 1;

    // Check if valid Facebook comment URL
    if (!bookmark.url || !isFacebookCommentUrl(bookmark.url)) {
      logger.debug(`FB Auto Reply: Skipping non-Facebook URL`, {
        index: bookmarkIndex,
        url: bookmark.url,
        title: bookmark.title,
      });
      fbState.skippedBookmarks++;
      broadcastState();
      continue;
    }

    logger.info(`FB Auto Reply: Processing bookmark ${bookmarkIndex}/${fbState.total}`, {
      steps,
      doClose,
      title: bookmark.title,
      url: bookmark.url,
    });

    let openedTab: chrome.tabs.Tab | null = null;

    try {
      // Open the bookmark in a new tab
      openedTab = await chrome.tabs.create({ url: bookmark.url, active: true });

      if (!openedTab?.id) {
        throw new Error('Failed to open bookmark tab');
      }

      fbState.currentTabId = openedTab.id;

      // Add to tabs list for UI display
      const fbTab: FBTab = {
        id: openedTab.id,
        index: openedTab.index,
        title: bookmark.title || 'Facebook',
        url: bookmark.url,
        status: 'processing',
        selected: true,
      };
      fbState.tabs.push(fbTab);
      broadcastState();

      // Wait for tab to load
      await waitForTabLoad(openedTab.id);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Inject content script with retry
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: openedTab.id },
            files: ['content/index.js'],
          });
          logger.debug('FB Auto Reply: Content script injected', { tabId: openedTab.id, attempt });
          break;
        } catch (injectError) {
          const errMsg = injectError instanceof Error ? injectError.message : String(injectError);
          if (errMsg.includes('Cannot access') || errMsg.includes('not be scripted')) {
            logger.error('FB Auto Reply: Cannot inject script (restricted page)', {
              tabId: openedTab.id,
            });
            throw new Error('Cannot inject script on this page');
          }
          logger.debug('FB Auto Reply: Script injection attempt failed', {
            tabId: openedTab.id,
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

      let actionSuccess = true;

      // Reply action (if any step is selected)
      if (hasAnyStep && actionSuccess) {
        // Select template based on mode
        const { template: selectedTemplate, index: templateIndex } = templateSelector.getNext();

        // If there are multiple image URLs, randomly select one
        const templateToSend = { ...selectedTemplate };
        if (templateToSend.imageUrls.length > 1) {
          const randomImageIndex = Math.floor(Math.random() * templateToSend.imageUrls.length);
          templateToSend.imageUrls = [templateToSend.imageUrls[randomImageIndex]];
        }

        logger.info('FB Auto Reply: Selected template', {
          templateIndex,
          totalTemplates: templates.length,
          templateMode: templateMode || 'random',
          message: templateToSend.message.substring(0, 50),
          imageUrls: templateToSend.imageUrls,
        });

        let response = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            logger.debug('FB Auto Reply: Sending reply message', {
              tabId: openedTab.id,
              steps,
              template: templateToSend,
              attempt,
            });
            response = await chrome.tabs.sendMessage(openedTab.id, {
              type: 'FB_AUTO_REPLY',
              payload: { template: templateToSend, steps },
            });
            break;
          } catch (sendError) {
            const errMsg = sendError instanceof Error ? sendError.message : String(sendError);
            logger.warn('FB Auto Reply: Message send failed', {
              tabId: openedTab.id,
              attempt,
              error: errMsg,
            });
            if (attempt < 3) {
              try {
                await chrome.scripting.executeScript({
                  target: { tabId: openedTab.id },
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
          logger.info(`FB Auto Reply: Bookmark ${bookmarkIndex} reply successful`, {
            tabId: openedTab.id,
          });
        } else {
          actionSuccess = false;
          fbTab.status = 'error';
          fbTab.error = response?.error || 'Unknown error';
          logger.error(`FB Auto Reply: Bookmark ${bookmarkIndex} reply failed`, {
            tabId: openedTab.id,
            error: fbTab.error,
          });
        }
      }

      // Close action
      if (doClose && actionSuccess && openedTab?.id) {
        if (hasAnyStep) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        logger.debug('FB Auto Reply: Closing tab', { tabId: openedTab.id });
        try {
          await chrome.tabs.remove(openedTab.id);
        } catch {
          // Tab might already be closed
        }
        logger.info(`FB Auto Reply: Bookmark ${bookmarkIndex} tab closed`, { tabId: openedTab.id });
      }

      // Mark as done if successful
      if (actionSuccess) {
        fbTab.status = 'done';
        fbState.completed++;
        logger.info(`FB Auto Reply: Bookmark ${bookmarkIndex} completed successfully`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`FB Auto Reply: Bookmark ${bookmarkIndex} exception`, {
        title: bookmark.title,
        url: bookmark.url,
        error: errMsg,
      });

      // Update tab status if it exists
      const fbTab = fbState.tabs.find(t => t.id === openedTab?.id);
      if (fbTab) {
        fbTab.status = 'error';
        fbTab.error = errMsg;
      }

      // Try to close the tab on error if configured
      if (doClose && openedTab?.id) {
        try {
          await chrome.tabs.remove(openedTab.id);
        } catch {
          // Tab might already be closed
        }
      }
    }

    broadcastState();

    // Wait before next bookmark with random delay
    if (!fbAbort && i < bookmarks.length - 1) {
      const randomDelay = getRandomDelay(delayMin, delayMax);
      logger.debug('FB Auto Reply: Waiting before next bookmark', {
        randomDelay,
        delayMin,
        delayMax,
      });
      await new Promise(resolve => setTimeout(resolve, randomDelay));
    }
  }

  fbState.running = false;
  fbState.currentTabId = undefined;
  broadcastState();

  if (!fbAbort) {
    logger.info(`FB Auto Reply (Bookmark Mode): Completed`, {
      completed: fbState.completed,
      skipped: fbState.skippedBookmarks,
      total: fbState.total,
    });
  }
}

// ============================================
// FB Notification Listener Service
// ============================================

const NOTIF_ALARM_NAME = 'fb-notification-check';

const notifState: FBNotificationListenerState = {
  running: false,
  lastCheck: null,
  nextCheck: null,
  notificationsFound: 0,
  tabsOpened: 0,
};

let notifConfig: FBNotificationListenerConfig = {
  enabled: false,
  intervalSeconds: 30,
  filters: {
    mentionsName: true,
    replyNotifications: true,
    allCommentNotifications: false,
  },
  autoStartReply: false,
  expandPreviousNotifications: false,
  markAllAsRead: false,
};

function broadcastNotifState(): void {
  chrome.runtime.sendMessage({ type: 'FB_NOTIF_STATE_UPDATE', payload: notifState }).catch(() => {
    // Ignore errors when popup is closed
  });
}

async function loadNotifConfig(): Promise<void> {
  const stored = await chrome.storage.local.get(['fbNotifConfig']);
  if (stored.fbNotifConfig) {
    notifConfig = stored.fbNotifConfig;
  }
}

async function saveNotifConfig(config: FBNotificationListenerConfig): Promise<void> {
  notifConfig = config;
  await chrome.storage.local.set({ fbNotifConfig: config });
}

async function startNotificationListener(config: FBNotificationListenerConfig): Promise<void> {
  logger.info('FB Notification Listener: Starting', {
    intervalSeconds: config.intervalSeconds,
    filters: config.filters,
  });

  notifConfig = config;
  await saveNotifConfig(config);

  // Create alarm for periodic checks
  await chrome.alarms.create(NOTIF_ALARM_NAME, {
    delayInMinutes: config.intervalSeconds / 60,
    periodInMinutes: config.intervalSeconds / 60,
  });

  notifState.running = true;
  notifState.error = undefined;
  notifState.nextCheck = Date.now() + config.intervalSeconds * 1000;

  broadcastNotifState();

  // Run first check immediately
  await runNotificationCheck();
}

async function stopNotificationListener(): Promise<void> {
  logger.info('FB Notification Listener: Stopping');

  await chrome.alarms.clear(NOTIF_ALARM_NAME);

  notifState.running = false;
  notifState.nextCheck = null;

  broadcastNotifState();
}

async function runNotificationCheck(): Promise<void> {
  logger.info('FB Notification Listener: Running check');

  try {
    // Find or open the Facebook notifications page
    const notifUrl = 'https://www.facebook.com/notifications';
    let notifTab: chrome.tabs.Tab | null = null;

    // Look for existing notifications tab
    const existingTabs = await chrome.tabs.query({ url: '*://www.facebook.com/notifications*' });
    if (existingTabs.length > 0) {
      notifTab = existingTabs[0];
      // Refresh the tab to get latest notifications
      await chrome.tabs.reload(notifTab.id!);
    } else {
      // Open new tab
      notifTab = await chrome.tabs.create({ url: notifUrl, active: false });
    }

    if (!notifTab?.id) {
      throw new Error('Could not open notifications tab');
    }

    // Wait for tab to load
    await waitForTabLoad(notifTab.id);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Inject content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: notifTab.id },
        files: ['content/index.js'],
      });
    } catch {
      // Script might already be injected
    }
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send scan request to content script
    const scanResult = (await chrome.tabs.sendMessage(notifTab.id, {
      type: 'FB_NOTIF_SCAN_PAGE',
      payload: {
        filters: notifConfig.filters,
        expandPrevious: notifConfig.expandPreviousNotifications,
        markAllAsRead: notifConfig.markAllAsRead,
      },
    })) as FBNotificationScanResult;

    if (!scanResult?.success) {
      throw new Error(scanResult?.error || 'Scan failed');
    }

    const notifications = scanResult.notifications || [];
    notifState.notificationsFound += notifications.length;
    notifState.lastCheck = Date.now();

    logger.info('FB Notification Listener: Scan complete', {
      found: notifications.length,
    });

    // Open matching notifications in new tabs
    let tabsOpened = 0;
    for (const notif of notifications) {
      if (notif.url) {
        await chrome.tabs.create({ url: notif.url, active: false });
        tabsOpened++;
        // Small delay between opening tabs
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    notifState.tabsOpened += tabsOpened;

    // Update next check time
    if (notifState.running) {
      notifState.nextCheck = Date.now() + notifConfig.intervalSeconds * 1000;
    }

    // Optionally trigger auto-reply
    if (notifConfig.autoStartReply && tabsOpened > 0 && !fbState.running) {
      logger.info('FB Notification Listener: Triggering auto-reply scan');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await scanFBTabs();
    }

    broadcastNotifState();
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('FB Notification Listener: Check failed', { error: errMsg });
    notifState.error = errMsg;
    notifState.lastCheck = Date.now();
    broadcastNotifState();
  }
}

async function waitForTabLoad(tabId: number, timeout = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkStatus = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          resolve();
          return;
        }
        if (Date.now() - startTime > timeout) {
          reject(new Error('Tab load timeout'));
          return;
        }
        setTimeout(checkStatus, 500);
      } catch {
        reject(new Error('Tab no longer exists'));
      }
    };

    checkStatus();
  });
}

// ============================================
// IDM Video Listener Service
// ============================================

const idmState: IDMListenerState = {
  running: false,
  videosFound: [],
  totalFound: 0,
  totalDownloaded: 0,
};

let idmConfig: IDMListenerConfig = {
  enabled: false,
  downloadPath: 'C:\\Downloads\\Videos',
  autoDownload: false,
  videoExtensions: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'm3u8', 'ts'],
};

function broadcastIdmState(): void {
  chrome.runtime.sendMessage({ type: 'IDM_STATE_UPDATE', payload: idmState }).catch(() => {
    // Ignore errors when popup is closed
  });
}

async function loadIdmConfig(): Promise<void> {
  const stored = await chrome.storage.local.get(['idmConfig']);
  if (stored.idmConfig) {
    idmConfig = stored.idmConfig;
  }
}

async function saveIdmConfig(config: IDMListenerConfig): Promise<void> {
  idmConfig = config;
  await chrome.storage.local.set({ idmConfig: config });
}

function addVideoLink(video: IDMVideoLink): void {
  // Check if already exists
  const exists = idmState.videosFound.some(v => v.url === video.url);
  if (!exists) {
    idmState.videosFound.push(video);
    idmState.totalFound++;
    logger.info('IDM Listener: Video found', { url: video.url, title: video.title });
    broadcastIdmState();

    // Auto download if enabled
    if (idmConfig.autoDownload) {
      downloadWithIdm(video.url, idmConfig.downloadPath);
    }
  }
}

function getExtensionFromUrl(url: string): string {
  const lowerUrl = url.toLowerCase();
  const extensions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'm3u8', 'ts', 'mpd', 'm4v', '3gp'];
  for (const ext of extensions) {
    if (lowerUrl.includes(`.${ext}`)) {
      return ext;
    }
  }
  return 'mp4';
}

function downloadWithIdm(url: string, downloadPath: string): void {
  logger.info('IDM Listener: Starting download', { url, downloadPath });

  // Extract filename from URL
  let filename = 'video';
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.includes('.')) {
      filename = decodeURIComponent(lastPart.split('?')[0]);
    } else {
      // Generate filename from timestamp
      const ext = getExtensionFromUrl(url);
      filename = `video_${Date.now()}.${ext}`;
    }
  } catch {
    filename = `video_${Date.now()}.mp4`;
  }

  // Use Chrome's download API
  chrome.downloads
    .download({
      url: url,
      filename: filename,
      saveAs: false, // Set to true if you want "Save As" dialog
    })
    .then(downloadId => {
      if (downloadId) {
        logger.info('IDM Listener: Download started', { downloadId, filename, url });

        // Mark as downloaded
        const video = idmState.videosFound.find(v => v.url === url);
        if (video) {
          video.downloaded = true;
          idmState.totalDownloaded++;
          broadcastIdmState();
        }
      } else {
        logger.error('IDM Listener: Download failed - no download ID returned');
      }
    })
    .catch(err => {
      logger.error('IDM Listener: Download failed', { error: String(err), url });
    });
}

async function startIdmListener(config: IDMListenerConfig): Promise<void> {
  logger.info('IDM Listener: Starting', { config });

  idmConfig = config;
  await saveIdmConfig(config);

  idmState.running = true;
  broadcastIdmState();

  // Inject content script into all existing tabs and start observer
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/index.js'],
        });
        // Tell content script to start observing
        await chrome.tabs.sendMessage(tab.id, { type: 'IDM_START_OBSERVER' }).catch(() => {});
      } catch {
        // Ignore errors for restricted tabs
      }
    }
  }
}

async function stopIdmListener(): Promise<void> {
  logger.info('IDM Listener: Stopping');

  idmState.running = false;
  broadcastIdmState();

  // Tell all content scripts to stop observing
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'IDM_STOP_OBSERVER' }).catch(() => {});
    }
  }
}

function clearIdmVideos(): void {
  idmState.videosFound = [];
  idmState.totalFound = 0;
  idmState.totalDownloaded = 0;
  broadcastIdmState();
}

// ============================================
// Extension lifecycle
// ============================================

chrome.runtime.onInstalled.addListener(async () => {
  logger.info('Extension installed');
  await loadNotifConfig();
  await loadIdmConfig();
});

chrome.runtime.onStartup.addListener(async () => {
  logger.info('Extension started');
  await loadNotifConfig();
  await loadIdmConfig();
});

// Listen for alarms
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === NOTIF_ALARM_NAME) {
    logger.debug('FB Notification Listener: Alarm triggered');
    await runNotificationCheck();
  }
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

    case 'FB_GET_BOOKMARK_FOLDERS':
      getBookmarkFolders().then(folders => {
        sendResponse({ success: true, data: folders } as MessageResponse<BookmarkFolder[]>);
      });
      return true; // Keep channel open for async

    // FB Notification Listener commands
    case 'FB_NOTIF_START':
      startNotificationListener(message.payload).then(() => {
        sendResponse({ success: true } as MessageResponse);
      });
      return true;

    case 'FB_NOTIF_STOP':
      stopNotificationListener().then(() => {
        sendResponse({ success: true } as MessageResponse);
      });
      return true;

    case 'FB_NOTIF_CHECK_NOW':
      runNotificationCheck().then(() => {
        sendResponse({ success: true } as MessageResponse);
      });
      return true;

    case 'FB_NOTIF_GET_STATE':
      sendResponse({
        success: true,
        data: notifState,
      } as MessageResponse<FBNotificationListenerState>);
      break;

    case 'FB_NOTIF_SAVE_CONFIG':
      saveNotifConfig(message.payload).then(() => {
        sendResponse({ success: true } as MessageResponse);
      });
      return true;

    case 'FB_NOTIF_GET_CONFIG':
      sendResponse({
        success: true,
        data: notifConfig,
      } as MessageResponse<FBNotificationListenerConfig>);
      break;

    // IDM Video Listener commands
    case 'IDM_START_LISTENER':
      startIdmListener(message.payload).then(() => {
        sendResponse({ success: true } as MessageResponse);
      });
      return true;

    case 'IDM_STOP_LISTENER':
      stopIdmListener().then(() => {
        sendResponse({ success: true } as MessageResponse);
      });
      return true;

    case 'IDM_GET_STATE':
      sendResponse({
        success: true,
        data: idmState,
      } as MessageResponse<IDMListenerState>);
      break;

    case 'IDM_SAVE_CONFIG':
      saveIdmConfig(message.payload).then(() => {
        sendResponse({ success: true } as MessageResponse);
      });
      return true;

    case 'IDM_GET_CONFIG':
      sendResponse({
        success: true,
        data: idmConfig,
      } as MessageResponse<IDMListenerConfig>);
      break;

    case 'IDM_VIDEO_FOUND':
      if (idmState.running) {
        addVideoLink(message.payload);
      }
      sendResponse({ success: true } as MessageResponse);
      break;

    case 'IDM_DOWNLOAD_VIDEO':
      downloadWithIdm(message.payload.url, message.payload.downloadPath);
      sendResponse({ success: true } as MessageResponse);
      break;

    case 'IDM_CLEAR_VIDEOS':
      clearIdmVideos();
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

    // If IDM listener is running, inject content script and start observer
    if (idmState.running && tab.url && !tab.url.startsWith('chrome://')) {
      chrome.scripting
        .executeScript({
          target: { tabId },
          files: ['content/index.js'],
        })
        .then(() => {
          chrome.tabs.sendMessage(tabId, { type: 'IDM_START_OBSERVER' }).catch(() => {});
        })
        .catch(() => {
          // Ignore errors for restricted tabs
        });
    }
  }
});

// ============================================
// WebRequest listener for video URL interception
// ============================================

// Common video URL patterns to detect
const videoUrlPatterns = [
  // Direct video file extensions
  /\.(mp4|webm|mkv|avi|mov|flv|m4v|3gp)/i,
  // Streaming formats
  /\.(m3u8|mpd|ts)/i,
  // Common video CDN patterns
  /\/video\/|\/videos?\//i,
  /playback|stream|media/i,
  // TikTok specific
  /tiktokcdn.*video/i,
  /v\d+\.tiktokcdn/i,
  /muscdn.*video/i,
  // YouTube (for reference, though blocked by CSP usually)
  /googlevideo\.com.*videoplayback/i,
  // Facebook/Instagram
  /fbcdn.*video/i,
  /cdninstagram.*video/i,
  // Twitter/X
  /video\.twimg/i,
  // Generic video indicators
  /mime.*video/i,
  /content-type.*video/i,
];

function isNetworkVideoUrl(url: string): boolean {
  // Skip blob URLs - they can't be downloaded externally
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return false;
  }

  const lowerUrl = url.toLowerCase();

  // Check against patterns
  for (const pattern of videoUrlPatterns) {
    if (pattern.test(lowerUrl)) {
      return true;
    }
  }

  // Also check configured extensions
  return idmConfig.videoExtensions.some(
    ext =>
      lowerUrl.includes(`.${ext}`) ||
      lowerUrl.includes(`/${ext}?`) ||
      lowerUrl.includes(`format=${ext}`) ||
      lowerUrl.includes(`mime=video/${ext}`)
  );
}

function extractTitleFromUrl(url: string, tabUrl?: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);

    // Try to get filename from path
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.includes('.')) {
      const filename = decodeURIComponent(lastPart.split('?')[0]);
      const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
      if (nameWithoutExt.length > 3) {
        return nameWithoutExt;
      }
    }

    // Try to identify the source
    const hostname = urlObj.hostname;
    if (hostname.includes('tiktok')) return 'TikTok Video';
    if (hostname.includes('facebook') || hostname.includes('fbcdn')) return 'Facebook Video';
    if (hostname.includes('instagram') || hostname.includes('cdninstagram'))
      return 'Instagram Video';
    if (hostname.includes('twitter') || hostname.includes('twimg')) return 'Twitter Video';
    if (hostname.includes('youtube') || hostname.includes('googlevideo')) return 'YouTube Video';

    return tabUrl ? `Video from ${new URL(tabUrl).hostname}` : 'Video';
  } catch {
    return 'Video';
  }
}

function getVideoTypeFromUrl(url: string): string {
  const lowerUrl = url.toLowerCase();
  const extensions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'm3u8', 'ts', 'mpd', 'm4v', '3gp'];

  for (const ext of extensions) {
    if (
      lowerUrl.includes(`.${ext}`) ||
      lowerUrl.includes(`/${ext}`) ||
      lowerUrl.includes(`=${ext}`)
    ) {
      return ext.toUpperCase();
    }
  }

  // Check for streaming indicators
  if (lowerUrl.includes('m3u8') || lowerUrl.includes('hls')) return 'HLS';
  if (lowerUrl.includes('mpd') || lowerUrl.includes('dash')) return 'DASH';

  return 'VIDEO';
}

// Listen for web requests to intercept video URLs
chrome.webRequest.onBeforeRequest.addListener(
  details => {
    // Only process if IDM listener is running
    if (!idmState.running) return;

    const { url, tabId } = details;

    // Skip invalid URLs or extension internal requests
    if (!url || tabId < 0) return;

    // Check if this is a video URL
    if (isNetworkVideoUrl(url)) {
      // Check if already recorded
      const exists = idmState.videosFound.some(v => v.url === url);
      if (exists) return;

      // Get tab URL for context
      chrome.tabs
        .get(tabId)
        .then(tab => {
          const video: IDMVideoLink = {
            id: `vid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url,
            title: extractTitleFromUrl(url, tab.url),
            type: getVideoTypeFromUrl(url),
            timestamp: Date.now(),
            tabId,
            tabUrl: tab.url,
            downloaded: false,
          };

          addVideoLink(video);
        })
        .catch(() => {
          // Tab might no longer exist, still record the video
          const video: IDMVideoLink = {
            id: `vid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url,
            title: extractTitleFromUrl(url),
            type: getVideoTypeFromUrl(url),
            timestamp: Date.now(),
            tabId,
            downloaded: false,
          };

          addVideoLink(video);
        });
    }
  },
  { urls: ['<all_urls>'] }
);

export {};
