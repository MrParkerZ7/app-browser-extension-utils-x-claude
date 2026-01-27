// CSS Counter search functionality
import { CSSSearchResult } from '../../../shared/types';
import { generateId } from '../../../shared/utils';
import {
  searchItems,
  SearchItem,
  saveSearchItems,
  updateSearchItemResults as updateResults,
  updateSearchItemQuery,
  removeSearchItem,
  addSearchItemToState,
} from './state';

// Status display
export function showCSSStatus(message: string, type: 'error' | 'info'): void {
  const statusEl = document.getElementById('cssStatus') as HTMLElement;
  statusEl.textContent = message;
  statusEl.className = `css-counter-status visible ${type}`;
}

export function hideCSSStatus(): void {
  const statusEl = document.getElementById('cssStatus') as HTMLElement;
  statusEl.classList.remove('visible');
}

// Create search item element
export function createSearchItemElement(item: SearchItem): HTMLElement {
  const div = document.createElement('div');
  div.className = 'search-item';
  div.dataset.id = item.id;
  div.innerHTML = `
    <input
      type="text"
      class="css-input"
      placeholder="Enter class or text to search..."
      spellcheck="false"
      value="${item.query.replace(/"/g, '&quot;')}"
    />
    <div class="search-results">
      <div class="result-badge">
        <span class="count">${item.classes}</span>
        <span class="label">classes</span>
      </div>
      <div class="result-badge">
        <span class="count">${item.textMatches}</span>
        <span class="label">text</span>
      </div>
    </div>
    <button class="btn-icon btn-remove" title="Remove">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  return div;
}

// Update results in DOM
function updateSearchItemResultsDOM(id: string, classes: number, textMatches: number): void {
  updateResults(id, classes, textMatches);

  const el = document.querySelector(`.search-item[data-id="${id}"]`);
  if (el) {
    const counts = el.querySelectorAll('.result-badge .count');
    if (counts[0]) counts[0].textContent = String(classes);
    if (counts[1]) counts[1].textContent = String(textMatches);
  }
}

// Perform search for single item
export async function performSearchForItem(id: string, query: string): Promise<void> {
  if (!query.trim()) {
    updateSearchItemResultsDOM(id, 0, 0);
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (
    tab.url?.startsWith('chrome://') ||
    tab.url?.startsWith('chrome-extension://') ||
    tab.url?.startsWith('about:')
  ) {
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'CSS_SEARCH',
      payload: { query },
    });

    if (response?.success && response.data) {
      const result = response.data as CSSSearchResult;
      updateSearchItemResultsDOM(id, result.classes, result.textMatches);
    }
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/index.js'],
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'CSS_SEARCH',
        payload: { query },
      });

      if (response?.success && response.data) {
        const result = response.data as CSSSearchResult;
        updateSearchItemResultsDOM(id, result.classes, result.textMatches);
      }
    } catch {
      // Silently fail for individual items
    }
  }
}

// Perform all searches
export async function performAllSearches(): Promise<void> {
  hideCSSStatus();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showCSSStatus('No active tab found', 'error');
    return;
  }

  if (
    tab.url?.startsWith('chrome://') ||
    tab.url?.startsWith('chrome-extension://') ||
    tab.url?.startsWith('about:')
  ) {
    showCSSStatus('Cannot search on browser internal pages', 'error');
    return;
  }

  for (const item of searchItems) {
    await performSearchForItem(item.id, item.query);
  }
}

// Render search list
export function renderSearchList(): void {
  const list = document.getElementById('searchList') as HTMLElement;
  list.innerHTML = '';

  searchItems.forEach(item => {
    const el = createSearchItemElement(item);
    list.appendChild(el);
  });

  setupSearchItemListeners();
}

// Setup event listeners for search items
export function setupSearchItemListeners(): void {
  const list = document.getElementById('searchList') as HTMLElement;

  // Input listeners
  list.querySelectorAll('.css-input').forEach(input => {
    let debounceTimer: number;
    input.addEventListener('input', e => {
      const target = e.target as HTMLInputElement;
      const itemEl = target.closest('.search-item') as HTMLElement;
      const id = itemEl.dataset.id!;
      const query = target.value;

      updateSearchItemQuery(id, query);

      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(async () => {
        await saveSearchItems();
        performSearchForItem(id, query);
      }, 500);
    });

    input.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter') {
        const target = ke.target as HTMLInputElement;
        const itemEl = target.closest('.search-item') as HTMLElement;
        const id = itemEl.dataset.id!;
        performSearchForItem(id, target.value);
      }
    });
  });

  // Remove listeners
  list.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async e => {
      const itemEl = (e.target as HTMLElement).closest('.search-item') as HTMLElement;
      const id = itemEl.dataset.id!;

      removeSearchItem(id);
      await saveSearchItems();
      renderSearchList();
    });
  });
}

// Add new search item
export function addSearchItem(query = ''): void {
  const newItem: SearchItem = {
    id: generateId(),
    query,
    classes: 0,
    textMatches: 0,
  };
  addSearchItemToState(newItem);
  saveSearchItems();
  renderSearchList();

  // Focus the new input
  const list = document.getElementById('searchList') as HTMLElement;
  const lastInput = list.querySelector('.search-item:last-child .css-input') as HTMLInputElement;
  if (lastInput) lastInput.focus();
}
