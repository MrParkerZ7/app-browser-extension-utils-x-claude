import { useState, useEffect, useCallback } from 'react';
import {
  FBNotificationListenerState,
  FBNotificationListenerConfig,
  FBNotificationFilter,
} from '../../../shared/types';
import { sendMessage } from '../../hooks';

const DEFAULT_CONFIG: FBNotificationListenerConfig = {
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

export function useNotifListener() {
  const [state, setState] = useState<FBNotificationListenerState>({
    running: false,
    lastCheck: null,
    nextCheck: null,
    notificationsFound: 0,
    tabsOpened: 0,
  });

  const [config, setConfig] = useState<FBNotificationListenerConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<{
    message: string;
    type: 'info' | 'error' | 'warning';
  } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load initial config and state
  useEffect(() => {
    // Load config
    chrome.storage.local.get(['fbNotifConfig', 'fbNotifSectionCollapsed']).then(result => {
      if (result.fbNotifConfig) {
        setConfig(result.fbNotifConfig);
      }
      if (result.fbNotifSectionCollapsed) {
        setIsCollapsed(result.fbNotifSectionCollapsed);
      }
    });

    // Get initial state from background
    sendMessage({ type: 'FB_NOTIF_GET_STATE' }).then(response => {
      if (response?.success && response.data) {
        setState(response.data as FBNotificationListenerState);
      }
    });

    // Get config from background (may be more up to date)
    sendMessage({ type: 'FB_NOTIF_GET_CONFIG' }).then(response => {
      if (response?.success && response.data) {
        setConfig(response.data as FBNotificationListenerConfig);
      }
    });
  }, []);

  // Listen for state updates from background
  useEffect(() => {
    const listener = (message: { type: string; payload?: FBNotificationListenerState }) => {
      if (message.type === 'FB_NOTIF_STATE_UPDATE' && message.payload) {
        setState(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const showStatus = useCallback((message: string, type: 'info' | 'error' | 'warning') => {
    setStatus({ message, type });
  }, []);

  const hideStatus = useCallback(() => {
    setStatus(null);
  }, []);

  const startListener = useCallback(async () => {
    // Validate filters
    if (
      !config.filters.mentionsName &&
      !config.filters.replyNotifications &&
      !config.filters.allCommentNotifications
    ) {
      showStatus('Please select at least one notification filter.', 'error');
      return;
    }

    const newConfig = { ...config, enabled: true };
    const response = await sendMessage({ type: 'FB_NOTIF_START', payload: newConfig });

    if (response?.success) {
      showStatus('Listener started', 'info');
      setConfig(newConfig);
    } else {
      showStatus(response?.error || 'Failed to start listener', 'error');
    }
  }, [config, showStatus]);

  const stopListener = useCallback(async () => {
    const response = await sendMessage({ type: 'FB_NOTIF_STOP' });

    if (response?.success) {
      showStatus('Listener stopped', 'info');
    } else {
      showStatus(response?.error || 'Failed to stop listener', 'error');
    }
  }, [showStatus]);

  const checkNow = useCallback(async () => {
    showStatus('Checking notifications...', 'info');
    const response = await sendMessage({ type: 'FB_NOTIF_CHECK_NOW' });

    if (!response?.success) {
      showStatus(response?.error || 'Check failed', 'error');
    }
  }, [showStatus]);

  const saveConfig = useCallback(async (newConfig: FBNotificationListenerConfig) => {
    setConfig(newConfig);
    await sendMessage({ type: 'FB_NOTIF_SAVE_CONFIG', payload: newConfig });
  }, []);

  const updateFilters = useCallback(
    (filters: FBNotificationFilter) => {
      saveConfig({ ...config, filters });
    },
    [config, saveConfig]
  );

  const updateInterval = useCallback(
    (intervalSeconds: number) => {
      saveConfig({ ...config, intervalSeconds });
    },
    [config, saveConfig]
  );

  const updateOptions = useCallback(
    (
      options: Partial<
        Pick<
          FBNotificationListenerConfig,
          'autoStartReply' | 'expandPreviousNotifications' | 'markAllAsRead'
        >
      >
    ) => {
      saveConfig({ ...config, ...options });
    },
    [config, saveConfig]
  );

  const toggleCollapsed = useCallback(() => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    chrome.storage.local.set({ fbNotifSectionCollapsed: newValue });
  }, [isCollapsed]);

  // Format time helper
  const formatTime = useCallback((timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  return {
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
    hideStatus,
  };
}
