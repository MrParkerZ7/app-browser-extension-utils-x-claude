// FB Auto Reply action handlers
import { FBTab, FBAutoReplyConfig, FBAutoReplyState } from '../../../shared/types';
import { fbState, fbActions, applyFBState } from './state';
import { showFBStatus, hideFBStatus } from './tabs';

export async function scanFBTabs(): Promise<void> {
  hideFBStatus();

  const response = await chrome.runtime.sendMessage({ type: 'FB_SCAN_TABS' });
  if (response?.success) {
    // State will be updated via FB_STATE_UPDATE message
    const tabs = response.data as FBTab[];
    if (tabs.length > 0) {
      showFBStatus(`Found ${tabs.length} FB comment tab(s) ready to reply.`, 'info');
    } else {
      showFBStatus('No Facebook comment tabs found.', 'warning');
    }
  }
}

export async function startFBAutoReply(): Promise<void> {
  const messageEl = document.getElementById('fbReplyMessage') as HTMLTextAreaElement;
  const delayMinEl = document.getElementById('fbReplyDelayMin') as HTMLInputElement;
  const delayMaxEl = document.getElementById('fbReplyDelayMax') as HTMLInputElement;

  const message = messageEl.value.trim();
  const delayMin = parseInt(delayMinEl.value, 10) || 1500;
  const delayMax = parseInt(delayMaxEl.value, 10) || 3000;
  const steps = fbActions.steps;
  const imageUrls = fbActions.imageUrls.filter(url => url.trim() !== '');
  const doClose = fbActions.close;

  // Validate: at least one action must be selected
  const hasAnyStep = steps.clickReply || steps.inputText || steps.uploadImages || steps.submitReply;
  if (!hasAnyStep && !doClose) {
    showFBStatus('Please select at least one action.', 'error');
    return;
  }

  // Only require message if inputText step is selected
  if (steps.inputText && !message) {
    showFBStatus('Please enter a reply message.', 'error');
    return;
  }

  // Only require image URLs if uploadImages step is selected
  if (steps.uploadImages && imageUrls.length === 0) {
    showFBStatus('Please add at least one image URL.', 'error');
    return;
  }

  const config: FBAutoReplyConfig = {
    message,
    imageUrls,
    delayMin,
    delayMax,
    steps,
    doClose,
  };

  const response = await chrome.runtime.sendMessage({
    type: 'FB_START_AUTO_REPLY',
    payload: config
  });

  if (response?.success) {
    showFBStatus('Starting...', 'info');
  } else {
    showFBStatus(response?.error || 'Failed to start', 'error');
  }
}

export async function stopFBAutoReply(): Promise<void> {
  showFBStatus('Stopping...', 'warning');
  await chrome.runtime.sendMessage({ type: 'FB_STOP_AUTO_REPLY' });
}

export async function selectAllFBTabs(): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'FB_SELECT_ALL_TABS',
    payload: { selected: true }
  });
}

export async function deselectAllFBTabs(): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'FB_SELECT_ALL_TABS',
    payload: { selected: false }
  });
}

export function setupFBStateListener(): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'FB_STATE_UPDATE' && message.payload) {
      applyFBState(message.payload as FBAutoReplyState);
    }
  });
}

export async function getInitialFBState(): Promise<void> {
  const stateResponse = await chrome.runtime.sendMessage({ type: 'FB_GET_STATE' });
  if (stateResponse?.success && stateResponse.data) {
    applyFBState(stateResponse.data as FBAutoReplyState);
  }
}
