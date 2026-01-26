// Logging feature entry point
import { LogEntry } from '../../../shared/types';
import { getLogs } from '../../../shared/logger';
import { createLogger } from '../../../shared/logger';
import {
  setAllLogs,
  setFilteredLogs,
  filterAndSortLogs,
  allLogs,
} from './state';
import {
  setupFilterButtons,
  setupSearch,
  setupActions,
  setFilterChangeCallback,
  setRefreshCallback,
} from './filters';
import { initTableElements, updateStats, renderLogs } from './table';
import {
  loadTableSettings,
  setupColumnSettings,
  setupSorting,
  updateColumnVisibilityUI,
  updateSortUI,
  setSettingsChangeCallback,
} from './columns';

const logger = createLogger('popup');

// Apply filters and re-render
function applyFilters(): void {
  const filtered = filterAndSortLogs();
  setFilteredLogs(filtered);
  renderLogs();
}

// Load logs from background
async function loadLogs(): Promise<void> {
  try {
    const logs = await getLogs();
    setAllLogs(logs);
    updateStats();
    applyFilters();
    logger.debug('Logs loaded', { count: logs.length });
  } catch (error) {
    logger.error('Failed to load logs', { error: String(error) });
  }
}

// Setup realtime updates from background
function setupRealtimeUpdates(): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'LOGS_UPDATED' && Array.isArray(message.payload)) {
      setAllLogs(message.payload);
      updateStats();
      applyFilters();
    }
  });
}

export async function setupLogging(): Promise<void> {
  // Initialize DOM element references
  initTableElements();

  // Load saved settings
  await loadTableSettings();

  // Setup callbacks for filter/settings changes
  setFilterChangeCallback(() => {
    updateStats();
    applyFilters();
  });
  setSettingsChangeCallback(applyFilters);
  setRefreshCallback(loadLogs);

  // Setup UI components
  setupColumnSettings();
  setupSorting();
  setupFilterButtons();
  setupSearch();
  setupActions();

  // Apply loaded settings to UI
  updateColumnVisibilityUI();
  updateSortUI();

  // Setup realtime updates from background
  setupRealtimeUpdates();

  // Load initial logs
  await loadLogs();
}

export { loadLogs };
