import { useState } from 'react';
import { useImageListener } from './useImageListener';

const DEFAULT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif'];

export function ImagePanel() {
  const {
    state,
    config,
    status,
    startListener,
    stopListener,
    updateConfig,
    downloadImage,
    downloadAllImages,
    copyImageUrl,
    copyAllImageUrls,
    clearImages,
  } = useImageListener();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newExtension, setNewExtension] = useState('');

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ downloadPath: e.target.value });
  };

  const handleAutoDownloadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ autoDownload: e.target.checked });
  };

  const handleMinWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 0;
    updateConfig({ minWidth: value });
  };

  const handleMinHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 0;
    updateConfig({ minHeight: value });
  };

  const handleExtensionToggle = (ext: string) => {
    const current = config.imageExtensions || [];
    if (current.includes(ext)) {
      updateConfig({ imageExtensions: current.filter(e => e !== ext) });
    } else {
      updateConfig({ imageExtensions: [...current, ext] });
    }
  };

  const handleAddExtension = () => {
    const ext = newExtension.trim().toLowerCase().replace(/^\./, '');
    if (ext && !(config.imageExtensions || []).includes(ext)) {
      updateConfig({ imageExtensions: [...(config.imageExtensions || []), ext] });
      setNewExtension('');
    }
  };

  const handleRemoveExtension = (ext: string) => {
    updateConfig({ imageExtensions: (config.imageExtensions || []).filter(e => e !== ext) });
  };

  const undownloadedCount = state.imagesFound.filter(i => !i.downloaded).length;

  return (
    <div id="tab-image" className="tab-panel active">
      <div className="fb-reply-container">
        <div className="fb-notif-section">
          <div
            className={`fb-notif-section-header ${isCollapsed ? 'collapsed' : ''}`}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <svg
              className="fb-notif-collapse-icon"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <span>Bulk Image Download</span>
          </div>

          <div className={`fb-notif-section-content ${isCollapsed ? 'collapsed' : ''}`}>
            <p className="fb-reply-desc">
              Automatically detect image links on pages and collect them for download.
            </p>

            <div className="fb-reply-settings">
              <label className="fb-reply-label">Download path:</label>
              <input
                type="text"
                className="fb-reply-input idm-path-input"
                value={config.downloadPath}
                onChange={handlePathChange}
                placeholder="C:\Downloads\Images"
                disabled={state.running}
              />
            </div>

            <div className="fb-reply-settings" style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label className="fb-reply-label">Min width (px):</label>
                <input
                  type="number"
                  className="fb-reply-input"
                  value={config.minWidth || 0}
                  onChange={handleMinWidthChange}
                  placeholder="100"
                  min="0"
                  disabled={state.running}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="fb-reply-label">Min height (px):</label>
                <input
                  type="number"
                  className="fb-reply-input"
                  value={config.minHeight || 0}
                  onChange={handleMinHeightChange}
                  placeholder="100"
                  min="0"
                  disabled={state.running}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="fb-reply-settings">
              <label className="fb-reply-label">Image extensions:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                {/* All extensions (default + custom) inline */}
                {[...new Set([...DEFAULT_EXTENSIONS, ...(config.imageExtensions || [])])].map(ext => {
                  const isCustom = !DEFAULT_EXTENSIONS.includes(ext);
                  const isEnabled = (config.imageExtensions || []).includes(ext);
                  return (
                    <label
                      key={ext}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        backgroundColor: isEnabled ? (isCustom ? '#2b6cb0' : '#4a5568') : '#2d3748',
                        borderRadius: '4px',
                        cursor: state.running ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleExtensionToggle(ext)}
                        disabled={state.running}
                        style={{ margin: 0 }}
                      />
                      <span>.{ext}</span>
                      {isCustom && (
                        <button
                          onClick={e => {
                            e.preventDefault();
                            handleRemoveExtension(ext);
                          }}
                          disabled={state.running}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            cursor: state.running ? 'not-allowed' : 'pointer',
                            padding: '0 2px',
                            fontSize: '12px',
                            lineHeight: 1,
                          }}
                        >
                          x
                        </button>
                      )}
                    </label>
                  );
                })}
              </div>

              {/* Add custom extension */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <input
                  type="text"
                  className="fb-reply-input"
                  value={newExtension}
                  onChange={e => setNewExtension(e.target.value)}
                  placeholder="Add extension (e.g., raw)"
                  disabled={state.running}
                  style={{ flex: 1 }}
                  onKeyDown={e => e.key === 'Enter' && handleAddExtension()}
                />
                <button
                  className="btn btn-secondary btn-small"
                  onClick={handleAddExtension}
                  disabled={state.running || !newExtension.trim()}
                >
                  Add
                </button>
              </div>
            </div>

            <div className="fb-reply-settings">
              <label className="fb-action-checkbox">
                <input
                  type="checkbox"
                  checked={config.autoDownload}
                  onChange={handleAutoDownloadChange}
                  disabled={state.running}
                />
                <span>Auto-download when image found</span>
              </label>
            </div>

            {status && (
              <div className={`fb-reply-status visible ${status.type}`}>{status.message}</div>
            )}

            <div className="idm-stats">
              <div className="idm-stat">
                <span className="idm-stat-label">Images Found:</span>
                <span className="idm-stat-value">{state.totalFound}</span>
              </div>
              <div className="idm-stat">
                <span className="idm-stat-label">Downloaded:</span>
                <span className="idm-stat-value">{state.totalDownloaded}</span>
              </div>
              <div className="idm-stat">
                <span className="idm-stat-label">Status:</span>
                <span className={`idm-stat-value ${state.running ? 'running' : ''}`}>
                  {state.running ? 'Listening' : 'Stopped'}
                </span>
              </div>
            </div>

            <div className="fb-reply-actions">
              {!state.running ? (
                <button className="btn btn-primary" onClick={startListener}>
                  Start Listener
                </button>
              ) : (
                <button className="btn btn-danger" onClick={stopListener}>
                  Stop Listener
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={copyAllImageUrls}
                disabled={state.imagesFound.length === 0}
              >
                Copy All
              </button>
              <button
                className="btn btn-primary"
                onClick={downloadAllImages}
                disabled={undownloadedCount === 0}
              >
                Download All ({undownloadedCount})
              </button>
              <button
                className="btn btn-secondary"
                onClick={clearImages}
                disabled={state.imagesFound.length === 0}
              >
                Clear
              </button>
            </div>

            {state.imagesFound.length > 0 && (
              <div className="idm-video-list">
                <div className="idm-video-list-header">
                  <span>Found Images ({state.imagesFound.length})</span>
                </div>
                <div className="idm-video-items">
                  {state.imagesFound.map(image => (
                    <div
                      key={image.id}
                      className={`idm-video-item ${image.downloaded ? 'downloaded' : ''}`}
                    >
                      <div className="idm-video-info">
                        <span className="idm-video-type">{image.type}</span>
                        <span className="idm-video-title" title={image.title}>
                          {image.title}
                        </span>
                        <span className="idm-video-url" title={image.url}>
                          {image.url.length > 60 ? image.url.substring(0, 60) + '...' : image.url}
                        </span>
                      </div>
                      <div className="idm-video-actions">
                        <button
                          className="btn btn-small btn-secondary"
                          onClick={() => copyImageUrl(image)}
                          title="Copy URL"
                        >
                          Copy
                        </button>
                        <button
                          className="btn btn-small btn-primary"
                          onClick={() => downloadImage(image)}
                          disabled={image.downloaded}
                          title={image.downloaded ? 'Already downloaded' : 'Download via Chrome'}
                        >
                          {image.downloaded ? '\u2713' : 'DL'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
