// Content script - runs in the context of web pages
import { createLogger } from '../shared/logger';
import { CSSSearchResult } from '../shared/types';

const logger = createLogger('content');

// Example: Send message to background script
function sendMessageToBackground(message: { type: string; payload?: unknown }) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// HTML Search functionality - counts exact class matches and text matches
function searchCSS(query: string): CSSSearchResult {
  const result: CSSSearchResult = {
    query,
    classes: 0,
    textMatches: 0,
  };

  if (!query.trim()) return result;

  const searchTerm = query.trim();
  const searchClasses = searchTerm.split(/\s+/);

  const allElements = document.querySelectorAll('*');

  allElements.forEach(el => {
    // Count elements where className exactly matches OR all searched classes are present
    if (searchClasses.length > 1) {
      // Multiple classes: check if element has all of them
      const hasAll = searchClasses.every(cls => el.classList.contains(cls));
      if (hasAll) {
        result.classes++;
      }
    } else {
      // Single class: exact match
      if (el.classList.contains(searchTerm)) {
        result.classes++;
      }
    }

    // Count elements with exact text match (direct text only, not children)
    const directText = Array.from(el.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent || '')
      .join('')
      .trim();

    if (directText === searchTerm) {
      result.textMatches++;
    }
  });

  return result;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Check if extension context is still valid
  if (!chrome.runtime?.id) {
    return false;
  }

  if (message.type === 'CSS_SEARCH') {
    const query = message.payload?.query || '';
    const result = searchCSS(query);
    // Only log if context is still valid
    if (chrome.runtime?.id) {
      logger.debug('CSS search performed', { query, result });
    }
    sendResponse({ success: true, data: result });
  }
  return true;
});

// Example: DOM manipulation
function init() {
  logger.info('Content script initialized', {
    url: window.location.href,
    title: document.title
  });

  // Log page visibility changes
  document.addEventListener('visibilitychange', () => {
    logger.debug('Visibility changed', {
      hidden: document.hidden,
      state: document.visibilityState
    });
  });

  // Log errors on the page
  window.addEventListener('error', (event) => {
    logger.error('Page error caught', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Log unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', {
      reason: String(event.reason),
    });
  });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { sendMessageToBackground, logger };
