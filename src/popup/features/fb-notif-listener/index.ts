// FB Notification Listener feature entry point
import { setNotifConfig, DEFAULT_CONFIG } from './state';
import { loadConfigToUI, updateNotifUI } from './ui';
import {
  startNotifListener,
  stopNotifListener,
  checkNow,
  saveConfig,
  setupNotifStateListener,
  getInitialNotifState,
} from './actions';

export async function setupNotificationListener(): Promise<void> {
  // Get DOM elements
  const startBtn = document.getElementById('fbNotifStartBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('fbNotifStopBtn') as HTMLButtonElement;
  const checkNowBtn = document.getElementById('fbNotifCheckNowBtn') as HTMLButtonElement;

  // Filter checkboxes
  const mentionsEl = document.getElementById('fbNotifFilterMentions') as HTMLInputElement;
  const repliesEl = document.getElementById('fbNotifFilterReplies') as HTMLInputElement;
  const allCommentsEl = document.getElementById('fbNotifFilterAllComments') as HTMLInputElement;

  // Option checkboxes
  const autoReplyEl = document.getElementById('fbNotifAutoReply') as HTMLInputElement;
  const expandPrevEl = document.getElementById('fbNotifExpandPrevious') as HTMLInputElement;
  const markAllReadEl = document.getElementById('fbNotifMarkAllRead') as HTMLInputElement;

  // Interval input
  const intervalEl = document.getElementById('fbNotifInterval') as HTMLInputElement;

  // Section collapse toggle
  const sectionHeader = document.getElementById('fbNotifSectionHeader') as HTMLElement;
  const sectionContent = document.getElementById('fbNotifSectionContent') as HTMLElement;

  // Load saved config from storage
  const stored = await chrome.storage.local.get(['fbNotifConfig']);
  if (stored.fbNotifConfig) {
    setNotifConfig(stored.fbNotifConfig);
  } else {
    setNotifConfig(DEFAULT_CONFIG);
  }

  // Load config to UI
  loadConfigToUI();

  // Setup section collapse toggle
  if (sectionHeader && sectionContent) {
    const savedCollapsed = await chrome.storage.local.get(['fbNotifSectionCollapsed']);
    if (savedCollapsed.fbNotifSectionCollapsed) {
      sectionContent.classList.add('collapsed');
      sectionHeader.classList.add('collapsed');
    }

    sectionHeader.addEventListener('click', () => {
      const isCollapsed = sectionContent.classList.toggle('collapsed');
      sectionHeader.classList.toggle('collapsed', isCollapsed);
      chrome.storage.local.set({ fbNotifSectionCollapsed: isCollapsed });
    });
  }

  // Setup button handlers
  if (startBtn) {
    startBtn.addEventListener('click', startNotifListener);
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', stopNotifListener);
  }

  if (checkNowBtn) {
    checkNowBtn.addEventListener('click', checkNow);
  }

  // Setup config change handlers - auto-save on change
  const configInputs = [mentionsEl, repliesEl, allCommentsEl, autoReplyEl, expandPrevEl, markAllReadEl];
  configInputs.forEach(el => {
    if (el) {
      el.addEventListener('change', saveConfig);
    }
  });

  if (intervalEl) {
    intervalEl.addEventListener('change', saveConfig);
  }

  // Setup state listener for updates from background
  setupNotifStateListener();

  // Get initial state from background
  await getInitialNotifState();

  // Reload config to UI after getting initial state (config may have been updated from background)
  loadConfigToUI();

  // Update UI with loaded state
  updateNotifUI();
}
