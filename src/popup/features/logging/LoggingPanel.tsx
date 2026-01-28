import { useState, useCallback, useRef, useEffect } from 'react';
import { useLogging, ColumnKey } from './useLogging';
import { LogFilters } from './LogFilters';
import { LogStats } from './LogStats';
import { LogTable } from './LogTable';

const COLUMNS: ColumnKey[] = ['time', 'source', 'level', 'message', 'data', 'url'];

export function LoggingPanel() {
  const {
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
    clearLogs,
  } = useLogging();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number>();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = window.setTimeout(() => {
        setSearchQuery(value.trim());
      }, 200);
    },
    [setSearchQuery]
  );

  const handleClearLogs = useCallback(async () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      await clearLogs();
    }
  }, [clearLogs]);

  const handleResetSettings = useCallback(() => {
    resetTableSettings();
    setDropdownOpen(false);
  }, [resetTableSettings]);

  return (
    <div id="tab-logging" className="tab-panel active">
      <div className="log-toolbar">
        <LogFilters
          levelFilter={levelFilter}
          onLevelChange={setLevelFilter}
          sourceFilter={sourceFilter}
          onSourceChange={setSourceFilter}
        />
        <input
          type="text"
          className="search-box"
          placeholder="Search logs..."
          defaultValue={searchQuery}
          onChange={handleSearchChange}
        />
        <label className="auto-scroll-label">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
        <div className="column-settings" ref={dropdownRef}>
          <button
            className="column-settings-btn"
            onClick={e => {
              e.stopPropagation();
              setDropdownOpen(!dropdownOpen);
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Columns
          </button>
          <div
            className={`column-dropdown ${dropdownOpen ? 'show' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            {COLUMNS.map(col => (
              <label key={col}>
                <input
                  type="checkbox"
                  checked={!tableSettings.hiddenColumns.includes(col)}
                  onChange={() => toggleColumn(col)}
                />{' '}
                {col.charAt(0).toUpperCase() + col.slice(1)}
              </label>
            ))}
            <div className="column-dropdown-divider"></div>
            <button onClick={handleResetSettings}>Reset All Settings</button>
          </div>
        </div>
        <div className="log-actions">
          <button className="btn btn-primary" onClick={loadLogs}>
            Refresh
          </button>
          <button className="btn btn-danger" onClick={handleClearLogs}>
            Clear Logs
          </button>
        </div>
      </div>
      <div className="log-toolbar" style={{ paddingTop: 0 }}>
        <LogStats stats={stats} />
      </div>
      <LogTable
        logs={filteredLogs}
        tableSettings={tableSettings}
        autoScroll={autoScroll}
        onToggleSort={toggleSort}
      />
    </div>
  );
}
