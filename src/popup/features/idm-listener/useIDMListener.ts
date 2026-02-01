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
    if (!config.downloadPath.trim()) {
      showStatus('Please enter a download path.', 'error');
      return;
    }

    const response = await sendMessage({ type: 'IDM_START_LISTENER', payload: config });
    if (response?.success) {
      showStatus('Video listener started.', 'info');
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
        payload: { url: video.url, downloadPath: config.downloadPath },
      });
      showStatus(`Downloading: ${video.title}`, 'info');
    },
    [config.downloadPath, showStatus]
  );

  const downloadAllVideos = useCallback(async () => {
    const undownloaded = state.videosFound.filter(v => !v.downloaded);
    for (const video of undownloaded) {
      await sendMessage({
        type: 'IDM_DOWNLOAD_VIDEO',
        payload: { url: video.url, downloadPath: config.downloadPath },
      });
    }
    showStatus(`Started downloading ${undownloaded.length} videos.`, 'info');
  }, [state.videosFound, config.downloadPath, showStatus]);

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

  const copyAllVideoUrls = useCallback(async () => {
    const urls = state.videosFound.map(v => v.url).join('\n');
    try {
      await navigator.clipboard.writeText(urls);
      showStatus(`Copied ${state.videosFound.length} URLs to clipboard.`, 'info');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = urls;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showStatus(`Copied ${state.videosFound.length} URLs to clipboard.`, 'info');
    }
  }, [state.videosFound, showStatus]);

  const copyIdmPowerShellCommands = useCallback(async () => {
    // File extensions to EXCLUDE (images and generic types)
    const excludeExtensions = [
      'avif',
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'svg',
      'bmp',
      'ico',
      'tiff',
      'heic',
      'heif',
      'video', // generic type, often unreliable
    ];

    // Filter only video files (exclude images)
    const videos = state.videosFound.filter(v => {
      if (v.downloaded) return false;

      const lowerType = v.type.toLowerCase();
      const lowerUrl = v.url.toLowerCase();

      // Exclude if type is in exclude list
      if (excludeExtensions.includes(lowerType)) return false;

      // Exclude if URL contains excluded extension
      for (const ext of excludeExtensions) {
        if (lowerUrl.includes(`.${ext}?`) || lowerUrl.includes(`.${ext}`)) {
          return false;
        }
      }

      // Include everything else (videos)
      return true;
    });

    if (videos.length === 0) {
      showStatus('No video files to download.', 'warning');
      return;
    }

    // Generate IDM PowerShell commands using Start-Process
    // IDM command format: IDMan.exe /d "URL" /p "PATH" /f "FILENAME" /r "REFERER" /n /a
    // /d - URL to download
    // /p - local path to save
    // /f - filename
    // /r - referer URL
    // /n - turn on silent mode
    // /a - add to download queue
    const idmPath = 'C:\\Program Files (x86)\\Internet Download Manager\\IDMan.exe';
    const downloadPath = config.downloadPath.replace(/\//g, '\\');

    const commands = videos.map((video, index) => {
      // Extract filename from URL or generate one
      let filename = `video_${index + 1}`;
      try {
        const urlObj = new URL(video.url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart.includes('.')) {
          filename = decodeURIComponent(lastPart.split('?')[0]);
        } else {
          const ext = video.type.toLowerCase() || 'mp4';
          filename = `video_${Date.now()}_${index + 1}.${ext}`;
        }
      } catch {
        filename = `video_${Date.now()}_${index + 1}.mp4`;
      }

      // Escape single quotes by doubling them for PowerShell
      const escapedUrl = video.url.replace(/'/g, "''");
      const referer = video.tabUrl ? video.tabUrl.replace(/'/g, "''") : '';

      // Use Start-Process for more reliable execution
      // Include referer if available
      if (referer) {
        return `Start-Process '${idmPath}' -ArgumentList '/d','${escapedUrl}','/p','${downloadPath}','/f','${filename}','/r','${referer}','/n','/a'`;
      }
      return `Start-Process '${idmPath}' -ArgumentList '/d','${escapedUrl}','/p','${downloadPath}','/f','${filename}','/n','/a'`;
    });

    const script = commands.join('\n');

    try {
      await navigator.clipboard.writeText(script);
      showStatus(`Copied ${videos.length} IDM commands to clipboard. Paste in PowerShell.`, 'info');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = script;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showStatus(`Copied ${videos.length} IDM commands to clipboard. Paste in PowerShell.`, 'info');
    }
  }, [state.videosFound, config.downloadPath, showStatus]);

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
    copyAllVideoUrls,
    copyIdmPowerShellCommands,
    clearVideos,
    showStatus,
    hideStatus,
  };
}
