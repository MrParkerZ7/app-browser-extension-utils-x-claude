import { useState } from 'react';
import { useIDMListener } from './useIDMListener';

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

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ downloadPath: e.target.value });
  };

  const handleAutoDownloadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ autoDownload: e.target.checked });
  };

  const handleIdmPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ idmPath: e.target.value });
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
