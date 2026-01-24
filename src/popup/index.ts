// Popup script

document.addEventListener('DOMContentLoaded', () => {
  const actionBtn = document.getElementById('actionBtn') as HTMLButtonElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;

  actionBtn.addEventListener('click', async () => {
    try {
      // Send message to background script
      const response = await chrome.runtime.sendMessage({ type: 'GET_DATA' });
      statusDiv.textContent = `Response: ${response.data}`;
    } catch (error) {
      statusDiv.textContent = `Error: ${error}`;
      statusDiv.style.background = '#ffebee';
      statusDiv.style.color = '#c62828';
    }
  });

  // Example: Get current tab info
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      console.log('Current tab:', tabs[0].url);
    }
  });
});

export {};
