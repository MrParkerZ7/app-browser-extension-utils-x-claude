// Logging table rendering
import { formatTimestamp, escapeHtml, formatData } from '../../../shared/utils';
import {
  allLogs,
  filteredLogs,
  autoScroll,
  tableSettings,
  COLUMNS,
  ColumnKey,
} from './state';

// DOM Elements
let logTableBody: HTMLTableSectionElement;
let logContainer: HTMLDivElement;
let statDebug: HTMLSpanElement;
let statInfo: HTMLSpanElement;
let statWarn: HTMLSpanElement;
let statError: HTMLSpanElement;
let statTotal: HTMLSpanElement;

export function initTableElements(): void {
  logTableBody = document.getElementById('logTableBody') as HTMLTableSectionElement;
  logContainer = document.getElementById('logContainer') as HTMLDivElement;
  statDebug = document.getElementById('statDebug') as HTMLSpanElement;
  statInfo = document.getElementById('statInfo') as HTMLSpanElement;
  statWarn = document.getElementById('statWarn') as HTMLSpanElement;
  statError = document.getElementById('statError') as HTMLSpanElement;
  statTotal = document.getElementById('statTotal') as HTMLSpanElement;
}

export function isColumnHidden(col: ColumnKey): boolean {
  return tableSettings.hiddenColumns.includes(col);
}

function getHiddenClass(col: ColumnKey): string {
  return isColumnHidden(col) ? 'hidden-col' : '';
}

export function createExpandableContent(text: string, maxLength: number = 50): string {
  if (!text) return '';
  const needsExpand = text.length > maxLength;
  const indicator = needsExpand ? '<span class="expand-indicator">▶</span>' : '';
  return `<div class="log-cell-content" title="Click to expand/collapse">${escapeHtml(text)}${indicator}</div>`;
}

export function updateStats(): void {
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

export function renderLogs(): void {
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
        <td class="log-message ${getHiddenClass('message')}" data-col="message">${createExpandableContent(log.message, 60)}</td>
        <td class="${getHiddenClass('data')}" data-col="data">${dataStr ? `<span class="log-data">${createExpandableContent(dataStr, 40)}</span>` : ''}</td>
        <td class="log-url ${getHiddenClass('url')}" data-col="url">${createExpandableContent(urlStr, 30)}</td>
      `;
      fragment.appendChild(tr);
    });
  }

  logTableBody.innerHTML = '';
  logTableBody.appendChild(fragment);

  // Add click handlers for expandable content
  logTableBody.querySelectorAll('.log-cell-content').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      el.classList.toggle('expanded');
    });
  });

  // Auto-scroll to bottom
  if (autoScroll) {
    logContainer.scrollTop = logContainer.scrollHeight;
  }
}
