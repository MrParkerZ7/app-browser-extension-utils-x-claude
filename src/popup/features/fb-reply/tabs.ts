// FB Auto Reply tabs rendering and UI updates
import { fbState, getActionLabel } from './state';

// Status display
export function showFBStatus(message: string, type: 'error' | 'info' | 'warning'): void {
  const statusEl = document.getElementById('fbReplyStatus') as HTMLElement;
  statusEl.textContent = message;
  statusEl.className = `fb-reply-status visible ${type}`;
}

export function hideFBStatus(): void {
  const statusEl = document.getElementById('fbReplyStatus') as HTMLElement;
  statusEl.classList.remove('visible');
}

export function updateFBProgress(completed: number, total: number): void {
  const progressEl = document.getElementById('fbReplyProgress') as HTMLElement;
  const fillEl = document.getElementById('fbProgressFill') as HTMLElement;
  const textEl = document.getElementById('fbProgressText') as HTMLElement;

  if (total === 0) {
    progressEl.classList.remove('visible');
    return;
  }

  progressEl.classList.add('visible');
  const percent = (completed / total) * 100;
  fillEl.style.width = `${percent}%`;
  textEl.textContent = `${completed} / ${total} completed`;
}

export function updateFBActionUI(): void {
  const templateSettings = document.getElementById('fbTemplateSettings') as HTMLElement;
  const messageSettings = document.getElementById('fbMessageSettings') as HTMLElement;
  const imageSettings = document.getElementById('fbImageSettings') as HTMLElement;
  const stepInputText = document.getElementById('fbStepInputText') as HTMLInputElement;
  const stepUploadImages = document.getElementById('fbStepUploadImages') as HTMLInputElement;

  const needsTemplates = stepInputText?.checked || stepUploadImages?.checked;

  // Show template section when either input text or upload images is checked
  if (needsTemplates) {
    templateSettings.classList.remove('hidden');
  } else {
    templateSettings.classList.add('hidden');
  }

  // Show message input only when input text step is checked
  if (stepInputText?.checked) {
    messageSettings.classList.remove('hidden');
  } else {
    messageSettings.classList.add('hidden');
  }

  // Show image URLs only when upload images step is checked
  if (stepUploadImages?.checked) {
    imageSettings.classList.remove('hidden');
  } else {
    imageSettings.classList.add('hidden');
  }

  updateFBButtonStates();
}

export function updateFBButtonStates(): void {
  const startBtn = document.getElementById('fbStartReplyBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('fbStopReplyBtn') as HTMLButtonElement;
  const scanBtn = document.getElementById('fbScanTabsBtn') as HTMLButtonElement;
  const selectAllBtn = document.getElementById('fbSelectAllBtn') as HTMLButtonElement;
  const deselectAllBtn = document.getElementById('fbDeselectAllBtn') as HTMLButtonElement;

  const hasSelectedPendingTabs = fbState.tabs.some(t => t.status === 'pending' && t.selected);
  const hasProcessingTabs = fbState.tabs.some(t => t.status === 'processing');
  const hasTabs = fbState.tabs.length > 0;

  // Scan button: disabled when running
  scanBtn.disabled = fbState.running;

  // Start button: enabled when not running AND has selected pending tabs
  startBtn.disabled = fbState.running || !hasSelectedPendingTabs;

  // Stop button: only visible when running
  stopBtn.style.display = fbState.running ? 'inline-block' : 'none';

  // Select/Deselect buttons: disabled when running or no tabs
  selectAllBtn.disabled = fbState.running || !hasTabs;
  deselectAllBtn.disabled = fbState.running || !hasTabs;

  // Update button text to show current state and action
  if (fbState.running) {
    startBtn.textContent = hasProcessingTabs ? 'Running...' : 'Start';
  } else {
    startBtn.textContent = getActionLabel();
  }
}

export function renderFBTabs(): void {
  const listEl = document.getElementById('fbTabsList') as HTMLElement;
  const countEl = document.getElementById('fbTabCount') as HTMLElement;
  const selectedCountEl = document.getElementById('fbSelectedCount') as HTMLElement;

  const selectedCount = fbState.tabs.filter(t => t.selected && t.status === 'pending').length;
  countEl.textContent = String(fbState.tabs.length);
  selectedCountEl.textContent = String(selectedCount);
  listEl.innerHTML = '';

  fbState.tabs.forEach((tab, index) => {
    const div = document.createElement('div');
    div.className = `fb-tab-item ${tab.status}`;
    if (tab.status === 'done') div.classList.add('completed');
    if (tab.status === 'processing') div.classList.add('current');
    if (tab.status === 'error') div.classList.add('failed');
    if (!tab.selected) div.classList.add('unselected');

    const statusLabels: Record<string, string> = {
      pending: 'Pending',
      processing: 'Processing',
      done: 'Done',
      error: 'Error',
    };

    const isDisabled = tab.status !== 'pending' || fbState.running;
    const checkboxHtml = `<input type="checkbox" class="fb-tab-checkbox" data-tab-id="${tab.id}" ${tab.selected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} />`;

    div.innerHTML = `
      ${checkboxHtml}
      <span class="fb-tab-index">#${index + 1}</span>
      <span class="fb-tab-title" title="${tab.url}">${tab.title || 'Facebook Tab'}</span>
      <span class="fb-tab-status ${tab.status}">${statusLabels[tab.status] || tab.status}</span>
    `;
    listEl.appendChild(div);
  });

  // Add checkbox event listeners - send to background
  listEl.querySelectorAll('.fb-tab-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', e => {
      const target = e.target as HTMLInputElement;
      const tabId = parseInt(target.dataset.tabId || '0', 10);
      chrome.runtime.sendMessage({
        type: 'FB_SELECT_TAB',
        payload: { tabId, selected: target.checked },
      });
    });
  });
}
