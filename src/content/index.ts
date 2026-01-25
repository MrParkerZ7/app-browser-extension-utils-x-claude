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

// CSS Search functionality
function searchCSS(query: string): CSSSearchResult {
  const result: CSSSearchResult = {
    query,
    elements: 0,
    classes: 0,
    ids: 0,
    inlineStyles: 0,
    stylesheetRules: 0,
    computedMatches: 0,
  };

  if (!query.trim()) return result;

  const searchTerm = query.trim().toLowerCase();

  // Count elements matching as selector (try querySelector)
  try {
    const elements = document.querySelectorAll(query);
    result.elements = elements.length;
  } catch {
    // Invalid selector, ignore
  }

  // Count classes containing the search term
  const allElements = document.querySelectorAll('*');
  const classSet = new Set<string>();
  const idSet = new Set<string>();

  allElements.forEach(el => {
    // Check classes
    el.classList.forEach(cls => {
      if (cls.toLowerCase().includes(searchTerm)) {
        classSet.add(cls);
      }
    });

    // Check ID
    if (el.id && el.id.toLowerCase().includes(searchTerm)) {
      idSet.add(el.id);
    }

    // Check inline styles
    const style = el.getAttribute('style');
    if (style && style.toLowerCase().includes(searchTerm)) {
      result.inlineStyles++;
    }
  });

  result.classes = classSet.size;
  result.ids = idSet.size;

  // Count stylesheet rules containing the search term
  try {
    const sheets = Array.from(document.styleSheets);
    for (const sheet of sheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          const ruleList = Array.from(rules);
          for (const rule of ruleList) {
            if (rule.cssText.toLowerCase().includes(searchTerm)) {
              result.stylesheetRules++;
            }
          }
        }
      } catch {
        // Cross-origin stylesheet, skip
      }
    }
  } catch {
    // Error accessing stylesheets
  }

  // Count elements with computed styles matching (for property names)
  try {
    const sampleElements = document.querySelectorAll('body, div, span, p, a, h1, h2, h3');
    sampleElements.forEach(el => {
      const computed = getComputedStyle(el);
      for (let i = 0; i < computed.length; i++) {
        const prop = computed[i];
        if (prop.toLowerCase().includes(searchTerm)) {
          result.computedMatches++;
          break;
        }
      }
    });
  } catch {
    // Error with computed styles
  }

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
