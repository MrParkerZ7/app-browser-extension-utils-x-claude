// Content script - runs in the context of web pages
import { createLogger } from '../shared/logger';

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
