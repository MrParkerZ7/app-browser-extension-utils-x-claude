// Background service worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);

  if (message.type === 'GET_DATA') {
    // Handle data request
    sendResponse({ success: true, data: 'Hello from background!' });
  }

  return true; // Keep the message channel open for async response
});

export {};
