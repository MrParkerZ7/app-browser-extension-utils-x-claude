import { useState } from 'react';
import { useIDMListener } from './useIDMListener';

const DEFAULT_EXTENSIONS = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'm3u8', 'ts'];

export function IDMPanel() {
  const {
    state,
    config,
    status,
    startListener,
    stopListener,
    updateConfig,
    downloadVideo,
    downloadAllVideos,
    copyVideoUrl,
    copyAllVideoUrls,
    copyIdmPowerShellCommands,
    clearVideos,
  } = useIDMListener();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newExtension, setNewExtension] = useState('');

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ downloadPath: e.target.value });
  };

  const handleAutoDownloadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ autoDownload: e.target.checked });
  };

  const handleIdmPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ idmPath: e.target.value });
  };

  const handleExtensionToggle = (ext: string) => {
    const current = config.videoExtensions || [];
    if (current.includes(ext)) {
      updateConfig({ videoExtensions: current.filter(e => e !== ext) });
    } else {
      updateConfig({ videoExtensions: [...current, ext] });
    }
  };

  const handleAddExtension = () => {
    const ext = newExtension.trim().toLowerCase().replace(/^\./, '');
    if (ext && !(config.videoExtensions || []).includes(ext)) {
      updateConfig({ videoExtensions: [...(config.videoExtensions || []), ext] });
      setNewExtension('');
    }
  };

  const handleRemoveExtension = (ext: string) => {
    updateConfig({ videoExtensions: (config.videoExtensions || []).filter(e => e !== ext) });
  };

  const undownloadedCount = state.videosFound.filter(v => !v.downloaded).length;

  return (
    <div id="tab-idm" className="tab-panel active">
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
            <span>Bulk Video Download</span>
          </div>

          <div className={`fb-notif-section-content ${isCollapsed ? 'collapsed' : ''}`}>
            <p className="fb-reply-desc">
              Automatically detect video links on pages and send them to IDM for download.
            </p>

            <div className="fb-reply-settings">
              <label className="fb-reply-label">IDM path:</label>
              <input
                type="text"
                className="fb-reply-input idm-path-input"
                value={config.idmPath || ''}
                onChange={handleIdmPathChange}
                placeholder="C:\Program Files (x86)\Internet Download Manager\IDMan.exe"
                disabled={state.running}
              />
            </div>

            <div className="fb-reply-settings">
              <label className="fb-reply-label">Download path:</label>
              <input
                type="text"
                className="fb-reply-input idm-path-input"
                value={config.downloadPath}
                onChange={handlePathChange}
                placeholder="C:\Downloads\Videos"
                disabled={state.running}
              />
            </div>

            <div className="fb-reply-settings">
              <label className="fb-reply-label">Video extensions:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                {/* All extensions (default + custom) inline */}
                {[...new Set([...DEFAULT_EXTENSIONS, ...(config.videoExtensions || [])])].map(ext => {
                  const isCustom = !DEFAULT_EXTENSIONS.includes(ext);
                  const isEnabled = (config.videoExtensions || []).includes(ext);
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
                  placeholder="Add extension (e.g., mpd)"
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
                <span>Auto-download when video found</span>
              </label>
            </div>

            {status && (
              <div className={`fb-reply-status visible ${status.type}`}>{status.message}</div>
            )}

            <div className="idm-stats">
              <div className="idm-stat">
                <span className="idm-stat-label">Videos Found:</span>
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
                onClick={copyAllVideoUrls}
                disabled={state.videosFound.length === 0}
                title="Copy all video URLs to clipboard"
              >
                Copy All
              </button>
              <button
                className="btn btn-primary"
                onClick={downloadAllVideos}
                disabled={undownloadedCount === 0}
              >
                Download All ({undownloadedCount})
              </button>
              <button
                className="btn btn-secondary"
                onClick={clearVideos}
                disabled={state.videosFound.length === 0}
              >
                Clear
              </button>
            </div>

            <div className="fb-reply-actions" style={{ marginTop: '8px' }}>
              <button
                className="btn btn-primary"
                onClick={copyIdmPowerShellCommands}
                disabled={undownloadedCount === 0}
                title="Copy IDM PowerShell commands to clipboard"
              >
                IDM PowerShell ({undownloadedCount})
              </button>
            </div>

            {state.videosFound.length > 0 && (
              <div className="idm-video-list">
                <div className="idm-video-list-header">
                  <span>Found Videos ({state.videosFound.length})</span>
                </div>
                <div className="idm-video-items">
                  {state.videosFound.map(video => (
                    <div
                      key={video.id}
                      className={`idm-video-item ${video.downloaded ? 'downloaded' : ''}`}
                    >
                      <div className="idm-video-info">
                        <span className="idm-video-type">{video.type}</span>
                        <span className="idm-video-title" title={video.title}>
                          {video.title}
                        </span>
                        <span className="idm-video-url" title={video.url}>
                          {video.url.length > 60 ? video.url.substring(0, 60) + '...' : video.url}
                        </span>
                      </div>
                      <div className="idm-video-actions">
                        <button
                          className="btn btn-small btn-secondary"
                          onClick={() => copyVideoUrl(video)}
                          title="Copy URL"
                        >
                          Copy
                        </button>
                        <button
                          className="btn btn-small btn-primary"
                          onClick={() => downloadVideo(video)}
                          disabled={video.downloaded}
                          title={video.downloaded ? 'Already downloaded' : 'Download via Chrome'}
                        >
                          {video.downloaded ? '✓' : 'DL'}
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
