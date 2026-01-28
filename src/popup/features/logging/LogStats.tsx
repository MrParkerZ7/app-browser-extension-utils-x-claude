interface LogStatsProps {
  stats: {
    debug: number;
    info: number;
    warn: number;
    error: number;
    total: number;
  };
}

export function LogStats({ stats }: LogStatsProps) {
  return (
    <div className="log-stats">
      <span className="stat-item">
        <span className="stat-dot debug"></span> Debug: <span>{stats.debug}</span>
      </span>
      <span className="stat-item">
        <span className="stat-dot info"></span> Info: <span>{stats.info}</span>
      </span>
      <span className="stat-item">
        <span className="stat-dot warn"></span> Warn: <span>{stats.warn}</span>
      </span>
      <span className="stat-item">
        <span className="stat-dot error"></span> Error: <span>{stats.error}</span>
      </span>
      <span className="stat-item">
        Total: <span>{stats.total}</span>
      </span>
    </div>
  );
}
