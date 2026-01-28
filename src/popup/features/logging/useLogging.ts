import { useState, useEffect, useCallback, useMemo } from 'react';
import { LogEntry, LogLevel, LogSource } from '../../../shared/types';
import { getLogs, clearLogs } from '../../../shared/logger';
import { formatData } from '../../../shared/utils';

export type ColumnKey = 'time' | 'source' | 'level' | 'message' | 'data' | 'url';

export interface TableSettings {
  hiddenColumns: ColumnKey[];
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
}

const DEFAULT_TABLE_SETTINGS: TableSettings = {
  hiddenColumns: [],
  sortColumn: null,
  sortDirection: 'desc',
};

export function useLogging() {
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<LogSource | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [tableSettings, setTableSettings] = useState<TableSettings>(DEFAULT_TABLE_SETTINGS);

  // Load logs from background
  const loadLogs = useCallback(async () => {
    const logs = await getLogs();
    setAllLogs(logs);
  }, []);

  // Clear all logs
  const handleClearLogs = useCallback(async () => {
    await clearLogs();
    setAllLogs([]);
  }, []);

  // Load initial logs and settings
  useEffect(() => {
    loadLogs();

    chrome.storage.local.get('tableSettings').then(result => {
      if (result.tableSettings) {
        setTableSettings({ ...DEFAULT_TABLE_SETTINGS, ...result.tableSettings });
      }
    });
  }, [loadLogs]);

  // Setup realtime updates from background
  useEffect(() => {
    const listener = (message: { type: string; payload?: LogEntry[] }) => {
      if (message.type === 'LOGS_UPDATED' && Array.isArray(message.payload)) {
        setAllLogs(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  // Save table settings when changed
  const updateTableSettings = useCallback((settings: Partial<TableSettings>) => {
    setTableSettings(prev => {
      const newSettings = { ...prev, ...settings };
      chrome.storage.local.set({ tableSettings: newSettings });
      return newSettings;
    });
  }, []);

  // Reset table settings
  const resetTableSettings = useCallback(() => {
    setTableSettings(DEFAULT_TABLE_SETTINGS);
    chrome.storage.local.set({ tableSettings: DEFAULT_TABLE_SETTINGS });
  }, []);

  // Toggle column visibility
  const toggleColumn = useCallback(
    (col: ColumnKey) => {
      const hiddenColumns = tableSettings.hiddenColumns.includes(col)
        ? tableSettings.hiddenColumns.filter(c => c !== col)
        : [...tableSettings.hiddenColumns, col];
      updateTableSettings({ hiddenColumns });
    },
    [tableSettings.hiddenColumns, updateTableSettings]
  );

  // Toggle sorting
  const toggleSort = useCallback(
    (column: string) => {
      if (tableSettings.sortColumn === column) {
        if (tableSettings.sortDirection === 'desc') {
          updateTableSettings({ sortDirection: 'asc' });
        } else {
          updateTableSettings({ sortColumn: null, sortDirection: 'desc' });
        }
      } else {
        updateTableSettings({ sortColumn: column, sortDirection: 'desc' });
      }
    },
    [tableSettings.sortColumn, tableSettings.sortDirection, updateTableSettings]
  );

  // Filter and sort logs
  const filteredLogs = useMemo(() => {
    let result = allLogs.filter(log => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (sourceFilter !== 'all' && log.source !== sourceFilter) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchMessage = log.message.toLowerCase().includes(query);
        const matchData = log.data ? formatData(log.data).toLowerCase().includes(query) : false;
        const matchUrl = log.url ? log.url.toLowerCase().includes(query) : false;
        if (!matchMessage && !matchData && !matchUrl) return false;
      }

      return true;
    });

    if (tableSettings.sortColumn) {
      const col = tableSettings.sortColumn;
      const dir = tableSettings.sortDirection === 'asc' ? 1 : -1;

      result = [...result].sort((a, b) => {
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
  }, [
    allLogs,
    levelFilter,
    sourceFilter,
    searchQuery,
    tableSettings.sortColumn,
    tableSettings.sortDirection,
  ]);

  // Calculate stats
  const stats = useMemo(() => {
    const counts = { debug: 0, info: 0, warn: 0, error: 0 };
    allLogs.forEach(log => {
      counts[log.level]++;
    });
    return { ...counts, total: allLogs.length };
  }, [allLogs]);

  return {
    allLogs,
    filteredLogs,
    stats,
    levelFilter,
    setLevelFilter,
    sourceFilter,
    setSourceFilter,
    searchQuery,
    setSearchQuery,
    autoScroll,
    setAutoScroll,
    tableSettings,
    toggleColumn,
    toggleSort,
    resetTableSettings,
    loadLogs,
    clearLogs: handleClearLogs,
  };
}
