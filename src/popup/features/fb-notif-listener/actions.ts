// FB Notification Listener action handlers
import { FBNotificationListenerConfig, FBNotificationListenerState } from '../../../shared/types';
import { setNotifState, setNotifConfig } from './state';
import { updateNotifUI, showStatus, getConfigFromUI } from './ui';

export async function startNotifListener(): Promise<void> {
  const config = getConfigFromUI();
  config.enabled = true;

  // Validate at least one filter is selected
  if (
    !config.filters.mentionsName &&
    !config.filters.replyNotifications &&
    !config.filters.allCommentNotifications
  ) {
    showStatus('Please select at least one notification filter.', 'error');
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: 'FB_NOTIF_START',
    payload: config,
  });

  if (response?.success) {
    showStatus('Listener started', 'info');
    setNotifConfig(config);
  } else {
    showStatus(response?.error || 'Failed to start listener', 'error');
  }
}

export async function stopNotifListener(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'FB_NOTIF_STOP' });

  if (response?.success) {
    showStatus('Listener stopped', 'info');
  } else {
    showStatus(response?.error || 'Failed to stop listener', 'error');
  }
}

export async function checkNow(): Promise<void> {
  showStatus('Checking notifications...', 'info');

  const response = await chrome.runtime.sendMessage({ type: 'FB_NOTIF_CHECK_NOW' });

  if (!response?.success) {
    showStatus(response?.error || 'Check failed', 'error');
  }
}

export async function markAllRead(): Promise<void> {
  showStatus('Marking all as read...', 'info');

  const response = await chrome.runtime.sendMessage({ type: 'FB_NOTIF_MARK_ALL_READ' });

  if (response?.success) {
    showStatus('Marked all as read', 'info');
  } else {
    showStatus(response?.error || 'Failed to mark all as read', 'error');
  }
}

export async function saveConfig(): Promise<void> {
  const config = getConfigFromUI();

  await chrome.runtime.sendMessage({
    type: 'FB_NOTIF_SAVE_CONFIG',
    payload: config,
  });

  setNotifConfig(config);
}

export function setupNotifStateListener(): void {
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'FB_NOTIF_STATE_UPDATE' && message.payload) {
      applyNotifState(message.payload as FBNotificationListenerState);
    }
  });
}

export function applyNotifState(state: FBNotificationListenerState): void {
  setNotifState(state);
  updateNotifUI();
}

export async function getInitialNotifState(): Promise<void> {
  // Get state
  const stateResponse = await chrome.runtime.sendMessage({ type: 'FB_NOTIF_GET_STATE' });
  if (stateResponse?.success && stateResponse.data) {
    applyNotifState(stateResponse.data as FBNotificationListenerState);
  }

  // Get config
  const configResponse = await chrome.runtime.sendMessage({ type: 'FB_NOTIF_GET_CONFIG' });
  if (configResponse?.success && configResponse.data) {
    setNotifConfig(configResponse.data as FBNotificationListenerConfig);
  }
}
