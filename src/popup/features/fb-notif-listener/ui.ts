// FB Notification Listener UI updates
import { notifState, notifConfig } from './state';

export function updateNotifUI(): void {
  updateButtonStates();
  updateStatusDisplay();
  updateStats();
}

export function updateButtonStates(): void {
  const startBtn = document.getElementById('fbNotifStartBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('fbNotifStopBtn') as HTMLButtonElement;
  const checkNowBtn = document.getElementById('fbNotifCheckNowBtn') as HTMLButtonElement;

  if (!startBtn || !stopBtn || !checkNowBtn) return;

  if (notifState.running) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';
    checkNowBtn.disabled = false;
  } else {
    startBtn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
    checkNowBtn.disabled = false;
  }
}

export function updateStatusDisplay(): void {
  const statusEl = document.getElementById('fbNotifStatus') as HTMLElement;
  if (!statusEl) return;

  if (notifState.error) {
    showStatus(notifState.error, 'error');
  } else if (notifState.running) {
    showStatus('Listener is active', 'info');
  } else {
    hideStatus();
  }
}

export function updateStats(): void {
  const lastCheckEl = document.getElementById('fbNotifLastCheck') as HTMLElement;
  const nextCheckEl = document.getElementById('fbNotifNextCheck') as HTMLElement;
  const foundEl = document.getElementById('fbNotifFound') as HTMLElement;
  const openedEl = document.getElementById('fbNotifOpened') as HTMLElement;

  if (lastCheckEl) {
    lastCheckEl.textContent = notifState.lastCheck ? formatTime(notifState.lastCheck) : 'Never';
  }

  if (nextCheckEl) {
    if (notifState.running && notifState.nextCheck) {
      nextCheckEl.textContent = formatTime(notifState.nextCheck);
    } else {
      nextCheckEl.textContent = '-';
    }
  }

  if (foundEl) {
    foundEl.textContent = String(notifState.notificationsFound);
  }

  if (openedEl) {
    openedEl.textContent = String(notifState.tabsOpened);
  }
}

export function showStatus(message: string, type: 'info' | 'error' | 'warning'): void {
  const statusEl = document.getElementById('fbNotifStatus') as HTMLElement;
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `fb-notif-status visible ${type}`;
}

export function hideStatus(): void {
  const statusEl = document.getElementById('fbNotifStatus') as HTMLElement;
  if (!statusEl) return;

  statusEl.className = 'fb-notif-status';
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function loadConfigToUI(): void {
  const intervalEl = document.getElementById('fbNotifInterval') as HTMLInputElement;
  const mentionsEl = document.getElementById('fbNotifFilterMentions') as HTMLInputElement;
  const repliesEl = document.getElementById('fbNotifFilterReplies') as HTMLInputElement;
  const allCommentsEl = document.getElementById('fbNotifFilterAllComments') as HTMLInputElement;
  const autoReplyEl = document.getElementById('fbNotifAutoReply') as HTMLInputElement;
  const expandPrevEl = document.getElementById('fbNotifExpandPrevious') as HTMLInputElement;
  const markAllReadEl = document.getElementById('fbNotifMarkAllRead') as HTMLInputElement;

  if (intervalEl) intervalEl.value = String(notifConfig.intervalSeconds);
  if (mentionsEl) mentionsEl.checked = notifConfig.filters.mentionsName;
  if (repliesEl) repliesEl.checked = notifConfig.filters.replyNotifications;
  if (allCommentsEl) allCommentsEl.checked = notifConfig.filters.allCommentNotifications;
  if (autoReplyEl) autoReplyEl.checked = notifConfig.autoStartReply;
  if (expandPrevEl) expandPrevEl.checked = notifConfig.expandPreviousNotifications;
  if (markAllReadEl) markAllReadEl.checked = notifConfig.markAllAsRead;
}

export function getConfigFromUI(): typeof notifConfig {
  const intervalEl = document.getElementById('fbNotifInterval') as HTMLInputElement;
  const mentionsEl = document.getElementById('fbNotifFilterMentions') as HTMLInputElement;
  const repliesEl = document.getElementById('fbNotifFilterReplies') as HTMLInputElement;
  const allCommentsEl = document.getElementById('fbNotifFilterAllComments') as HTMLInputElement;
  const autoReplyEl = document.getElementById('fbNotifAutoReply') as HTMLInputElement;
  const expandPrevEl = document.getElementById('fbNotifExpandPrevious') as HTMLInputElement;
  const markAllReadEl = document.getElementById('fbNotifMarkAllRead') as HTMLInputElement;

  return {
    enabled: notifState.running,
    intervalSeconds: parseInt(intervalEl?.value || '30', 10),
    filters: {
      mentionsName: mentionsEl?.checked ?? true,
      replyNotifications: repliesEl?.checked ?? true,
      allCommentNotifications: allCommentsEl?.checked ?? false,
    },
    autoStartReply: autoReplyEl?.checked ?? false,
    expandPreviousNotifications: expandPrevEl?.checked ?? false,
    markAllAsRead: markAllReadEl?.checked ?? false,
  };
}
