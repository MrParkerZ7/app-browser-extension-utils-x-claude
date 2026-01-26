// Popup script
import { LogEntry, LogLevel, LogSource, CSSSearchResult } from '../shared/types';
import { createLogger, getLogs, clearLogs } from '../shared/logger';

const logger = createLogger('popup');

// Larger window size when opening externally
const WINDOW_SIZE = { width: 1280, height: 800 };

// Column definitions
const COLUMNS = ['time', 'source', 'level', 'message', 'data', 'url'] as const;
type ColumnKey = typeof COLUMNS[number];

interface TableSettings {
  hiddenColumns: ColumnKey[];
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
}

const DEFAULT_TABLE_SETTINGS: TableSettings = {
  hiddenColumns: [],
  sortColumn: null,
  sortDirection: 'desc',
};

// State
let allLogs: LogEntry[] = [];
let filteredLogs: LogEntry[] = [];
let currentLevelFilter: LogLevel | 'all' = 'all';
let currentSourceFilter: LogSource | 'all' = 'all';
let searchQuery = '';
let autoScroll = true;
let tableSettings: TableSettings = { ...DEFAULT_TABLE_SETTINGS };

// DOM Elements
const logTableBody = document.getElementById('logTableBody') as HTMLTableSectionElement;
const logContainer = document.getElementById('logContainer') as HTMLDivElement;
const logSearch = document.getElementById('logSearch') as HTMLInputElement;
const autoScrollCheckbox = document.getElementById('autoScroll') as HTMLInputElement;
const refreshLogsBtn = document.getElementById('refreshLogs') as HTMLButtonElement;
const clearLogsBtn = document.getElementById('clearLogs') as HTMLButtonElement;

// Stats elements
const statDebug = document.getElementById('statDebug') as HTMLSpanElement;
const statInfo = document.getElementById('statInfo') as HTMLSpanElement;
const statWarn = document.getElementById('statWarn') as HTMLSpanElement;
const statError = document.getElementById('statError') as HTMLSpanElement;
const statTotal = document.getElementById('statTotal') as HTMLSpanElement;

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatData(data: unknown): string {
  if (data === undefined || data === null) return '';
  try {
    return JSON.stringify(data, null, 0);
  } catch {
    return String(data);
  }
}

function applyFilters(): void {
  filteredLogs = allLogs.filter(log => {
    // Level filter
    if (currentLevelFilter !== 'all' && log.level !== currentLevelFilter) {
      return false;
    }

    // Source filter
    if (currentSourceFilter !== 'all' && log.source !== currentSourceFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchMessage = log.message.toLowerCase().includes(query);
      const matchData = log.data ? formatData(log.data).toLowerCase().includes(query) : false;
      const matchUrl = log.url ? log.url.toLowerCase().includes(query) : false;
      if (!matchMessage && !matchData && !matchUrl) {
        return false;
      }
    }

    return true;
  });

  // Apply sorting
  if (tableSettings.sortColumn) {
    const col = tableSettings.sortColumn;
    const dir = tableSettings.sortDirection === 'asc' ? 1 : -1;

    filteredLogs.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (col) {
        case 'timestamp':
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
        case 'source':
          aVal = a.source;
          bVal = b.source;
          break;
        case 'level':
          aVal = a.level;
          bVal = b.level;
          break;
        case 'message':
          aVal = a.message.toLowerCase();
          bVal = b.message.toLowerCase();
          break;
        case 'url':
          aVal = (a.url || '').toLowerCase();
          bVal = (b.url || '').toLowerCase();
          break;
      }

      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });
  }

  renderLogs();
}

function updateStats(): void {
  const stats = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };

  allLogs.forEach(log => {
    stats[log.level]++;
  });

  statDebug.textContent = String(stats.debug);
  statInfo.textContent = String(stats.info);
  statWarn.textContent = String(stats.warn);
  statError.textContent = String(stats.error);
  statTotal.textContent = String(allLogs.length);
}

function isColumnHidden(col: ColumnKey): boolean {
  return tableSettings.hiddenColumns.includes(col);
}

function getHiddenClass(col: ColumnKey): string {
  return isColumnHidden(col) ? 'hidden-col' : '';
}

function renderLogs(): void {
  const fragment = document.createDocumentFragment();
  const visibleColCount = COLUMNS.filter(c => !isColumnHidden(c)).length;

  if (filteredLogs.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="${visibleColCount}" style="text-align: center; padding: 48px; color: #5a6a7a;">
        No logs to display
      </td>
    `;
    fragment.appendChild(tr);
  } else {
    filteredLogs.forEach(log => {
      const tr = document.createElement('tr');
      const dataStr = formatData(log.data);
      const urlStr = log.url || '';

      tr.innerHTML = `
        <td class="log-time ${getHiddenClass('time')}" data-col="time">${formatTimestamp(log.timestamp)}</td>
        <td class="${getHiddenClass('source')}" data-col="source"><span class="log-source ${log.source}">${log.source}</span></td>
        <td class="${getHiddenClass('level')}" data-col="level"><span class="log-level ${log.level}">${log.level}</span></td>
        <td class="log-message ${getHiddenClass('message')}" data-col="message">${escapeHtml(log.message)}</td>
        <td class="${getHiddenClass('data')}" data-col="data">${dataStr ? `<span class="log-data" title="${escapeHtml(dataStr)}">${escapeHtml(dataStr)}</span>` : ''}</td>
        <td class="log-url ${getHiddenClass('url')}" data-col="url" title="${escapeHtml(urlStr)}">${escapeHtml(urlStr)}</td>
      `;
      fragment.appendChild(tr);
    });
  }

  logTableBody.innerHTML = '';
  logTableBody.appendChild(fragment);

  // Auto-scroll to bottom
  if (autoScroll) {
    logContainer.scrollTop = logContainer.scrollHeight;
  }
}

async function loadLogs(): Promise<void> {
  try {
    allLogs = await getLogs();
    updateStats();
    applyFilters();
    logger.debug('Logs loaded', { count: allLogs.length });
  } catch (error) {
    logger.error('Failed to load logs', { error: String(error) });
  }
}

function setupFilterButtons(): void {
  // Level filters
  const levelFilters = document.querySelectorAll('.filter-btn[data-level]');
  levelFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      levelFilters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLevelFilter = btn.getAttribute('data-level') as LogLevel | 'all';
      applyFilters();
    });
  });

  // Source filters
  const sourceFilters = document.querySelectorAll('.filter-btn[data-source]');
  sourceFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      sourceFilters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSourceFilter = btn.getAttribute('data-source') as LogSource | 'all';
      applyFilters();
    });
  });
}

function setupSearch(): void {
  let debounceTimer: number;
  logSearch.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      searchQuery = logSearch.value.trim();
      applyFilters();
    }, 200);
  });
}

function setupActions(): void {
  refreshLogsBtn.addEventListener('click', () => {
    loadLogs();
  });

  clearLogsBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      await clearLogs();
      allLogs = [];
      updateStats();
      applyFilters();
    }
  });

  autoScrollCheckbox.addEventListener('change', () => {
    autoScroll = autoScrollCheckbox.checked;
  });
}

function switchToTab(targetId: string): void {
  const tabs = document.querySelectorAll('.tab');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabs.forEach(t => t.classList.remove('active'));
  tabPanels.forEach(panel => panel.classList.remove('active'));

  const targetTab = document.querySelector(`.tab[data-tab="${targetId}"]`);
  const targetPanel = document.getElementById(targetId);

  if (targetTab) targetTab.classList.add('active');
  if (targetPanel) targetPanel.classList.add('active');
}

function setupTabSwitching(): void {
  const tabs = document.querySelectorAll('.tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      if (targetId) {
        switchToTab(targetId);
        // Save last active tab
        chrome.storage.local.set({ lastActiveTab: targetId });
      }
    });
  });
}

async function restoreLastTab(): Promise<void> {
  const { lastActiveTab } = await chrome.storage.local.get('lastActiveTab');
  if (lastActiveTab) {
    switchToTab(lastActiveTab);
  }
}

function setupRealtimeUpdates(): void {
  // Listen for log updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'LOGS_UPDATED' && Array.isArray(message.payload)) {
      allLogs = message.payload;
      updateStats();
      applyFilters();
    }
  });
}

function setupOpenWindow(): void {
  const openWindowBtn = document.getElementById('openWindowBtn') as HTMLButtonElement;

  openWindowBtn.addEventListener('click', () => {
    const popupUrl = chrome.runtime.getURL('popup/popup.html');

    chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: WINDOW_SIZE.width,
      height: WINDOW_SIZE.height,
    });

    // Close the popup
    window.close();
  });
}

async function loadTableSettings(): Promise<void> {
  const result = await chrome.storage.local.get('tableSettings');
  if (result.tableSettings) {
    tableSettings = { ...DEFAULT_TABLE_SETTINGS, ...result.tableSettings };
  }
}

async function saveTableSettings(): Promise<void> {
  await chrome.storage.local.set({ tableSettings });
}

function updateColumnVisibilityUI(): void {
  // Update header visibility
  const headers = document.querySelectorAll('.log-table th[data-col]');
  headers.forEach(th => {
    const col = th.getAttribute('data-col') as ColumnKey;
    if (isColumnHidden(col)) {
      th.classList.add('hidden-col');
    } else {
      th.classList.remove('hidden-col');
    }
  });

  // Update checkbox states
  const checkboxes = document.querySelectorAll('#columnDropdown input[data-col]');
  checkboxes.forEach(cb => {
    const col = (cb as HTMLInputElement).getAttribute('data-col') as ColumnKey;
    (cb as HTMLInputElement).checked = !isColumnHidden(col);
  });
}

function updateSortUI(): void {
  const headers = document.querySelectorAll('.log-table th[data-sort]');
  headers.forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const sortKey = th.getAttribute('data-sort');
    if (sortKey === tableSettings.sortColumn) {
      th.classList.add(tableSettings.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function setupColumnSettings(): void {
  const settingsBtn = document.getElementById('columnSettingsBtn') as HTMLButtonElement;
  const dropdown = document.getElementById('columnDropdown') as HTMLDivElement;
  const resetBtn = document.getElementById('resetTableSettings') as HTMLButtonElement;

  // Toggle dropdown
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    dropdown.classList.remove('show');
  });

  dropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Column visibility checkboxes
  const checkboxes = dropdown.querySelectorAll('input[data-col]');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', async () => {
      const col = (cb as HTMLInputElement).getAttribute('data-col') as ColumnKey;
      const isChecked = (cb as HTMLInputElement).checked;

      if (isChecked) {
        tableSettings.hiddenColumns = tableSettings.hiddenColumns.filter(c => c !== col);
      } else {
        if (!tableSettings.hiddenColumns.includes(col)) {
          tableSettings.hiddenColumns.push(col);
        }
      }

      await saveTableSettings();
      updateColumnVisibilityUI();
      renderLogs();
    });
  });

  // Reset button
  resetBtn.addEventListener('click', async () => {
    tableSettings = { ...DEFAULT_TABLE_SETTINGS };
    await saveTableSettings();
    updateColumnVisibilityUI();
    updateSortUI();
    applyFilters();
    dropdown.classList.remove('show');
  });
}

function setupSorting(): void {
  const headers = document.querySelectorAll('.log-table th[data-sort]');

  headers.forEach(th => {
    th.addEventListener('click', async () => {
      const sortKey = th.getAttribute('data-sort');

      if (tableSettings.sortColumn === sortKey) {
        // Toggle direction or clear
        if (tableSettings.sortDirection === 'desc') {
          tableSettings.sortDirection = 'asc';
        } else {
          // Clear sorting
          tableSettings.sortColumn = null;
          tableSettings.sortDirection = 'desc';
        }
      } else {
        tableSettings.sortColumn = sortKey;
        tableSettings.sortDirection = 'desc';
      }

      await saveTableSettings();
      updateSortUI();
      applyFilters();
    });
  });
}

// ============================================
// CSS Counter Feature (searches content page)
// ============================================

interface SearchItem {
  id: string;
  query: string;
  classes: number;
  textMatches: number;
}

let searchItems: SearchItem[] = [];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function showCSSStatus(message: string, type: 'error' | 'info'): void {
  const statusEl = document.getElementById('cssStatus') as HTMLElement;
  statusEl.textContent = message;
  statusEl.className = `css-counter-status visible ${type}`;
}

function hideCSSStatus(): void {
  const statusEl = document.getElementById('cssStatus') as HTMLElement;
  statusEl.classList.remove('visible');
}

function createSearchItemElement(item: SearchItem): HTMLElement {
  const div = document.createElement('div');
  div.className = 'search-item';
  div.dataset.id = item.id;
  div.innerHTML = `
    <input
      type="text"
      class="css-input"
      placeholder="Enter class or text to search..."
      spellcheck="false"
      value="${item.query.replace(/"/g, '&quot;')}"
    />
    <div class="search-results">
      <div class="result-badge">
        <span class="count">${item.classes}</span>
        <span class="label">classes</span>
      </div>
      <div class="result-badge">
        <span class="count">${item.textMatches}</span>
        <span class="label">text</span>
      </div>
    </div>
    <button class="btn-icon btn-remove" title="Remove">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  return div;
}

function updateSearchItemResults(id: string, classes: number, textMatches: number): void {
  const item = searchItems.find(i => i.id === id);
  if (item) {
    item.classes = classes;
    item.textMatches = textMatches;
  }

  const el = document.querySelector(`.search-item[data-id="${id}"]`);
  if (el) {
    const counts = el.querySelectorAll('.result-badge .count');
    if (counts[0]) counts[0].textContent = String(classes);
    if (counts[1]) counts[1].textContent = String(textMatches);
  }
}

async function saveSearchItems(): Promise<void> {
  await chrome.storage.local.set({ searchItems: searchItems.map(i => ({ id: i.id, query: i.query })) });
}

async function performSearchForItem(id: string, query: string): Promise<void> {
  if (!query.trim()) {
    updateSearchItemResults(id, 0, 0);
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('about:')) {
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'CSS_SEARCH',
      payload: { query },
    });

    if (response?.success && response.data) {
      const result = response.data as CSSSearchResult;
      updateSearchItemResults(id, result.classes, result.textMatches);
    }
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/index.js'],
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'CSS_SEARCH',
        payload: { query },
      });

      if (response?.success && response.data) {
        const result = response.data as CSSSearchResult;
        updateSearchItemResults(id, result.classes, result.textMatches);
      }
    } catch {
      // Silently fail for individual items
    }
  }
}

async function performAllSearches(): Promise<void> {
  hideCSSStatus();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showCSSStatus('No active tab found', 'error');
    return;
  }

  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('about:')) {
    showCSSStatus('Cannot search on browser internal pages', 'error');
    return;
  }

  for (const item of searchItems) {
    await performSearchForItem(item.id, item.query);
  }
}

function renderSearchList(): void {
  const list = document.getElementById('searchList') as HTMLElement;
  list.innerHTML = '';

  searchItems.forEach(item => {
    const el = createSearchItemElement(item);
    list.appendChild(el);
  });

  setupSearchItemListeners();
}

function setupSearchItemListeners(): void {
  const list = document.getElementById('searchList') as HTMLElement;

  // Input listeners
  list.querySelectorAll('.css-input').forEach(input => {
    let debounceTimer: number;
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const itemEl = target.closest('.search-item') as HTMLElement;
      const id = itemEl.dataset.id!;
      const query = target.value;

      const item = searchItems.find(i => i.id === id);
      if (item) item.query = query;

      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(async () => {
        await saveSearchItems();
        performSearchForItem(id, query);
      }, 500);
    });

    input.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter') {
        const target = ke.target as HTMLInputElement;
        const itemEl = target.closest('.search-item') as HTMLElement;
        const id = itemEl.dataset.id!;
        performSearchForItem(id, target.value);
      }
    });
  });

  // Remove listeners
  list.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const itemEl = (e.target as HTMLElement).closest('.search-item') as HTMLElement;
      const id = itemEl.dataset.id!;

      searchItems = searchItems.filter(i => i.id !== id);
      await saveSearchItems();
      renderSearchList();
    });
  });
}

function addSearchItem(query = ''): void {
  const newItem: SearchItem = {
    id: generateId(),
    query,
    classes: 0,
    textMatches: 0,
  };
  searchItems.push(newItem);
  saveSearchItems();
  renderSearchList();

  // Focus the new input
  const list = document.getElementById('searchList') as HTMLElement;
  const lastInput = list.querySelector('.search-item:last-child .css-input') as HTMLInputElement;
  if (lastInput) lastInput.focus();
}

async function setupCSSCounter(): Promise<void> {
  const addBtn = document.getElementById('addSearchBtn') as HTMLButtonElement;
  const recountBtn = document.getElementById('recountBtn') as HTMLButtonElement;

  // Load saved search items
  const stored = await chrome.storage.local.get('searchItems');
  if (stored.searchItems && Array.isArray(stored.searchItems)) {
    searchItems = stored.searchItems.map((i: { id: string; query: string }) => ({
      id: i.id,
      query: i.query,
      classes: 0,
      textMatches: 0,
    }));
  }

  // Add default item if empty
  if (searchItems.length === 0) {
    searchItems.push({ id: generateId(), query: '', classes: 0, textMatches: 0 });
  }

  renderSearchList();
  performAllSearches();

  // Add button
  addBtn.addEventListener('click', () => {
    addSearchItem();
  });

  // Re-count all button
  recountBtn.addEventListener('click', () => {
    performAllSearches();
  });
}

// ============================================
// FB Auto Reply Feature
// ============================================

interface FBTab {
  id: number;
  index: number;
  title: string;
  url: string;
  status: 'skip' | 'pending' | 'processing' | 'done' | 'error';
  error?: string;
  selected: boolean;
}

interface FBActions {
  reply: boolean;
  close: boolean;
}

let fbTabs: FBTab[] = [];
let fbReplyRunning = false;
let fbReplyAbort = false;
let fbActions: FBActions = { reply: true, close: true };

function isFacebookCommentUrl(url: string): boolean {
  return url.includes('facebook.com') && url.includes('comment_id');
}

function getActionLabel(): string {
  if (fbActions.reply && fbActions.close) return 'Reply & Close';
  if (fbActions.reply) return 'Reply';
  if (fbActions.close) return 'Close Tabs';
  return 'Start';
}

function updateFBActionUI(): void {
  const messageSettings = document.getElementById('fbMessageSettings') as HTMLElement;
  const replyCheckbox = document.getElementById('fbActionReply') as HTMLInputElement;
  const closeCheckbox = document.getElementById('fbActionClose') as HTMLInputElement;

  fbActions.reply = replyCheckbox.checked;
  fbActions.close = closeCheckbox.checked;

  // Show message input only when reply is checked
  if (fbActions.reply) {
    messageSettings.classList.remove('hidden');
  } else {
    messageSettings.classList.add('hidden');
  }

  updateFBButtonStates();
}

// Centralized function to update button states based on current status
function updateFBButtonStates(): void {
  const startBtn = document.getElementById('fbStartReplyBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('fbStopReplyBtn') as HTMLButtonElement;
  const scanBtn = document.getElementById('fbScanTabsBtn') as HTMLButtonElement;
  const selectAllBtn = document.getElementById('fbSelectAllBtn') as HTMLButtonElement;
  const deselectAllBtn = document.getElementById('fbDeselectAllBtn') as HTMLButtonElement;

  const hasSelectedPendingTabs = fbTabs.some(t => t.status === 'pending' && t.selected);
  const hasProcessingTabs = fbTabs.some(t => t.status === 'processing');
  const hasTabs = fbTabs.length > 0;

  // Scan button: disabled when running
  scanBtn.disabled = fbReplyRunning;

  // Start button: enabled when not running AND has selected pending tabs
  startBtn.disabled = fbReplyRunning || !hasSelectedPendingTabs;

  // Stop button: enabled only when running
  stopBtn.disabled = !fbReplyRunning;

  // Select/Deselect buttons: disabled when running or no tabs
  selectAllBtn.disabled = fbReplyRunning || !hasTabs;
  deselectAllBtn.disabled = fbReplyRunning || !hasTabs;

  // Update button text to show current state and action
  if (fbReplyRunning) {
    startBtn.textContent = hasProcessingTabs ? 'Running...' : 'Start';
  } else {
    startBtn.textContent = getActionLabel();
  }
}

function showFBStatus(message: string, type: 'error' | 'info' | 'warning'): void {
  const statusEl = document.getElementById('fbReplyStatus') as HTMLElement;
  statusEl.textContent = message;
  statusEl.className = `fb-reply-status visible ${type}`;
}

function hideFBStatus(): void {
  const statusEl = document.getElementById('fbReplyStatus') as HTMLElement;
  statusEl.classList.remove('visible');
}

function updateFBProgress(completed: number, total: number): void {
  const progressEl = document.getElementById('fbReplyProgress') as HTMLElement;
  const fillEl = document.getElementById('fbProgressFill') as HTMLElement;
  const textEl = document.getElementById('fbProgressText') as HTMLElement;

  if (total === 0) {
    progressEl.classList.remove('visible');
    return;
  }

  progressEl.classList.add('visible');
  const percent = (completed / total) * 100;
  fillEl.style.width = `${percent}%`;
  textEl.textContent = `${completed} / ${total} completed`;
}

function renderFBTabs(): void {
  const listEl = document.getElementById('fbTabsList') as HTMLElement;
  const countEl = document.getElementById('fbTabCount') as HTMLElement;
  const selectedCountEl = document.getElementById('fbSelectedCount') as HTMLElement;

  const selectedCount = fbTabs.filter(t => t.selected && t.status === 'pending').length;
  countEl.textContent = String(fbTabs.length);
  selectedCountEl.textContent = String(selectedCount);
  listEl.innerHTML = '';

  fbTabs.forEach((tab, index) => {
    const div = document.createElement('div');
    div.className = `fb-tab-item ${tab.status}`;
    if (tab.status === 'skip') div.classList.add('skipped');
    if (tab.status === 'done') div.classList.add('completed');
    if (tab.status === 'processing') div.classList.add('current');
    if (tab.status === 'error') div.classList.add('failed');
    if (!tab.selected) div.classList.add('unselected');

    const statusLabels: Record<string, string> = {
      skip: 'Skip',
      pending: 'Pending',
      processing: 'Processing',
      done: 'Done',
      error: 'Error',
    };

    const isDisabled = tab.status !== 'pending' || fbReplyRunning;
    const checkboxHtml = `<input type="checkbox" class="fb-tab-checkbox" data-tab-id="${tab.id}" ${tab.selected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} />`;

    div.innerHTML = `
      ${checkboxHtml}
      <span class="fb-tab-index">#${index + 1}</span>
      <span class="fb-tab-title" title="${tab.url}">${tab.title || 'Facebook Tab'}</span>
      <span class="fb-tab-status ${tab.status}">${statusLabels[tab.status]}</span>
    `;
    listEl.appendChild(div);
  });

  // Add checkbox event listeners
  listEl.querySelectorAll('.fb-tab-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const tabId = parseInt(target.dataset.tabId || '0', 10);
      const tab = fbTabs.find(t => t.id === tabId);
      if (tab) {
        tab.selected = target.checked;
        renderFBTabs();
        updateFBButtonStates();
      }
    });
  });
}

async function scanFBTabs(): Promise<void> {
  logger.info('FB Auto Reply: Scanning for Facebook tabs');
  hideFBStatus();
  fbTabs = [];

  const tabs = await chrome.tabs.query({});
  const fbTabsFound = tabs.filter(t => t.url && isFacebookCommentUrl(t.url));

  fbTabsFound.forEach((tab) => {
    fbTabs.push({
      id: tab.id!,
      index: tab.index,
      title: tab.title || 'Facebook',
      url: tab.url || '',
      status: 'pending',
      selected: true,
    });
  });

  logger.info('FB Auto Reply: Scan complete', {
    totalTabs: fbTabs.length,
    pendingTabs: fbTabs.filter(t => t.status === 'pending').length,
  });

  renderFBTabs();
  updateFBButtonStates();

  if (fbTabs.length > 0) {
    showFBStatus(`Found ${fbTabs.length} FB comment tab(s) ready to reply.`, 'info');
  } else {
    showFBStatus('No Facebook comment tabs found.', 'warning');
    logger.warn('FB Auto Reply: No Facebook comment tabs found');
  }

  updateFBProgress(0, 0);
}

async function startFBAutoReply(): Promise<void> {
  const messageEl = document.getElementById('fbReplyMessage') as HTMLTextAreaElement;
  const delayEl = document.getElementById('fbReplyDelay') as HTMLInputElement;

  const message = messageEl.value.trim();
  const delay = parseInt(delayEl.value, 10) || 2000;
  const doReply = fbActions.reply;
  const doClose = fbActions.close;

  // Validate: at least one action must be selected
  if (!doReply && !doClose) {
    showFBStatus('Please select at least one action.', 'error');
    logger.error('FB Auto Reply: No action selected');
    return;
  }

  // Only require message for reply action
  if (doReply && !message) {
    showFBStatus('Please enter a reply message.', 'error');
    logger.error('FB Auto Reply: No message provided');
    return;
  }

  fbReplyRunning = true;
  fbReplyAbort = false;
  updateFBButtonStates();
  renderFBTabs(); // Update checkboxes to disabled state

  const selectedPendingTabs = fbTabs.filter(t => t.status === 'pending' && t.selected);
  let completed = 0;
  const total = selectedPendingTabs.length;

  const actionDesc = doReply && doClose ? 'reply & close' : doReply ? 'reply' : 'close';

  logger.info(`FB Auto Reply: Starting ${actionDesc}`, {
    doReply,
    doClose,
    message: doReply ? message : undefined,
    delay,
    totalTabs: total,
  });

  updateFBProgress(0, total);
  showFBStatus(`${actionDesc} started...`, 'info');

  for (const tab of selectedPendingTabs) {
    if (fbReplyAbort) {
      logger.warn('FB Auto Reply: Stopped by user', { completed, total });
      showFBStatus('Operation stopped by user.', 'warning');
      break;
    }

    const tabIndex = selectedPendingTabs.indexOf(tab) + 1;
    logger.info(`FB Auto Reply: Processing tab ${tabIndex}/${total}`, {
      doReply,
      doClose,
      tabId: tab.id,
      title: tab.title,
      url: tab.url,
    });

    // Update status to processing
    tab.status = 'processing';
    renderFBTabs();
    updateFBButtonStates();

    try {
      let replySuccess = true;

      // Reply action
      if (doReply) {
        // Switch to the tab
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
              logger.error('FB Auto Reply: Cannot inject script (restricted page)', { tabId: tab.id });
              throw new Error('Cannot inject script on this page');
            }
            logger.debug('FB Auto Reply: Script injection attempt failed', { tabId: tab.id, attempt, error: errMsg });
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        // Wait for script to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Send auto reply message with retry
        let response = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            logger.debug('FB Auto Reply: Sending reply message', { tabId: tab.id, message, attempt });
            response = await chrome.tabs.sendMessage(tab.id, {
              type: 'FB_AUTO_REPLY',
              payload: { message },
            });
            break;
          } catch (sendError) {
            const errMsg = sendError instanceof Error ? sendError.message : String(sendError);
            logger.warn('FB Auto Reply: Message send failed', { tabId: tab.id, attempt, error: errMsg });
            if (attempt < 3) {
              // Try re-injecting script before retry
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
          replySuccess = true;
        } else {
          replySuccess = false;
          tab.status = 'error';
          tab.error = response?.error || 'Unknown error';
          logger.error(`FB Auto Reply: Tab ${tabIndex} reply failed`, {
            tabId: tab.id,
            error: tab.error,
          });
        }
      }

      // Close action (only if reply succeeded or reply not selected)
      if (doClose && replySuccess) {
        if (doReply) {
          // Wait a bit after reply before closing
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        logger.debug('FB Auto Reply: Closing tab', { tabId: tab.id });
        await chrome.tabs.remove(tab.id);
        logger.info(`FB Auto Reply: Tab ${tabIndex} closed`, { tabId: tab.id });
      }

      // Mark as done if all actions succeeded
      if (replySuccess) {
        tab.status = 'done';
        completed++;
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

    renderFBTabs();
    updateFBButtonStates();
    updateFBProgress(completed, total);

    // Wait before next tab
    if (!fbReplyAbort && selectedPendingTabs.indexOf(tab) < selectedPendingTabs.length - 1) {
      logger.debug('FB Auto Reply: Waiting before next tab', { delay });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  fbReplyRunning = false;
  updateFBButtonStates();

  if (!fbReplyAbort) {
    logger.info(`FB Auto Reply: ${actionDesc} completed`, { completed, total });
    showFBStatus(`${actionDesc} completed. ${completed}/${total} successful.`, 'info');
  }
}

function stopFBAutoReply(): void {
  logger.warn('FB Auto Reply: Stop requested by user');
  fbReplyAbort = true;
  showFBStatus('Stopping...', 'warning');
  updateFBButtonStates();
}

function selectAllFBTabs(): void {
  fbTabs.forEach(tab => {
    if (tab.status === 'pending') {
      tab.selected = true;
    }
  });
  renderFBTabs();
  updateFBButtonStates();
}

function deselectAllFBTabs(): void {
  fbTabs.forEach(tab => {
    if (tab.status === 'pending') {
      tab.selected = false;
    }
  });
  renderFBTabs();
  updateFBButtonStates();
}

async function setupFBAutoReply(): Promise<void> {
  const scanBtn = document.getElementById('fbScanTabsBtn') as HTMLButtonElement;
  const startBtn = document.getElementById('fbStartReplyBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('fbStopReplyBtn') as HTMLButtonElement;
  const selectAllBtn = document.getElementById('fbSelectAllBtn') as HTMLButtonElement;
  const deselectAllBtn = document.getElementById('fbDeselectAllBtn') as HTMLButtonElement;
  const messageEl = document.getElementById('fbReplyMessage') as HTMLTextAreaElement;
  const delayEl = document.getElementById('fbReplyDelay') as HTMLInputElement;
  const replyCheckbox = document.getElementById('fbActionReply') as HTMLInputElement;
  const closeCheckbox = document.getElementById('fbActionClose') as HTMLInputElement;

  // Load saved settings
  const stored = await chrome.storage.local.get(['fbReplyMessage', 'fbReplyDelay', 'fbActionReply', 'fbActionClose']);
  if (stored.fbReplyMessage) messageEl.value = stored.fbReplyMessage;
  if (stored.fbReplyDelay) delayEl.value = stored.fbReplyDelay;
  if (stored.fbActionReply !== undefined) replyCheckbox.checked = stored.fbActionReply;
  if (stored.fbActionClose !== undefined) closeCheckbox.checked = stored.fbActionClose;

  // Update global state and UI
  fbActions.reply = replyCheckbox.checked;
  fbActions.close = closeCheckbox.checked;
  updateFBActionUI();

  // Save settings on change
  messageEl.addEventListener('input', () => {
    chrome.storage.local.set({ fbReplyMessage: messageEl.value });
  });

  delayEl.addEventListener('input', () => {
    chrome.storage.local.set({ fbReplyDelay: delayEl.value });
  });

  replyCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ fbActionReply: replyCheckbox.checked });
    updateFBActionUI();
  });

  closeCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ fbActionClose: closeCheckbox.checked });
    updateFBActionUI();
  });

  scanBtn.addEventListener('click', scanFBTabs);
  startBtn.addEventListener('click', startFBAutoReply);
  stopBtn.addEventListener('click', stopFBAutoReply);
  selectAllBtn.addEventListener('click', selectAllFBTabs);
  deselectAllBtn.addEventListener('click', deselectAllFBTabs);

  // Initial scan
  scanFBTabs();
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load settings first
  await loadTableSettings();

  setupOpenWindow();
  setupColumnSettings();
  setupSorting();
  await setupCSSCounter();
  await setupFBAutoReply();

  // Apply loaded settings to UI
  updateColumnVisibilityUI();
  updateSortUI();

  logger.info('Popup opened');

  setupTabSwitching();
  await restoreLastTab();
  setupFilterButtons();
  setupSearch();
  setupActions();
  setupRealtimeUpdates();

  // Load initial logs
  loadLogs();

  // Log current tab info
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      logger.debug('Current tab', { url: tabs[0].url, title: tabs[0].title });
    }
  });
});

export {};
