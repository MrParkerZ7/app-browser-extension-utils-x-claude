// Logging filter and search functionality
import { LogLevel, LogSource } from '../../../shared/types';
import { clearLogs } from '../../../shared/logger';
import {
  setCurrentLevelFilter,
  setCurrentSourceFilter,
  setSearchQuery,
  setAutoScroll,
  setAllLogs,
} from './state';

// Callback for when filters change
let onFilterChange: (() => void) | null = null;

export function setFilterChangeCallback(callback: () => void): void {
  onFilterChange = callback;
}

// DOM Elements
let logSearch: HTMLInputElement;
let autoScrollCheckbox: HTMLInputElement;
let refreshLogsBtn: HTMLButtonElement;
let clearLogsBtn: HTMLButtonElement;

// Callback for refresh
let onRefresh: (() => Promise<void>) | null = null;

export function setRefreshCallback(callback: () => Promise<void>): void {
  onRefresh = callback;
}

export function setupFilterButtons(): void {
  // Level filters
  const levelFilters = document.querySelectorAll('.filter-btn[data-level]');
  levelFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      levelFilters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setCurrentLevelFilter(btn.getAttribute('data-level') as LogLevel | 'all');
      onFilterChange?.();
    });
  });

  // Source filters
  const sourceFilters = document.querySelectorAll('.filter-btn[data-source]');
  sourceFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      sourceFilters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setCurrentSourceFilter(btn.getAttribute('data-source') as LogSource | 'all');
      onFilterChange?.();
    });
  });
}

export function setupSearch(): void {
  logSearch = document.getElementById('logSearch') as HTMLInputElement;

  let debounceTimer: number;
  logSearch.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      setSearchQuery(logSearch.value.trim());
      onFilterChange?.();
    }, 200);
  });
}

export function setupActions(): void {
  autoScrollCheckbox = document.getElementById('autoScroll') as HTMLInputElement;
  refreshLogsBtn = document.getElementById('refreshLogs') as HTMLButtonElement;
  clearLogsBtn = document.getElementById('clearLogs') as HTMLButtonElement;

  refreshLogsBtn.addEventListener('click', () => {
    onRefresh?.();
  });

  clearLogsBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      await clearLogs();
      setAllLogs([]);
      onFilterChange?.();
    }
  });

  autoScrollCheckbox.addEventListener('change', () => {
    setAutoScroll(autoScrollCheckbox.checked);
  });
}
