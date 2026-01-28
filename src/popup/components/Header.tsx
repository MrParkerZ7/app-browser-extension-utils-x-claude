const WINDOW_SIZE = { width: 1280, height: 800 };

export function Header() {
  const handleOpenWindow = () => {
    const popupUrl = chrome.runtime.getURL('popup/popup.html');

    chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: WINDOW_SIZE.width,
      height: WINDOW_SIZE.height,
    });

    window.close();
  };

  return (
    <div className="header">
      <div className="header-title">
        <span>Browser Extension</span>
      </div>
      <div className="header-actions">
        <button
          className="btn-open-window"
          title="Open in larger window"
          onClick={handleOpenWindow}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}
