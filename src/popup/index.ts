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

function updateCSSCounterUI(result: CSSSearchResult): void {
  const counterGrid = document.getElementById('counterResults') as HTMLElement;
  counterGrid.innerHTML = '';

  const metrics: { key: keyof CSSSearchResult; label: string }[] = [
    { key: 'elements', label: 'Elements Matched' },
    { key: 'classes', label: 'Classes Found' },
    { key: 'ids', label: 'IDs Found' },
    { key: 'inlineStyles', label: 'Inline Styles' },
    { key: 'stylesheetRules', label: 'Stylesheet Rules' },
    { key: 'computedMatches', label: 'Computed Matches' },
  ];

  metrics.forEach(({ key, label }) => {
    const value = result[key];
    if (typeof value === 'number' && value === 0) return;
    if (key === 'query') return;

    const card = document.createElement('div');
    card.className = 'counter-card';
    card.innerHTML = `
      <span class="counter-value">${(value as number).toLocaleString()}</span>
      <span class="counter-label">${label}</span>
    `;
    counterGrid.appendChild(card);
  });
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

async function performCSSSearch(): Promise<void> {
  const cssInput = document.getElementById('cssInput') as HTMLInputElement;
  const resultsSection = document.querySelector('.css-counter-results') as HTMLElement;
  const query = cssInput.value.trim();

  hideCSSStatus();

  if (query.length === 0) {
    resultsSection.classList.remove('visible');
    return;
  }

  // Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showCSSStatus('No active tab found', 'error');
    logger.error('No active tab found');
    return;
  }

  // Check if it's a restricted page
  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('about:')) {
    showCSSStatus('Cannot search on browser internal pages', 'error');
    resultsSection.classList.remove('visible');
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'CSS_SEARCH',
      payload: { query },
    });

    if (response?.success && response.data) {
      hideCSSStatus();
      updateCSSCounterUI(response.data as CSSSearchResult);
      resultsSection.classList.add('visible');
    } else {
      showCSSStatus('No results or invalid response', 'info');
      resultsSection.classList.remove('visible');
    }
  } catch {
    // Content script not loaded - try to inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/index.js'],
      });

      // Wait a moment for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Retry the search
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'CSS_SEARCH',
        payload: { query },
      });

      if (response?.success && response.data) {
        hideCSSStatus();
        updateCSSCounterUI(response.data as CSSSearchResult);
        resultsSection.classList.add('visible');
      }
    } catch (injectError) {
      const errorMsg = injectError instanceof Error ? injectError.message : JSON.stringify(injectError);
      showCSSStatus('Cannot access this page', 'error');
      logger.error('CSS search failed', { error: errorMsg });
      resultsSection.classList.remove('visible');
    }
  }
}

async function setupCSSCounter(): Promise<void> {
  const cssInput = document.getElementById('cssInput') as HTMLInputElement;
  const recountBtn = document.getElementById('recountBtn') as HTMLButtonElement;

  // Load saved input value
  const stored = await chrome.storage.local.get('cssCounterInput');
  if (stored.cssCounterInput) {
    cssInput.value = stored.cssCounterInput;
    // Auto-search with saved value
    performCSSSearch();
  }

  // Auto-search on input (debounced) and save to storage
  let debounceTimer: number;
  cssInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(async () => {
      await chrome.storage.local.set({ cssCounterInput: cssInput.value });
      performCSSSearch();
    }, 500);
  });

  // Re-count button
  recountBtn.addEventListener('click', () => {
    performCSSSearch();
  });

  // Search on Enter key
  cssInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performCSSSearch();
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load settings first
  await loadTableSettings();

  setupOpenWindow();
  setupColumnSettings();
  setupSorting();
  await setupCSSCounter();

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
