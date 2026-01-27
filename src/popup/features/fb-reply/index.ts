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

// Image URL management
let imageUrls: string[] = [];

function renderImageUrlInputs(): void {
  const listEl = document.getElementById('fbImageUrlsList') as HTMLElement;
  listEl.innerHTML = '';

  imageUrls.forEach((url, index) => {
    const row = document.createElement('div');
    row.className = 'fb-image-url-row';
    row.innerHTML = `
      <input type="text" class="fb-image-url-input" value="${url}" data-index="${index}" placeholder="https://example.com/image.jpg" />
      <button class="btn-icon btn-remove-image" data-index="${index}" title="Remove">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    listEl.appendChild(row);
  });

  // Add event listeners for inputs
  listEl.querySelectorAll('.fb-image-url-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const index = parseInt(target.dataset.index || '0', 10);
      imageUrls[index] = target.value;
      saveImageUrls();
    });
  });

  // Add event listeners for remove buttons
  listEl.querySelectorAll('.btn-remove-image').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const index = parseInt(target.dataset.index || '0', 10);
      imageUrls.splice(index, 1);
      saveImageUrls();
      renderImageUrlInputs();
    });
  });
}

function addImageUrl(): void {
  imageUrls.push('');
  saveImageUrls();
  renderImageUrlInputs();
  // Focus the new input
  const inputs = document.querySelectorAll('.fb-image-url-input');
  const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
  if (lastInput) lastInput.focus();
}

function saveImageUrls(): void {
  chrome.storage.local.set({ fbImageUrls: imageUrls });
  setFBActions({ ...fbActions, imageUrls });
}

export async function setupFBAutoReply(): Promise<void> {
  const scanBtn = document.getElementById('fbScanTabsBtn') as HTMLButtonElement;
  const startBtn = document.getElementById('fbStartReplyBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('fbStopReplyBtn') as HTMLButtonElement;
  const selectAllBtn = document.getElementById('fbSelectAllBtn') as HTMLButtonElement;
  const deselectAllBtn = document.getElementById('fbDeselectAllBtn') as HTMLButtonElement;
  const messageEl = document.getElementById('fbReplyMessage') as HTMLTextAreaElement;
  const delayMinEl = document.getElementById('fbReplyDelayMin') as HTMLInputElement;
  const delayMaxEl = document.getElementById('fbReplyDelayMax') as HTMLInputElement;
  const addImageUrlBtn = document.getElementById('fbAddImageUrlBtn') as HTMLButtonElement;

  // Step checkboxes
  const stepClickReply = document.getElementById('fbStepClickReply') as HTMLInputElement;
  const stepInputText = document.getElementById('fbStepInputText') as HTMLInputElement;
  const stepUploadImages = document.getElementById('fbStepUploadImages') as HTMLInputElement;
  const stepSubmit = document.getElementById('fbStepSubmit') as HTMLInputElement;
  const closeCheckbox = document.getElementById('fbActionClose') as HTMLInputElement;

  // Load saved settings
  const stored = await chrome.storage.local.get([
    'fbReplyMessage', 'fbReplyDelayMin', 'fbReplyDelayMax',
    'fbStepClickReply', 'fbStepInputText', 'fbStepUploadImages', 'fbStepSubmit', 'fbActionClose',
    'fbImageUrls'
  ]);
  if (stored.fbReplyMessage) messageEl.value = stored.fbReplyMessage;
  if (stored.fbReplyDelayMin) delayMinEl.value = stored.fbReplyDelayMin;
  if (stored.fbReplyDelayMax) delayMaxEl.value = stored.fbReplyDelayMax;
  if (stored.fbStepClickReply !== undefined) stepClickReply.checked = stored.fbStepClickReply;
  if (stored.fbStepInputText !== undefined) stepInputText.checked = stored.fbStepInputText;
  if (stored.fbStepUploadImages !== undefined) stepUploadImages.checked = stored.fbStepUploadImages;
  if (stored.fbStepSubmit !== undefined) stepSubmit.checked = stored.fbStepSubmit;
  if (stored.fbActionClose !== undefined) closeCheckbox.checked = stored.fbActionClose;
  if (stored.fbImageUrls) imageUrls = stored.fbImageUrls;

  // Render image URL inputs
  renderImageUrlInputs();

  // Helper to get current steps state
  const getCurrentSteps = (): FBReplySteps => ({
    clickReply: stepClickReply.checked,
    inputText: stepInputText.checked,
    uploadImages: stepUploadImages.checked,
    submitReply: stepSubmit.checked,
  });

  // Update local UI state
  setFBActions({
    steps: getCurrentSteps(),
    imageUrls,
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
    setFBActions({ steps: getCurrentSteps(), imageUrls: fbActions.imageUrls, close: fbActions.close });
    updateFBActionUI();
  });

  stepInputText.addEventListener('change', () => {
    chrome.storage.local.set({ fbStepInputText: stepInputText.checked });
    setFBActions({ steps: getCurrentSteps(), imageUrls: fbActions.imageUrls, close: fbActions.close });
    updateFBActionUI();
  });

  stepUploadImages.addEventListener('change', () => {
    chrome.storage.local.set({ fbStepUploadImages: stepUploadImages.checked });
    setFBActions({ steps: getCurrentSteps(), imageUrls: fbActions.imageUrls, close: fbActions.close });
    updateFBActionUI();
  });

  stepSubmit.addEventListener('change', () => {
    chrome.storage.local.set({ fbStepSubmit: stepSubmit.checked });
    setFBActions({ steps: getCurrentSteps(), imageUrls: fbActions.imageUrls, close: fbActions.close });
    updateFBActionUI();
  });

  closeCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ fbActionClose: closeCheckbox.checked });
    setFBActions({ steps: fbActions.steps, imageUrls: fbActions.imageUrls, close: closeCheckbox.checked });
    updateFBActionUI();
  });

  // Add image URL button handler
  addImageUrlBtn.addEventListener('click', addImageUrl);

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
