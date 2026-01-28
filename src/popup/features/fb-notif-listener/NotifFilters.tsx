import { FBNotificationFilter, FBNotificationListenerConfig } from '../../../shared/types';

interface NotifFiltersProps {
  filters: FBNotificationFilter;
  options: Pick<
    FBNotificationListenerConfig,
    'autoStartReply' | 'expandPreviousNotifications' | 'markAllAsRead'
  >;
  interval: number;
  onFiltersChange: (filters: FBNotificationFilter) => void;
  onOptionsChange: (
    options: Partial<
      Pick<
        FBNotificationListenerConfig,
        'autoStartReply' | 'expandPreviousNotifications' | 'markAllAsRead'
      >
    >
  ) => void;
  onIntervalChange: (interval: number) => void;
}

export function NotifFilters({
  filters,
  options,
  interval,
  onFiltersChange,
  onOptionsChange,
  onIntervalChange,
}: NotifFiltersProps) {
  return (
    <>
      <div className="fb-notif-settings">
        <label className="fb-notif-label">Detection filters:</label>
        <div className="fb-notif-checkboxes">
          <label className="fb-notif-checkbox">
            <input
              type="checkbox"
              checked={filters.mentionsName}
              onChange={e => onFiltersChange({ ...filters, mentionsName: e.target.checked })}
            />
            <span>Mentions your name</span>
          </label>
          <label className="fb-notif-checkbox">
            <input
              type="checkbox"
              checked={filters.replyNotifications}
              onChange={e => onFiltersChange({ ...filters, replyNotifications: e.target.checked })}
            />
            <span>Reply notifications</span>
          </label>
          <label className="fb-notif-checkbox">
            <input
              type="checkbox"
              checked={filters.allCommentNotifications}
              onChange={e =>
                onFiltersChange({ ...filters, allCommentNotifications: e.target.checked })
              }
            />
            <span>All comment notifications</span>
          </label>
        </div>
      </div>

      <div className="fb-notif-settings">
        <label className="fb-notif-label">Options:</label>
        <div className="fb-notif-checkboxes">
          <label className="fb-notif-checkbox">
            <input
              type="checkbox"
              checked={options.expandPreviousNotifications}
              onChange={e => onOptionsChange({ expandPreviousNotifications: e.target.checked })}
            />
            <span>Expand previous notifications</span>
          </label>
          <label className="fb-notif-checkbox">
            <input
              type="checkbox"
              checked={options.markAllAsRead}
              onChange={e => onOptionsChange({ markAllAsRead: e.target.checked })}
            />
            <span>Mark all as read</span>
          </label>
          <label className="fb-notif-checkbox">
            <input
              type="checkbox"
              checked={options.autoStartReply}
              onChange={e => onOptionsChange({ autoStartReply: e.target.checked })}
            />
            <span>Auto-start FB Auto Reply</span>
          </label>
        </div>
      </div>

      <div className="fb-notif-settings">
        <label className="fb-notif-label">Check interval (seconds):</label>
        <input
          type="number"
          className="fb-notif-input"
          value={interval}
          min={10}
          max={3600}
          onChange={e => onIntervalChange(parseInt(e.target.value, 10) || 30)}
        />
      </div>
    </>
  );
}
