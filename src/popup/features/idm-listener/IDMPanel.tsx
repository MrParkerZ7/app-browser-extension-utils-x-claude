import { useState } from 'react';
import { useIDMListener } from './useIDMListener';

export function IDMPanel() {
  const {
    state,
    status,
    startListener,
    stopListener,
    downloadVideo,
    downloadAllVideos,
    copyVideoUrl,
    clearVideos,
  } = useIDMListener();

  const [isCollapsed, setIsCollapsed] = useState(false);
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
            <span>IDM Video Listener</span>
          </div>

          <div className={`fb-notif-section-content ${isCollapsed ? 'collapsed' : ''}`}>
            <p className="fb-reply-desc">
              Detect video links on pages. Requires{' '}
              <strong>IDM Integration Module</strong> browser extension installed for IDM to
              intercept downloads.
            </p>

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
                          title={video.downloaded ? 'Already sent to IDM' : 'Open URL for IDM to intercept'}
                        >
                          {video.downloaded ? '✓' : 'IDM'}
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
