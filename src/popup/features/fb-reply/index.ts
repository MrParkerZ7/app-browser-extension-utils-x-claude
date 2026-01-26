// FB Auto Reply feature entry point
import { fbState, fbActions, setFBActions } from './state';
import { updateFBActionUI } from './tabs';
import {
  scanFBTabs,
  startFBAutoReply,
  stopFBAutoReply,
  selectAllFBTabs,
  deselectAllFBTabs,
  setupFBStateListener,
  getInitialFBState,
} from './actions';

export async function setupFBAutoReply(): Promise<void> {
  const scanBtn = document.getElementById('fbScanTabsBtn') as HTMLButtonElement;
  const startBtn = document.getElementById('fbStartReplyBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('fbStopReplyBtn') as HTMLButtonElement;
  const selectAllBtn = document.getElementById('fbSelectAllBtn') as HTMLButtonElement;
  const deselectAllBtn = document.getElementById('fbDeselectAllBtn') as HTMLButtonElement;
  const messageEl = document.getElementById('fbReplyMessage') as HTMLTextAreaElement;
  const delayMinEl = document.getElementById('fbReplyDelayMin') as HTMLInputElement;
  const delayMaxEl = document.getElementById('fbReplyDelayMax') as HTMLInputElement;
  const replyCheckbox = document.getElementById('fbActionReply') as HTMLInputElement;
  const closeCheckbox = document.getElementById('fbActionClose') as HTMLInputElement;

  // Load saved settings
  const stored = await chrome.storage.local.get([
    'fbReplyMessage', 'fbReplyDelayMin', 'fbReplyDelayMax', 'fbActionReply', 'fbActionClose'
  ]);
  if (stored.fbReplyMessage) messageEl.value = stored.fbReplyMessage;
  if (stored.fbReplyDelayMin) delayMinEl.value = stored.fbReplyDelayMin;
  if (stored.fbReplyDelayMax) delayMaxEl.value = stored.fbReplyDelayMax;
  if (stored.fbActionReply !== undefined) replyCheckbox.checked = stored.fbActionReply;
  if (stored.fbActionClose !== undefined) closeCheckbox.checked = stored.fbActionClose;

  // Update local UI state
  setFBActions({
    reply: replyCheckbox.checked,
    close: closeCheckbox.checked,
  });
  updateFBActionUI();

  // Save settings on change
  messageEl.addEventListener('input', () => {
    chrome.storage.local.set({ fbReplyMessage: messageEl.value });
  });

  delayMinEl.addEventListener('input', () => {
    chrome.storage.local.set({ fbReplyDelayMin: delayMinEl.value });
  });

  delayMaxEl.addEventListener('input', () => {
    chrome.storage.local.set({ fbReplyDelayMax: delayMaxEl.value });
  });

  replyCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ fbActionReply: replyCheckbox.checked });
    setFBActions({
      reply: replyCheckbox.checked,
      close: fbActions.close,
    });
    updateFBActionUI();
  });

  closeCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ fbActionClose: closeCheckbox.checked });
    setFBActions({
      reply: fbActions.reply,
      close: closeCheckbox.checked,
    });
    updateFBActionUI();
  });

  // Setup button handlers
  scanBtn.addEventListener('click', scanFBTabs);
  startBtn.addEventListener('click', startFBAutoReply);
  stopBtn.addEventListener('click', stopFBAutoReply);
  selectAllBtn.addEventListener('click', selectAllFBTabs);
  deselectAllBtn.addEventListener('click', deselectAllFBTabs);

  // Listen for state updates from background
  setupFBStateListener();

  // Get initial state from background
  await getInitialFBState();

  // Initial scan if not already running
  if (!fbState.running) {
    scanFBTabs();
  }
}
