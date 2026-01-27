// FB Notification Listener state management
import {
  FBNotificationListenerState,
  FBNotificationListenerConfig,
  FBNotificationFilter,
} from '../../../shared/types';

// Default configuration
export const DEFAULT_CONFIG: FBNotificationListenerConfig = {
  enabled: false,
  intervalSeconds: 30,
  filters: {
    mentionsName: true,
    replyNotifications: true,
    allCommentNotifications: false,
  },
  autoStartReply: false,
  expandPreviousNotifications: false,
  markAllAsRead: false,
};

// Current state
export let notifState: FBNotificationListenerState = {
  running: false,
  lastCheck: null,
  nextCheck: null,
  notificationsFound: 0,
  tabsOpened: 0,
};

// Current config
export let notifConfig: FBNotificationListenerConfig = { ...DEFAULT_CONFIG };

export function setNotifState(state: FBNotificationListenerState): void {
  notifState = state;
}

export function setNotifConfig(config: FBNotificationListenerConfig): void {
  notifConfig = config;
}

export function getFilters(): FBNotificationFilter {
  return notifConfig.filters;
}
