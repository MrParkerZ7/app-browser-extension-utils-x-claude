// Logging feature state management
import { LogEntry, LogLevel, LogSource } from '../../../shared/types';
import { formatData } from '../../../shared/utils';

// State
export let allLogs: LogEntry[] = [];
export let filteredLogs: LogEntry[] = [];
export let currentLevelFilter: LogLevel | 'all' = 'all';
export let currentSourceFilter: LogSource | 'all' = 'all';
export let searchQuery = '';
export let autoScroll = true;

// State setters
export function setAllLogs(logs: LogEntry[]): void {
  allLogs = logs;
}

export function setFilteredLogs(logs: LogEntry[]): void {
  filteredLogs = logs;
}

export function setCurrentLevelFilter(filter: LogLevel | 'all'): void {
  currentLevelFilter = filter;
}

export function setCurrentSourceFilter(filter: LogSource | 'all'): void {
  currentSourceFilter = filter;
}

export function setSearchQuery(query: string): void {
  searchQuery = query;
}

export function setAutoScroll(value: boolean): void {
  autoScroll = value;
}

// Table settings
export interface TableSettings {
  hiddenColumns: ColumnKey[];
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
}

export const COLUMNS = ['time', 'source', 'level', 'message', 'data', 'url'] as const;
export type ColumnKey = typeof COLUMNS[number];

export const DEFAULT_TABLE_SETTINGS: TableSettings = {
  hiddenColumns: [],
  sortColumn: null,
  sortDirection: 'desc',
};

export let tableSettings: TableSettings = { ...DEFAULT_TABLE_SETTINGS };

export function setTableSettings(settings: TableSettings): void {
  tableSettings = settings;
}

// Filter and sort the logs - returns the filtered result
export function filterAndSortLogs(): LogEntry[] {
  let result = allLogs.filter(log => {
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

    result.sort((a, b) => {
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

  return result;
}
