// Open in window functionality

const WINDOW_SIZE = { width: 1280, height: 800 };

export function setupOpenWindow(): void {
  const openWindowBtn = document.getElementById('openWindowBtn') as HTMLButtonElement;

  openWindowBtn.addEventListener('click', () => {
    const popupUrl = chrome.runtime.getURL('popup/popup.html');

    chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: WINDOW_SIZE.width,
      height: WINDOW_SIZE.height,
    });

    window.close();
  });
}
