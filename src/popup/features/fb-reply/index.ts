// FB Auto Reply feature entry point
import { FBReplySteps } from '../../../shared/types';
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

  // Step checkboxes
  const stepClickReply = document.getElementById('fbStepClickReply') as HTMLInputElement;
  const stepInputText = document.getElementById('fbStepInputText') as HTMLInputElement;
  const stepSubmit = document.getElementById('fbStepSubmit') as HTMLInputElement;
  const closeCheckbox = document.getElementById('fbActionClose') as HTMLInputElement;

  // Load saved settings
  const stored = await chrome.storage.local.get([
    'fbReplyMessage', 'fbReplyDelayMin', 'fbReplyDelayMax',
    'fbStepClickReply', 'fbStepInputText', 'fbStepSubmit', 'fbActionClose'
  ]);
  if (stored.fbReplyMessage) messageEl.value = stored.fbReplyMessage;
  if (stored.fbReplyDelayMin) delayMinEl.value = stored.fbReplyDelayMin;
  if (stored.fbReplyDelayMax) delayMaxEl.value = stored.fbReplyDelayMax;
  if (stored.fbStepClickReply !== undefined) stepClickReply.checked = stored.fbStepClickReply;
  if (stored.fbStepInputText !== undefined) stepInputText.checked = stored.fbStepInputText;
  if (stored.fbStepSubmit !== undefined) stepSubmit.checked = stored.fbStepSubmit;
  if (stored.fbActionClose !== undefined) closeCheckbox.checked = stored.fbActionClose;

  // Helper to get current steps state
  const getCurrentSteps = (): FBReplySteps => ({
    clickReply: stepClickReply.checked,
    inputText: stepInputText.checked,
    submitReply: stepSubmit.checked,
  });

  // Update local UI state
  setFBActions({
    steps: getCurrentSteps(),
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

  // Step checkbox handlers
  stepClickReply.addEventListener('change', () => {
    chrome.storage.local.set({ fbStepClickReply: stepClickReply.checked });
    setFBActions({ steps: getCurrentSteps(), close: fbActions.close });
    updateFBActionUI();
  });

  stepInputText.addEventListener('change', () => {
    chrome.storage.local.set({ fbStepInputText: stepInputText.checked });
    setFBActions({ steps: getCurrentSteps(), close: fbActions.close });
    updateFBActionUI();
  });

  stepSubmit.addEventListener('change', () => {
    chrome.storage.local.set({ fbStepSubmit: stepSubmit.checked });
    setFBActions({ steps: getCurrentSteps(), close: fbActions.close });
    updateFBActionUI();
  });

  closeCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ fbActionClose: closeCheckbox.checked });
    setFBActions({ steps: fbActions.steps, close: closeCheckbox.checked });
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
