// Column visibility and sorting settings
import {
  tableSettings,
  setTableSettings,
  DEFAULT_TABLE_SETTINGS,
  ColumnKey,
} from './state';
import { isColumnHidden, renderLogs } from './table';

// Callback for when settings change and filters need reapplication
let onSettingsChange: (() => void) | null = null;

export function setSettingsChangeCallback(callback: () => void): void {
  onSettingsChange = callback;
}

export async function loadTableSettings(): Promise<void> {
  const result = await chrome.storage.local.get('tableSettings');
  if (result.tableSettings) {
    setTableSettings({ ...DEFAULT_TABLE_SETTINGS, ...result.tableSettings });
  }
}

export async function saveTableSettings(): Promise<void> {
  await chrome.storage.local.set({ tableSettings });
}

export function updateColumnVisibilityUI(): void {
  // Update colgroup visibility
  const cols = document.querySelectorAll('.log-table col[data-col]');
  cols.forEach(col => {
    const colName = col.getAttribute('data-col') as ColumnKey;
    if (isColumnHidden(colName)) {
      col.classList.add('hidden-col');
    } else {
      col.classList.remove('hidden-col');
    }
  });

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

export function updateSortUI(): void {
  const headers = document.querySelectorAll('.log-table th[data-sort]');
  headers.forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const sortKey = th.getAttribute('data-sort');
    if (sortKey === tableSettings.sortColumn) {
      th.classList.add(tableSettings.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

export function setupColumnSettings(): void {
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
    setTableSettings({ ...DEFAULT_TABLE_SETTINGS });
    await saveTableSettings();
    updateColumnVisibilityUI();
    updateSortUI();
    onSettingsChange?.();
    dropdown.classList.remove('show');
  });
}

export function setupSorting(): void {
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
      onSettingsChange?.();
    });
  });
}
