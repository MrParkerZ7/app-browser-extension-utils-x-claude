import { useRef, useEffect, useState } from 'react';
import { LogEntry } from '../../../shared/types';
import { formatTimestamp, escapeHtml, formatData } from '../../../shared/utils';
import type { ColumnKey, TableSettings } from './useLogging';

interface LogTableProps {
  logs: LogEntry[];
  tableSettings: TableSettings;
  autoScroll: boolean;
  onToggleSort: (column: string) => void;
}

const COLUMNS: { key: ColumnKey; label: string; sortKey?: string }[] = [
  { key: 'time', label: 'Time', sortKey: 'timestamp' },
  { key: 'source', label: 'Source', sortKey: 'source' },
  { key: 'level', label: 'Level', sortKey: 'level' },
  { key: 'message', label: 'Message', sortKey: 'message' },
  { key: 'data', label: 'Data' },
  { key: 'url', label: 'URL', sortKey: 'url' },
];

function ExpandableContent({ text, maxLength = 50 }: { text: string; maxLength?: number }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const needsExpand = text.length > maxLength;

  return (
    <div
      className={`log-cell-content ${expanded ? 'expanded' : ''}`}
      title="Click to expand/collapse"
      onClick={e => {
        e.stopPropagation();
        setExpanded(!expanded);
      }}
    >
      {escapeHtml(text)}
      {needsExpand && <span className="expand-indicator">&#9654;</span>}
    </div>
  );
}

export function LogTable({ logs, tableSettings, autoScroll, onToggleSort }: LogTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const isColumnHidden = (col: ColumnKey) => tableSettings.hiddenColumns.includes(col);
  const visibleColCount = COLUMNS.filter(c => !isColumnHidden(c.key)).length;

  const getSortClass = (sortKey?: string) => {
    if (!sortKey || tableSettings.sortColumn !== sortKey) return '';
    return tableSettings.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc';
  };

  return (
    <div className="log-container" ref={containerRef}>
      <table className="log-table">
        <colgroup>
          {COLUMNS.map(col => (
            <col
              key={col.key}
              className={`col-${col.key} ${isColumnHidden(col.key) ? 'hidden-col' : ''}`}
              data-col={col.key}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                data-col={col.key}
                data-sort={col.sortKey}
                className={`${isColumnHidden(col.key) ? 'hidden-col' : ''} ${getSortClass(col.sortKey)}`}
                onClick={col.sortKey ? () => onToggleSort(col.sortKey!) : undefined}
                style={col.sortKey ? { cursor: 'pointer' } : undefined}
              >
                <span className="th-content">
                  {col.label}
                  {col.sortKey && <span className="sort-icon"></span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td
                colSpan={visibleColCount}
                style={{ textAlign: 'center', padding: '48px', color: '#5a6a7a' }}
              >
                No logs to display
              </td>
            </tr>
          ) : (
            logs.map(log => {
              const dataStr = formatData(log.data);
              const urlStr = log.url || '';

              return (
                <tr key={log.id}>
                  <td
                    className={`log-time ${isColumnHidden('time') ? 'hidden-col' : ''}`}
                    data-col="time"
                  >
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className={isColumnHidden('source') ? 'hidden-col' : ''} data-col="source">
                    <span className={`log-source ${log.source}`}>{log.source}</span>
                  </td>
                  <td className={isColumnHidden('level') ? 'hidden-col' : ''} data-col="level">
                    <span className={`log-level ${log.level}`}>{log.level}</span>
                  </td>
                  <td
                    className={`log-message ${isColumnHidden('message') ? 'hidden-col' : ''}`}
                    data-col="message"
                  >
                    <ExpandableContent text={log.message} maxLength={60} />
                  </td>
                  <td className={isColumnHidden('data') ? 'hidden-col' : ''} data-col="data">
                    {dataStr && (
                      <span className="log-data">
                        <ExpandableContent text={dataStr} maxLength={40} />
                      </span>
                    )}
                  </td>
                  <td
                    className={`log-url ${isColumnHidden('url') ? 'hidden-col' : ''}`}
                    data-col="url"
                  >
                    <ExpandableContent text={urlStr} maxLength={30} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
