import { useState, useEffect, useCallback } from 'react';
import { ImageListenerState, ImageListenerConfig, ImageLink } from '../../../shared/types';
import { sendMessage } from '../../hooks';

const DEFAULT_CONFIG: ImageListenerConfig = {
  enabled: false,
  downloadPath: 'C:\\Downloads\\Images',
  autoDownload: false,
  imageExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif'],
  minWidth: 100,
  minHeight: 100,
};

export function useImageListener() {
  const [state, setState] = useState<ImageListenerState>({
    running: false,
    imagesFound: [],
    totalFound: 0,
    totalDownloaded: 0,
  });

  const [config, setConfig] = useState<ImageListenerConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<{
    message: string;
    type: 'error' | 'info' | 'warning';
  } | null>(null);

  // Load saved config
  useEffect(() => {
    sendMessage({ type: 'IMAGE_GET_CONFIG' }).then(response => {
      if (response?.success && response.data) {
        setConfig(response.data as ImageListenerConfig);
      }
    });

    sendMessage({ type: 'IMAGE_GET_STATE' }).then(response => {
      if (response?.success && response.data) {
        setState(response.data as ImageListenerState);
      }
    });
  }, []);

  // Listen for state updates
  useEffect(() => {
    const listener = (message: { type: string; payload?: ImageListenerState }) => {
      if (message.type === 'IMAGE_STATE_UPDATE' && message.payload) {
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
    async (updates: Partial<ImageListenerConfig>) => {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      await sendMessage({ type: 'IMAGE_SAVE_CONFIG', payload: newConfig });
    },
    [config]
  );

  const startListener = useCallback(async () => {
    if (!config.downloadPath.trim()) {
      showStatus('Please enter a download path.', 'error');
      return;
    }

    const response = await sendMessage({ type: 'IMAGE_START_LISTENER', payload: config });
    if (response?.success) {
      showStatus('Image listener started.', 'info');
    } else {
      showStatus(response?.error || 'Failed to start listener.', 'error');
    }
  }, [config, showStatus]);

  const stopListener = useCallback(async () => {
    await sendMessage({ type: 'IMAGE_STOP_LISTENER' });
    showStatus('Image listener stopped.', 'warning');
  }, [showStatus]);

  const downloadImage = useCallback(
    async (image: ImageLink) => {
      await sendMessage({
        type: 'IMAGE_DOWNLOAD',
        payload: { url: image.url, downloadPath: config.downloadPath },
      });
      showStatus(`Downloading: ${image.title}`, 'info');
    },
    [config.downloadPath, showStatus]
  );

  const downloadAllImages = useCallback(async () => {
    const undownloaded = state.imagesFound.filter(i => !i.downloaded);
    for (const image of undownloaded) {
      await sendMessage({
        type: 'IMAGE_DOWNLOAD',
        payload: { url: image.url, downloadPath: config.downloadPath },
      });
    }
    showStatus(`Started downloading ${undownloaded.length} images.`, 'info');
  }, [state.imagesFound, config.downloadPath, showStatus]);

  const copyImageUrl = useCallback(
    async (image: ImageLink) => {
      try {
        await navigator.clipboard.writeText(image.url);
        showStatus(`URL copied: ${image.title}`, 'info');
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = image.url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showStatus(`URL copied: ${image.title}`, 'info');
      }
    },
    [showStatus]
  );

  const copyAllImageUrls = useCallback(async () => {
    const urls = state.imagesFound.map(i => i.url).join('\n');
    try {
      await navigator.clipboard.writeText(urls);
      showStatus(`Copied ${state.imagesFound.length} URLs to clipboard.`, 'info');
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = urls;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showStatus(`Copied ${state.imagesFound.length} URLs to clipboard.`, 'info');
    }
  }, [state.imagesFound, showStatus]);

  const clearImages = useCallback(async () => {
    await sendMessage({ type: 'IMAGE_CLEAR' });
    showStatus('Image list cleared.', 'info');
  }, [showStatus]);

  return {
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
    showStatus,
    hideStatus,
  };
}
