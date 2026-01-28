interface NotifStatsProps {
  lastCheck: string;
  nextCheck: string;
  found: number;
  opened: number;
}

export function NotifStats({ lastCheck, nextCheck, found, opened }: NotifStatsProps) {
  return (
    <div className="fb-notif-stats">
      <div className="fb-notif-stat">
        <span className="fb-notif-stat-label">Last check:</span>
        <span className="fb-notif-stat-value">{lastCheck}</span>
      </div>
      <div className="fb-notif-stat">
        <span className="fb-notif-stat-label">Next check:</span>
        <span className="fb-notif-stat-value">{nextCheck}</span>
      </div>
      <div className="fb-notif-stat">
        <span className="fb-notif-stat-label">Found:</span>
        <span className="fb-notif-stat-value">{found}</span>
      </div>
      <div className="fb-notif-stat">
        <span className="fb-notif-stat-label">Tabs opened:</span>
        <span className="fb-notif-stat-value">{opened}</span>
      </div>
    </div>
  );
}
