import { useNotifListener } from './useNotifListener';
import { NotifFilters } from './NotifFilters';
import { NotifStats } from './NotifStats';

export function NotifListenerPanel() {
  const {
    state,
    config,
    status,
    isCollapsed,
    startListener,
    stopListener,
    checkNow,
    updateFilters,
    updateInterval,
    updateOptions,
    toggleCollapsed,
    formatTime,
  } = useNotifListener();

  return (
    <div className="fb-notif-section">
      <div
        className={`fb-notif-section-header ${isCollapsed ? 'collapsed' : ''}`}
        onClick={toggleCollapsed}
      >
        <svg
          className="fb-notif-collapse-icon"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        <span>Notification Listener</span>
      </div>
      <div className={`fb-notif-section-content ${isCollapsed ? 'collapsed' : ''}`}>
        <p className="fb-notif-desc">
          Periodically scans Facebook notifications and opens matching ones in new tabs.
        </p>

        <NotifFilters
          filters={config.filters}
          options={{
            autoStartReply: config.autoStartReply,
            expandPreviousNotifications: config.expandPreviousNotifications,
            markAllAsRead: config.markAllAsRead,
          }}
          interval={config.intervalSeconds}
          onFiltersChange={updateFilters}
          onOptionsChange={updateOptions}
          onIntervalChange={updateInterval}
        />

        {(status || state.error) && (
          <div className={`fb-notif-status visible ${status?.type || 'error'}`}>
            {status?.message || state.error}
          </div>
        )}
        {!status && !state.error && state.running && (
          <div className="fb-notif-status visible info">Listener is active</div>
        )}

        <NotifStats
          lastCheck={formatTime(state.lastCheck)}
          nextCheck={state.running && state.nextCheck ? formatTime(state.nextCheck) : '-'}
          found={state.notificationsFound}
          opened={state.tabsOpened}
        />

        <div className="fb-notif-actions">
          <button
            className="btn btn-primary"
            style={{ display: state.running ? 'none' : 'inline-flex' }}
            onClick={startListener}
          >
            Start
          </button>
          <button
            className="btn btn-danger"
            style={{ display: state.running ? 'inline-flex' : 'none' }}
            onClick={stopListener}
          >
            Stop
          </button>
          <button className="btn btn-secondary" onClick={checkNow}>
            Check Now
          </button>
        </div>
      </div>
    </div>
  );
}
