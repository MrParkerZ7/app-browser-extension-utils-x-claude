// Content script - runs in the context of web pages

console.log('Content script loaded');

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
  console.log('Content script initialized on:', window.location.href);
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { sendMessageToBackground };
