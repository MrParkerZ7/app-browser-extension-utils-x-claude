import { LogLevel, LogSource } from '../../../shared/types';

interface LogFiltersProps {
  levelFilter: LogLevel | 'all';
  onLevelChange: (level: LogLevel | 'all') => void;
  sourceFilter: LogSource | 'all';
  onSourceChange: (source: LogSource | 'all') => void;
}

const LEVELS: (LogLevel | 'all')[] = ['all', 'debug', 'info', 'warn', 'error'];
const SOURCES: (LogSource | 'all')[] = ['all', 'background', 'content', 'popup'];

const levelLabels: Record<LogLevel | 'all', string> = {
  all: 'All',
  debug: 'Debug',
  info: 'Info',
  warn: 'Warn',
  error: 'Error',
};

const sourceLabels: Record<LogSource | 'all', string> = {
  all: 'All Sources',
  background: 'Background',
  content: 'Content',
  popup: 'Popup',
};

export function LogFilters({
  levelFilter,
  onLevelChange,
  sourceFilter,
  onSourceChange,
}: LogFiltersProps) {
  return (
    <>
      <div className="log-filters">
        {LEVELS.map(level => (
          <button
            key={level}
            className={`filter-btn ${levelFilter === level ? 'active' : ''}`}
            onClick={() => onLevelChange(level)}
          >
            {levelLabels[level]}
          </button>
        ))}
      </div>
      <div className="log-filters">
        {SOURCES.map(source => (
          <button
            key={source}
            className={`filter-btn ${sourceFilter === source ? 'active' : ''}`}
            onClick={() => onSourceChange(source)}
          >
            {sourceLabels[source]}
          </button>
        ))}
      </div>
    </>
  );
}
