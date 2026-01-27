// FB Auto Reply feature entry point
import { FBReplySteps, FBReplyTemplate } from '../../../shared/types';
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

// Template management
let templates: FBReplyTemplate[] = [{ message: 'hello world', imageUrls: [] }];
let activeTemplateIndex = 0;

function renderTemplateTabs(): void {
  const headerEl = document.getElementById('fbTemplateTabsHeader') as HTMLElement;
  headerEl.innerHTML = '';

  // Add the "Add Template" button first (on the left)
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-template';
  addBtn.id = 'fbAddTemplateBtn';
  addBtn.title = 'Add Template';
  addBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  `;
  addBtn.addEventListener('click', addTemplate);
  headerEl.appendChild(addBtn);

  // Then add the tabs
  templates.forEach((_, index) => {
    const tab = document.createElement('div');
    tab.className = `fb-template-tab ${index === activeTemplateIndex ? 'active' : ''}`;
    tab.dataset.index = String(index);

    tab.innerHTML = `
      <span class="fb-template-tab-label">${index + 1}</span>
      ${templates.length > 1 ? `
        <button class="fb-template-tab-remove" data-index="${index}" title="Remove template">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      ` : ''}
    `;
    headerEl.appendChild(tab);
  });

  // Add click handlers for tabs
  headerEl.querySelectorAll('.fb-template-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Don't switch tab if clicking remove button
      if (target.closest('.fb-template-tab-remove')) return;

      const tabEl = (e.currentTarget as HTMLElement);
      const index = parseInt(tabEl.dataset.index || '0', 10);
      switchToTemplate(index);
    });
  });

  // Add click handlers for remove buttons
  headerEl.querySelectorAll('.fb-template-tab-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      const index = parseInt(target.dataset.index || '0', 10);
      removeTemplate(index);
    });
  });
}

function switchToTemplate(index: number): void {
  // Save current template data first
  saveCurrentTemplateData();

  // Switch to new template
  activeTemplateIndex = index;
  setFBActions({ ...fbActions, activeTemplateIndex });

  // Load template data into UI
  loadTemplateDataToUI();

  // Re-render tabs to update active state
  renderTemplateTabs();
}

function saveCurrentTemplateData(): void {
  const messageEl = document.getElementById('fbReplyMessage') as HTMLTextAreaElement;
  if (templates[activeTemplateIndex]) {
    templates[activeTemplateIndex].message = messageEl.value;
  }
  saveTemplates();
}

function loadTemplateDataToUI(): void {
  const messageEl = document.getElementById('fbReplyMessage') as HTMLTextAreaElement;
  const template = templates[activeTemplateIndex];
  if (template) {
    messageEl.value = template.message;
    renderImageUrlInputs();
  }
}

function addTemplate(): void {
  // Save current template first
  saveCurrentTemplateData();

  // Add new template
  templates.push({ message: '', imageUrls: [] });
  activeTemplateIndex = templates.length - 1;

  saveTemplates();
  setFBActions({ ...fbActions, templates, activeTemplateIndex });

  renderTemplateTabs();
  loadTemplateDataToUI();

  // Focus the message textarea
  const messageEl = document.getElementById('fbReplyMessage') as HTMLTextAreaElement;
  messageEl.focus();
}

function removeTemplate(index: number): void {
  if (templates.length <= 1) return;

  templates.splice(index, 1);

  // Adjust active index if needed
  if (activeTemplateIndex >= templates.length) {
    activeTemplateIndex = templates.length - 1;
  } else if (activeTemplateIndex > index) {
    activeTemplateIndex--;
  }

  saveTemplates();
  setFBActions({ ...fbActions, templates, activeTemplateIndex });

  renderTemplateTabs();
  loadTemplateDataToUI();
}

function renderImageUrlInputs(): void {
  const listEl = document.getElementById('fbImageUrlsList') as HTMLElement;
  listEl.innerHTML = '';

  const currentUrls = templates[activeTemplateIndex]?.imageUrls || [];

  currentUrls.forEach((url, index) => {
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
      if (templates[activeTemplateIndex]) {
        templates[activeTemplateIndex].imageUrls[index] = target.value;
        saveTemplates();
      }
    });
  });

  // Add event listeners for remove buttons
  listEl.querySelectorAll('.btn-remove-image').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const index = parseInt(target.dataset.index || '0', 10);
      if (templates[activeTemplateIndex]) {
        templates[activeTemplateIndex].imageUrls.splice(index, 1);
        saveTemplates();
        renderImageUrlInputs();
      }
    });
  });
}

function addImageUrl(): void {
  if (templates[activeTemplateIndex]) {
    templates[activeTemplateIndex].imageUrls.push('');
    saveTemplates();
    renderImageUrlInputs();
    // Focus the new input
    const inputs = document.querySelectorAll('.fb-image-url-input');
    const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
    if (lastInput) lastInput.focus();
  }
}

function saveTemplates(): void {
  chrome.storage.local.set({ fbTemplates: templates, fbActiveTemplateIndex: activeTemplateIndex });
  setFBActions({ ...fbActions, templates, activeTemplateIndex });
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
    'fbTemplates', 'fbActiveTemplateIndex',
    'fbReplyDelayMin', 'fbReplyDelayMax',
    'fbStepClickReply', 'fbStepInputText', 'fbStepUploadImages', 'fbStepSubmit', 'fbActionClose'
  ]);

  // Load templates
  if (stored.fbTemplates && stored.fbTemplates.length > 0) {
    templates = stored.fbTemplates;
  }
  if (stored.fbActiveTemplateIndex !== undefined && stored.fbActiveTemplateIndex < templates.length) {
    activeTemplateIndex = stored.fbActiveTemplateIndex;
  }

  // Load other settings
  if (stored.fbReplyDelayMin) delayMinEl.value = stored.fbReplyDelayMin;
  if (stored.fbReplyDelayMax) delayMaxEl.value = stored.fbReplyDelayMax;
  if (stored.fbStepClickReply !== undefined) stepClickReply.checked = stored.fbStepClickReply;
  if (stored.fbStepInputText !== undefined) stepInputText.checked = stored.fbStepInputText;
  if (stored.fbStepUploadImages !== undefined) stepUploadImages.checked = stored.fbStepUploadImages;
  if (stored.fbStepSubmit !== undefined) stepSubmit.checked = stored.fbStepSubmit;
  if (stored.fbActionClose !== undefined) closeCheckbox.checked = stored.fbActionClose;

  // Render template tabs and load active template
  renderTemplateTabs();
  loadTemplateDataToUI();

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
    templates,
    activeTemplateIndex,
    close: closeCheckbox.checked,
  });
  updateFBActionUI();

  // Save message on change
  messageEl.addEventListener('input', () => {
    if (templates[activeTemplateIndex]) {
      templates[activeTemplateIndex].message = messageEl.value;
      saveTemplates();
    }
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
    setFBActions({ ...fbActions, steps: getCurrentSteps() });
    updateFBActionUI();
  });

  stepInputText.addEventListener('change', () => {
    chrome.storage.local.set({ fbStepInputText: stepInputText.checked });
    setFBActions({ ...fbActions, steps: getCurrentSteps() });
    updateFBActionUI();
  });

  stepUploadImages.addEventListener('change', () => {
    chrome.storage.local.set({ fbStepUploadImages: stepUploadImages.checked });
    setFBActions({ ...fbActions, steps: getCurrentSteps() });
    updateFBActionUI();
  });

  stepSubmit.addEventListener('change', () => {
    chrome.storage.local.set({ fbStepSubmit: stepSubmit.checked });
    setFBActions({ ...fbActions, steps: getCurrentSteps() });
    updateFBActionUI();
  });

  closeCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ fbActionClose: closeCheckbox.checked });
    setFBActions({ ...fbActions, close: closeCheckbox.checked });
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
