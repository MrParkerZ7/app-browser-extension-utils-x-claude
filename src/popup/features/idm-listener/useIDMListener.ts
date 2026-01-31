import { useState, useEffect, useCallback } from 'react';
import { IDMListenerState, IDMListenerConfig, IDMVideoLink } from '../../../shared/types';
import { sendMessage } from '../../hooks';

const DEFAULT_CONFIG: IDMListenerConfig = {
  enabled: false,
  downloadPath: 'C:\\Downloads\\Videos',
  autoDownload: false,
  videoExtensions: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'm3u8', 'ts'],
};

export function useIDMListener() {
  const [state, setState] = useState<IDMListenerState>({
    running: false,
    videosFound: [],
    totalFound: 0,
    totalDownloaded: 0,
  });

  const [config, setConfig] = useState<IDMListenerConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<{
    message: string;
    type: 'error' | 'info' | 'warning';
  } | null>(null);

  // Load saved config
  useEffect(() => {
    sendMessage({ type: 'IDM_GET_CONFIG' }).then(response => {
      if (response?.success && response.data) {
        setConfig(response.data as IDMListenerConfig);
      }
    });

    sendMessage({ type: 'IDM_GET_STATE' }).then(response => {
      if (response?.success && response.data) {
        setState(response.data as IDMListenerState);
      }
    });
  }, []);

  // Listen for state updates
  useEffect(() => {
    const listener = (message: { type: string; payload?: IDMListenerState }) => {
      if (message.type === 'IDM_STATE_UPDATE' && message.payload) {
        setState(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const showStatus = useCallback((message: string, type: 'error' | 'info' | 'warning') => {
    setStatus({ message, type });
  }, []);

  const hideStatus = useCallback(() => {
    setStatus(null);
  }, []);

  const updateConfig = useCallback(
    async (updates: Partial<IDMListenerConfig>) => {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      await sendMessage({ type: 'IDM_SAVE_CONFIG', payload: newConfig });
    },
    [config]
  );

  const startListener = useCallback(async () => {
    const response = await sendMessage({ type: 'IDM_START_LISTENER', payload: config });
    if (response?.success) {
      showStatus('Video listener started. Browse pages with videos.', 'info');
    } else {
      showStatus(response?.error || 'Failed to start listener.', 'error');
    }
  }, [config, showStatus]);

  const stopListener = useCallback(async () => {
    await sendMessage({ type: 'IDM_STOP_LISTENER' });
    showStatus('Video listener stopped.', 'warning');
  }, [showStatus]);

  const downloadVideo = useCallback(
    async (video: IDMVideoLink) => {
      await sendMessage({
        type: 'IDM_DOWNLOAD_VIDEO',
        payload: { url: video.url, downloadPath: '' },
      });
      showStatus(`Sent to IDM: ${video.title}`, 'info');
    },
    [showStatus]
  );

  const downloadAllVideos = useCallback(async () => {
    const undownloaded = state.videosFound.filter(v => !v.downloaded);
    for (const video of undownloaded) {
      await sendMessage({
        type: 'IDM_DOWNLOAD_VIDEO',
        payload: { url: video.url, downloadPath: '' },
      });
      // Small delay between opening tabs to not overwhelm
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    showStatus(`Sent ${undownloaded.length} videos to IDM.`, 'info');
  }, [state.videosFound, showStatus]);

  const copyVideoUrl = useCallback(
    async (video: IDMVideoLink) => {
      try {
        await navigator.clipboard.writeText(video.url);
        showStatus(`URL copied: ${video.title}`, 'info');
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = video.url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showStatus(`URL copied: ${video.title}`, 'info');
      }
    },
    [showStatus]
  );

  const clearVideos = useCallback(async () => {
    await sendMessage({ type: 'IDM_CLEAR_VIDEOS' });
    showStatus('Video list cleared.', 'info');
  }, [showStatus]);

  return {
    state,
    config,
    status,
    startListener,
    stopListener,
    updateConfig,
    downloadVideo,
    downloadAllVideos,
    copyVideoUrl,
    clearVideos,
    showStatus,
    hideStatus,
  };
}
